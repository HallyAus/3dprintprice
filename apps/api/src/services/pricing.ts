import type {
  PricingConfig,
  Material,
  QualityProfile,
  PriceBreakdown,
  SlicingResult,
} from '@printforge/shared';
import { formatCurrency } from '@printforge/shared';

export interface PriceCalculationInput {
  slicingResult: SlicingResult;
  material: Material;
  quality: QualityProfile;
  quantity: number;
  pricingConfig: PricingConfig;
}

/**
 * Calculate the price for a 3D print job
 */
export function calculatePrice(input: PriceCalculationInput): PriceBreakdown {
  const { slicingResult, material, quality, quantity, pricingConfig } = input;

  // Get material pricing
  const materialConfig = pricingConfig.materials.find(m => m.material === material);
  if (!materialConfig) {
    throw new Error(`Material ${material} not found in pricing config`);
  }

  // Get quality multiplier
  const qualityConfig = pricingConfig.qualityMultipliers.find(q => q.profile === quality);
  if (!qualityConfig) {
    throw new Error(`Quality profile ${quality} not found in pricing config`);
  }

  // Calculate material cost
  const materialCostPerUnit =
    slicingResult.filamentGrams *
    materialConfig.ratePerGram *
    (1 + materialConfig.wasteFactor);

  const materialCost = materialCostPerUnit * quantity;

  // Calculate time cost
  const printTimeHours = slicingResult.printTimeSeconds / 3600;
  const timeCostPerUnit = printTimeHours * pricingConfig.machineRatePerHour;
  const timeCost = timeCostPerUnit * quantity;

  // Calculate labour cost (setup fee is per order, not per unit)
  const labourCost = pricingConfig.setupFee;

  // Calculate subtotal before markup
  const subtotalBeforeMarkup = materialCost + timeCost + labourCost;

  // Apply quality multiplier
  const subtotalWithQuality = subtotalBeforeMarkup * qualityConfig.multiplier;

  // Calculate quantity discount
  let discountPercent = 0;
  for (const discount of pricingConfig.quantityDiscounts) {
    if (quantity >= discount.minQuantity) {
      if (discount.maxQuantity === null || quantity <= discount.maxQuantity) {
        discountPercent = discount.discountPercent;
        break;
      }
    }
  }
  const quantityDiscount = subtotalWithQuality * discountPercent;
  const subtotalAfterDiscount = subtotalWithQuality - quantityDiscount;

  // Apply markup
  const markup = subtotalAfterDiscount * pricingConfig.markupPercent;
  const subtotal = subtotalAfterDiscount + markup;

  // Apply minimum charge
  const total = Math.max(pricingConfig.minimumCharge, subtotal);

  // Calculate estimate range
  const variance = pricingConfig.estimateVariance;
  const estimateLow = total * (1 - variance);
  const estimateHigh = total * (1 + variance);

  return {
    materialCost: roundToTwoDecimals(materialCost),
    timeCost: roundToTwoDecimals(timeCost),
    labourCost: roundToTwoDecimals(labourCost),
    subtotal: roundToTwoDecimals(subtotalWithQuality),
    markup: roundToTwoDecimals(markup),
    quantityDiscount: roundToTwoDecimals(quantityDiscount),
    total: roundToTwoDecimals(total),
    estimateLow: roundToTwoDecimals(estimateLow),
    estimateHigh: roundToTwoDecimals(estimateHigh),
    currency: 'AUD',
  };
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format price breakdown for display
 */
export function formatPriceBreakdown(breakdown: PriceBreakdown): string {
  const lines = [
    `Material Cost: ${formatCurrency(breakdown.materialCost)}`,
    `Machine Time: ${formatCurrency(breakdown.timeCost)}`,
    `Setup/Labour: ${formatCurrency(breakdown.labourCost)}`,
    `Subtotal: ${formatCurrency(breakdown.subtotal)}`,
  ];

  if (breakdown.quantityDiscount > 0) {
    lines.push(`Quantity Discount: -${formatCurrency(breakdown.quantityDiscount)}`);
  }

  lines.push(`Markup: ${formatCurrency(breakdown.markup)}`);
  lines.push(`─────────────────────`);
  lines.push(`Total: ${formatCurrency(breakdown.total)}`);
  lines.push(`Estimate Range: ${formatCurrency(breakdown.estimateLow)} - ${formatCurrency(breakdown.estimateHigh)}`);

  return lines.join('\n');
}

/**
 * Validate that a pricing config is complete and valid
 */
export function validatePricingConfig(config: PricingConfig): string[] {
  const errors: string[] = [];

  if (config.materials.length === 0) {
    errors.push('At least one material must be configured');
  }

  if (config.qualityMultipliers.length !== 3) {
    errors.push('Exactly three quality profiles (Draft, Standard, Fine) must be configured');
  }

  const enabledMaterials = config.materials.filter(m => m.enabled);
  if (enabledMaterials.length === 0) {
    errors.push('At least one material must be enabled');
  }

  for (const material of config.materials) {
    if (material.ratePerGram <= 0) {
      errors.push(`${material.material}: Rate per gram must be positive`);
    }
    if (material.wasteFactor < 0 || material.wasteFactor > 1) {
      errors.push(`${material.material}: Waste factor must be between 0 and 1`);
    }
    if (material.colours.length === 0) {
      errors.push(`${material.material}: At least one colour must be configured`);
    }
  }

  for (const quality of config.qualityMultipliers) {
    if (quality.multiplier <= 0) {
      errors.push(`${quality.profile}: Multiplier must be positive`);
    }
    if (quality.layerHeight <= 0 || quality.layerHeight > 1) {
      errors.push(`${quality.profile}: Layer height must be between 0 and 1mm`);
    }
  }

  if (config.minimumCharge < 0) {
    errors.push('Minimum charge cannot be negative');
  }

  if (config.markupPercent < 0 || config.markupPercent > 2) {
    errors.push('Markup percent must be between 0 and 200%');
  }

  return errors;
}
