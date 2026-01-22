// Material types supported by the system
export type Material =
  | 'PLA'
  | 'PETG'
  | 'ABS'
  | 'ASA'
  | 'TPU'
  | 'Nylon'
  | 'Resin';

// Quality profiles for printing
export type QualityProfile = 'Draft' | 'Standard' | 'Fine';

// Quote submission status
export type SubmissionStatus =
  | 'pending'
  | 'processing'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

// Admin user roles
export type AdminRole = 'owner' | 'admin' | 'viewer';

// Event types for analytics
export type EventType =
  | 'submission_created'
  | 'submission_viewed'
  | 'submission_accepted'
  | 'submission_rejected'
  | 'submission_completed'
  | 'pricing_updated'
  | 'admin_login';

// Shop entity
export interface Shop {
  id: string;
  shopId: string; // Shopify permanent domain
  name: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

// Material pricing configuration
export interface MaterialPricing {
  material: Material;
  ratePerGram: number; // AUD per gram
  wasteFactor: number; // e.g., 0.10 for 10%
  enabled: boolean;
  colours: string[];
}

// Quality multipliers
export interface QualityMultiplier {
  profile: QualityProfile;
  multiplier: number; // e.g., 0.9 for Draft, 1.0 for Standard, 1.2 for Fine
  layerHeight: number; // mm
}

// Quantity discount rule
export interface QuantityDiscount {
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number;
}

// Shop pricing configuration
export interface PricingConfig {
  labourRatePerHour: number; // AUD
  machineRatePerHour: number; // AUD
  electricityRatePerKwh: number; // AUD (optional)
  minimumCharge: number; // AUD
  setupFee: number; // AUD
  markupPercent: number; // e.g., 0.20 for 20%
  estimateVariance: number; // e.g., 0.10 for ±10%
  materials: MaterialPricing[];
  qualityMultipliers: QualityMultiplier[];
  quantityDiscounts: QuantityDiscount[];
  currency: 'AUD';
  enabledPrinters: string[];
  defaultPrinter: string;
}

// Bounding box dimensions
export interface BoundingBox {
  x: number; // mm
  y: number; // mm
  z: number; // mm
}

// Slicing result from PrusaSlicer
export interface SlicingResult {
  printTimeSeconds: number;
  filamentGrams: number;
  filamentMetres: number;
  boundingBox: BoundingBox;
  triangleCount: number;
  layerCount: number;
  settingsHash: string;
}

// Quote submission entity
export interface QuoteSubmission {
  id: string;
  shopId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  material: Material;
  colour: string;
  quantity: number;
  quality: QualityProfile;
  infill: number; // percentage 0-100
  fileKey: string;
  fileName: string;
  fileSize: number; // bytes
  fileHash: string;
  bboxX?: number;
  bboxY?: number;
  bboxZ?: number;
  filamentGrams?: number;
  printTimeSeconds?: number;
  priceEstimateLow?: number;
  priceEstimateHigh?: number;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Admin user entity
export interface AdminUser {
  id: string;
  shopId: string;
  email: string;
  role: AdminRole;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Analytics event entity
export interface AnalyticsEvent {
  id: string;
  shopId: string;
  type: EventType;
  submissionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Price breakdown for display
export interface PriceBreakdown {
  materialCost: number;
  timeCost: number;
  labourCost: number;
  subtotal: number;
  markup: number;
  quantityDiscount: number;
  total: number;
  estimateLow: number;
  estimateHigh: number;
  currency: 'AUD';
}

// Public config returned to widget
export interface PublicConfig {
  shopId: string;
  shopName: string;
  materials: Array<{
    material: Material;
    colours: string[];
  }>;
  qualityProfiles: QualityProfile[];
  maxFileSizeMb: number;
  acceptedFileTypes: string[];
}

// Widget submission request
export interface QuoteRequest {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  material: Material;
  colour: string;
  quantity: number;
  quality: QualityProfile;
  infill?: number;
  fileKey: string;
  fileName: string;
  fileSize: number;
}

// Quote response to widget
export interface QuoteResponse {
  submissionId: string;
  estimateLow: number;
  estimateHigh: number;
  breakdown: PriceBreakdown;
  leadTimeDays: number;
  currency: 'AUD';
}

// Upload init response
export interface UploadInitResponse {
  uploadUrl: string;
  fileKey: string;
  sessionId: string;
  expiresAt: Date;
}

// Dashboard stats
export interface DashboardStats {
  totalSubmissions: number;
  totalRevenue: number;
  averageEstimate: number;
  conversionRate: number;
  topMaterials: Array<{
    material: Material;
    count: number;
    percentage: number;
  }>;
  submissionsOverTime: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
  statusBreakdown: Array<{
    status: SubmissionStatus;
    count: number;
    percentage: number;
  }>;
}

// Printer profile for slicing
export interface PrinterProfile {
  id: string;
  name: string;
  description: string;
  bedSizeX: number;
  bedSizeY: number;
  bedSizeZ: number;
  nozzleDiameter: number;
  defaultLayerHeight: number;
  maxPrintSpeed: number;
  profilePath: string; // Path to PrusaSlicer profile
}

// API error response
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
