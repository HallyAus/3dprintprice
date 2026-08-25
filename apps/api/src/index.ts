import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import type { FastifyError } from 'fastify';

import { env, isDev } from './config/env.js';
import { healthCheck, closePool } from './db/index.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: isDev ? 'debug' : 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
});

// Register plugins
await fastify.register(cors, {
  origin: env.CORS_ORIGINS.split(',').map(o => o.trim()),
  credentials: true,
});

await fastify.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
});

await fastify.register(jwt, {
  secret: env.JWT_SECRET,
});

await fastify.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
  keyGenerator: (request) => {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    return (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.ip ||
      'unknown';
  },
});

await fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Register routes
await fastify.register(publicRoutes);
await fastify.register(adminRoutes);

// Global error handler
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);
  const fastifyError = error as FastifyError;

  // Zod validation errors
  if (fastifyError.validation) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: fastifyError.validation,
    });
  }

  // Rate limit errors
  if (fastifyError.statusCode === 429) {
    return reply.status(429).send({
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
    });
  }

  // JWT errors
  if (fastifyError.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
    fastifyError.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
    fastifyError.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired authentication token',
    });
  }

  // Default error response
  return reply.status(fastifyError.statusCode || 500).send({
    code: 'INTERNAL_ERROR',
    message: isDev ? fastifyError.message : 'An internal error occurred',
  });
});

// Graceful shutdown
const shutdown = async () => {
  fastify.log.info('Shutting down gracefully...');

  await fastify.close();
  await closePool();

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const start = async () => {
  try {
    // Check database connection
    const dbHealthy = await healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }

    await fastify.listen({
      port: env.PORT,
      host: env.HOST,
    });

    fastify.log.info(`🚀 PrintForge API running at http://${env.HOST}:${env.PORT}`);
    fastify.log.info(`📊 Environment: ${env.NODE_ENV}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Type augmentation for JWT payload
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      shopId: string;
      role: string;
    };
    user: {
      userId: string;
      shopId: string;
      role: string;
    };
  }
}
