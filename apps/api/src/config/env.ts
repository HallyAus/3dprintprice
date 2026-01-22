import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  // Server
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),

  // S3/R2
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().default('printforge-uploads'),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_REGION: z.string().default('auto'),

  // Email
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('quotes@example.com'),
  EMAIL_FROM_NAME: z.string().default('PrintForge'),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // Slicer
  SLICER_PATH: z.string().default('/usr/bin/prusa-slicer'),
  SLICER_PROFILES_PATH: z.string().default('./slicer-profiles'),

  // URLs
  API_URL: z.string().url().default('http://localhost:3001'),
  ADMIN_URL: z.string().url().default('http://localhost:3002'),
  WIDGET_URL: z.string().url().default('http://localhost:3000'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3002'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
