import { z } from 'zod';

// Material enum
export const MaterialSchema = z.enum([
  'PLA',
  'PETG',
  'ABS',
  'ASA',
  'TPU',
  'Nylon',
  'Resin',
]);

// Quality profile enum
export const QualityProfileSchema = z.enum(['Draft', 'Standard', 'Fine']);

// Submission status enum
export const SubmissionStatusSchema = z.enum([
  'pending',
  'processing',
  'quoted',
  'accepted',
  'rejected',
  'completed',
  'cancelled',
]);

// Admin role enum
export const AdminRoleSchema = z.enum(['owner', 'admin', 'viewer']);

// Event type enum
export const EventTypeSchema = z.enum([
  'submission_created',
  'submission_viewed',
  'submission_accepted',
  'submission_rejected',
  'submission_completed',
  'pricing_updated',
  'admin_login',
]);

// Email validation (Australian standard)
export const EmailSchema = z.string().email('Invalid email address').max(255);

// Phone validation (Australian format)
export const PhoneSchema = z
  .string()
  .regex(
    /^(\+61|0)[2-478](\d{8}|\d{4}\s?\d{4})$/,
    'Invalid Australian phone number'
  )
  .optional();

// Upload init request
export const UploadInitRequestSchema = z.object({
  shopId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(104857600), // 100MB max
  fileType: z.string().regex(/\.(stl|3mf|obj)$/i, 'Only STL, 3MF, and OBJ files are supported'),
});

// Quote submission request from widget
export const QuoteRequestSchema = z.object({
  shopId: z.string().min(1),
  sessionId: z.string().uuid(),
  customerName: z.string().min(1).max(100).trim(),
  customerEmail: EmailSchema,
  customerPhone: PhoneSchema,
  notes: z.string().max(1000).optional(),
  material: MaterialSchema,
  colour: z.string().min(1).max(50).trim(),
  quantity: z.number().int().min(1).max(1000),
  quality: QualityProfileSchema,
  infill: z.number().int().min(5).max(100).optional().default(20),
  fileKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
});

// Material pricing schema
export const MaterialPricingSchema = z.object({
  material: MaterialSchema,
  ratePerGram: z.number().positive(),
  wasteFactor: z.number().min(0).max(1),
  enabled: z.boolean(),
  colours: z.array(z.string()),
});

// Quality multiplier schema
export const QualityMultiplierSchema = z.object({
  profile: QualityProfileSchema,
  multiplier: z.number().positive(),
  layerHeight: z.number().positive(),
});

// Quantity discount schema
export const QuantityDiscountSchema = z.object({
  minQuantity: z.number().int().positive(),
  maxQuantity: z.number().int().positive().nullable(),
  discountPercent: z.number().min(0).max(1),
});

// Pricing config schema
export const PricingConfigSchema = z.object({
  labourRatePerHour: z.number().nonnegative(),
  machineRatePerHour: z.number().nonnegative(),
  electricityRatePerKwh: z.number().nonnegative().optional().default(0),
  minimumCharge: z.number().nonnegative(),
  setupFee: z.number().nonnegative(),
  markupPercent: z.number().min(0).max(2),
  estimateVariance: z.number().min(0).max(0.5),
  materials: z.array(MaterialPricingSchema),
  qualityMultipliers: z.array(QualityMultiplierSchema),
  quantityDiscounts: z.array(QuantityDiscountSchema),
  currency: z.literal('AUD'),
  enabledPrinters: z.array(z.string()),
  defaultPrinter: z.string(),
});

// Update pricing config (partial)
export const UpdatePricingConfigSchema = PricingConfigSchema.partial();

// Admin login request
export const AdminLoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(128).optional(),
  useMagicLink: z.boolean().optional().default(false),
});

// Magic link verification
export const MagicLinkVerifySchema = z.object({
  token: z.string().min(32).max(256),
});

// Admin user creation
export const CreateAdminUserSchema = z.object({
  email: EmailSchema,
  role: AdminRoleSchema,
  sendInvite: z.boolean().optional().default(true),
});

// Submission list filters
export const SubmissionFiltersSchema = z.object({
  shopId: z.string().optional(),
  status: SubmissionStatusSchema.optional(),
  material: MaterialSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'priceEstimateHigh', 'customerName']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Update submission status
export const UpdateSubmissionStatusSchema = z.object({
  status: SubmissionStatusSchema,
  notes: z.string().max(1000).optional(),
});

// Stats date range
export const StatsDateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
});

// Shop creation/update
export const ShopSchema = z.object({
  shopId: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  ownerEmail: EmailSchema,
});

// File validation helpers
export const FileValidation = {
  maxSizeBytes: 104857600, // 100MB
  acceptedExtensions: ['.stl', '.3mf', '.obj'],
  acceptedMimeTypes: [
    'application/sla',
    'application/vnd.ms-pki.stl',
    'model/stl',
    'model/x.stl-ascii',
    'model/x.stl-binary',
    'application/octet-stream',
    'model/3mf',
    'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    'model/obj',
    'text/plain',
  ],
};

// Type exports from schemas
export type UploadInitRequest = z.infer<typeof UploadInitRequestSchema>;
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
export type MaterialPricingInput = z.infer<typeof MaterialPricingSchema>;
export type PricingConfigInput = z.infer<typeof PricingConfigSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
export type SubmissionFilters = z.infer<typeof SubmissionFiltersSchema>;
export type UpdateSubmissionStatus = z.infer<typeof UpdateSubmissionStatusSchema>;
export type StatsDateRange = z.infer<typeof StatsDateRangeSchema>;
