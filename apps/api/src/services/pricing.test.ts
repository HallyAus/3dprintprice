import { describe, it, expect } from 'vitest';
import { calculatePrice, validatePricingConfig } from './pricing.js';
import { DEFAULT_PRICING_CONFIG } from '@printforge/shared';
import type { PricingConfig, SlicingResult } from '@printforge/shared';

describe('Pricing Engine', () => {
  const mockSlicingResult: SlicingResult = {
    printTimeSeconds: 3600, // 1 hour
    filamentGrams: 50,
    filamentMetres: 16.8,
    boundingBox: { x: 50, y: 50, z: 30 },
    triangleCount: 10000,
    layerCount: 150,
    settingsHash: 'test-hash',
  };

  const testConfig: PricingConfig = {
    ...DEFAULT_PRICING_CONFIG,
    labourRatePerHour: 30,
    machineRatePerHour: 5,
    minimumCharge: 15,
    setupFee: 5,
    markupPercent: 0.20,
    estimateVariance: 0.10,
  };

  describe('calculatePrice', () => {
    it('should calculate price for a simple PLA print', () => {
      const result = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      expect(result.materialCost).toBeGreaterThan(0);
      expect(result.timeCost).toBeGreaterThan(0);
      expect(result.labourCost).toBe(testConfig.setupFee);
      expect(result.total).toBeGreaterThanOrEqual(testConfig.minimumCharge);
      expect(result.estimateLow).toBeLessThan(result.estimateHigh);
      expect(result.currency).toBe('AUD');
    });

    it('should apply quality multiplier for Fine quality', () => {
      const standardResult = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      const fineResult = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Fine',
        quantity: 1,
        pricingConfig: testConfig,
      });

      // Fine should be more expensive
      expect(fineResult.subtotal).toBeGreaterThan(standardResult.subtotal);
    });

    it('should apply quantity discount for bulk orders', () => {
      const singleResult = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      const bulkResult = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 10,
        pricingConfig: testConfig,
      });

      // Per unit cost should be lower with bulk discount
      expect(bulkResult.quantityDiscount).toBeGreaterThan(0);
    });

    it('should apply minimum charge when calculated price is too low', () => {
      const tinySlicingResult: SlicingResult = {
        ...mockSlicingResult,
        printTimeSeconds: 60, // 1 minute
        filamentGrams: 1,
      };

      const result = calculatePrice({
        slicingResult: tinySlicingResult,
        material: 'PLA',
        quality: 'Draft',
        quantity: 1,
        pricingConfig: testConfig,
      });

      expect(result.total).toBeGreaterThanOrEqual(testConfig.minimumCharge);
    });

    it('should calculate material cost with waste factor', () => {
      const plaConfig = testConfig.materials.find(m => m.material === 'PLA')!;
      const expectedMaterialCost = mockSlicingResult.filamentGrams *
        plaConfig.ratePerGram *
        (1 + plaConfig.wasteFactor);

      const result = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      expect(result.materialCost).toBeCloseTo(expectedMaterialCost, 2);
    });

    it('should handle different materials with different rates', () => {
      const plaResult = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      const petgResult = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PETG',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      // PETG should be more expensive (higher rate per gram)
      expect(petgResult.materialCost).toBeGreaterThan(plaResult.materialCost);
    });

    it('should apply markup percentage correctly', () => {
      const result = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      const expectedMarkup = (result.subtotal - result.quantityDiscount) * testConfig.markupPercent;
      expect(result.markup).toBeCloseTo(expectedMarkup, 2);
    });

    it('should calculate time cost based on machine rate', () => {
      const expectedTimeCost = (mockSlicingResult.printTimeSeconds / 3600) *
        testConfig.machineRatePerHour;

      const result = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      expect(result.timeCost).toBeCloseTo(expectedTimeCost, 2);
    });

    it('should calculate estimate variance correctly', () => {
      const result = calculatePrice({
        slicingResult: mockSlicingResult,
        material: 'PLA',
        quality: 'Standard',
        quantity: 1,
        pricingConfig: testConfig,
      });

      const expectedLow = result.total * (1 - testConfig.estimateVariance);
      const expectedHigh = result.total * (1 + testConfig.estimateVariance);

      expect(result.estimateLow).toBeCloseTo(expectedLow, 2);
      expect(result.estimateHigh).toBeCloseTo(expectedHigh, 2);
    });
  });

  describe('validatePricingConfig', () => {
    it('should return no errors for valid config', () => {
      const errors = validatePricingConfig(testConfig);
      expect(errors).toHaveLength(0);
    });

    it('should error when no materials configured', () => {
      const invalidConfig = { ...testConfig, materials: [] };
      const errors = validatePricingConfig(invalidConfig);
      expect(errors).toContain('At least one material must be configured');
    });

    it('should error when no materials enabled', () => {
      const invalidConfig = {
        ...testConfig,
        materials: testConfig.materials.map(m => ({ ...m, enabled: false })),
      };
      const errors = validatePricingConfig(invalidConfig);
      expect(errors).toContain('At least one material must be enabled');
    });

    it('should error for negative material rate', () => {
      const invalidConfig = {
        ...testConfig,
        materials: testConfig.materials.map((m, i) =>
          i === 0 ? { ...m, ratePerGram: -1 } : m
        ),
      };
      const errors = validatePricingConfig(invalidConfig);
      expect(errors.some(e => e.includes('Rate per gram must be positive'))).toBe(true);
    });

    it('should error for invalid waste factor', () => {
      const invalidConfig = {
        ...testConfig,
        materials: testConfig.materials.map((m, i) =>
          i === 0 ? { ...m, wasteFactor: 1.5 } : m
        ),
      };
      const errors = validatePricingConfig(invalidConfig);
      expect(errors.some(e => e.includes('Waste factor must be between 0 and 1'))).toBe(true);
    });

    it('should error for negative minimum charge', () => {
      const invalidConfig = { ...testConfig, minimumCharge: -10 };
      const errors = validatePricingConfig(invalidConfig);
      expect(errors).toContain('Minimum charge cannot be negative');
    });

    it('should error for invalid markup percent', () => {
      const invalidConfig = { ...testConfig, markupPercent: 2.5 };
      const errors = validatePricingConfig(invalidConfig);
      expect(errors).toContain('Markup percent must be between 0 and 200%');
    });

    it('should require three quality profiles', () => {
      const invalidConfig = {
        ...testConfig,
        qualityMultipliers: testConfig.qualityMultipliers.slice(0, 2),
      };
      const errors = validatePricingConfig(invalidConfig);
      expect(errors).toContain('Exactly three quality profiles (Draft, Standard, Fine) must be configured');
    });
  });
});
