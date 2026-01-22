// Re-export all types
export * from './types/index.js';

// Re-export all schemas
export * from './schemas/index.js';

// Utility functions
export function formatCurrency(amount: number, currency: 'AUD' = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDimensions(x: number, y: number, z: number): string {
  return `${x.toFixed(1)} × ${y.toFixed(1)} × ${z.toFixed(1)} mm`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
}

export function estimateLeadTime(printTimeSeconds: number, quantity: number): number {
  // Base lead time of 2 days plus print time consideration
  const printDays = Math.ceil((printTimeSeconds * quantity) / (3600 * 8)); // 8 hour print days
  return Math.max(2, printDays + 1); // Minimum 2 days, plus 1 day buffer
}

// Default pricing configuration
export const DEFAULT_PRICING_CONFIG = {
  labourRatePerHour: 30,
  machineRatePerHour: 5,
  electricityRatePerKwh: 0.30,
  minimumCharge: 15,
  setupFee: 5,
  markupPercent: 0.20,
  estimateVariance: 0.10,
  materials: [
    { material: 'PLA' as const, ratePerGram: 0.03, wasteFactor: 0.10, enabled: true, colours: ['White', 'Black', 'Grey', 'Red', 'Blue', 'Green', 'Yellow', 'Orange'] },
    { material: 'PETG' as const, ratePerGram: 0.04, wasteFactor: 0.12, enabled: true, colours: ['White', 'Black', 'Clear', 'Blue', 'Green'] },
    { material: 'ABS' as const, ratePerGram: 0.04, wasteFactor: 0.15, enabled: true, colours: ['White', 'Black', 'Grey'] },
    { material: 'ASA' as const, ratePerGram: 0.05, wasteFactor: 0.12, enabled: true, colours: ['White', 'Black', 'Grey'] },
    { material: 'TPU' as const, ratePerGram: 0.06, wasteFactor: 0.15, enabled: true, colours: ['White', 'Black', 'Clear'] },
    { material: 'Nylon' as const, ratePerGram: 0.08, wasteFactor: 0.15, enabled: false, colours: ['Natural', 'Black'] },
    { material: 'Resin' as const, ratePerGram: 0.10, wasteFactor: 0.20, enabled: false, colours: ['Grey', 'White', 'Clear'] },
  ],
  qualityMultipliers: [
    { profile: 'Draft' as const, multiplier: 0.9, layerHeight: 0.28 },
    { profile: 'Standard' as const, multiplier: 1.0, layerHeight: 0.20 },
    { profile: 'Fine' as const, multiplier: 1.2, layerHeight: 0.12 },
  ],
  quantityDiscounts: [
    { minQuantity: 5, maxQuantity: 9, discountPercent: 0.05 },
    { minQuantity: 10, maxQuantity: 24, discountPercent: 0.10 },
    { minQuantity: 25, maxQuantity: 49, discountPercent: 0.15 },
    { minQuantity: 50, maxQuantity: null, discountPercent: 0.20 },
  ],
  currency: 'AUD' as const,
  enabledPrinters: ['generic-fdm', 'bambu-p1s'],
  defaultPrinter: 'generic-fdm',
};

// API error codes
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  SLICING_FAILED: 'SLICING_FAILED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  PRICING_ERROR: 'PRICING_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
