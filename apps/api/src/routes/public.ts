import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  UploadInitRequestSchema,
  QuoteRequestSchema,
  DEFAULT_PRICING_CONFIG,
  type PublicConfig,
  type QuoteResponse,
  type UploadInitResponse,
  type PricingConfig,
} from '@printforge/shared';
import { query, transaction } from '../db/index.js';
import { getUploadUrl, getDownloadUrl, calculateFileHash } from '../services/storage.js';
import { sliceModel, analyzeGeometry } from '../services/slicer.js';
import { calculatePrice } from '../services/pricing.js';
import { sendOwnerNotification, sendCustomerConfirmation } from '../services/email.js';
import { env } from '../config/env.js';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export async function publicRoutes(fastify: FastifyInstance) {
  // Get public config for widget
  fastify.get('/v1/config/public', async (request: FastifyRequest<{
    Querystring: { shopId: string }
  }>, reply: FastifyReply) => {
    const { shopId } = request.query;

    if (!shopId) {
      return reply.status(400).send({ code: 'VALIDATION_ERROR', message: 'shopId is required' });
    }

    // Get shop info
    const shopResult = await query<{
      id: string;
      name: string;
    }>('SELECT id, name FROM shops WHERE shop_id = $1', [shopId]);

    if (shopResult.rows.length === 0) {
      // Create shop with default settings if it doesn't exist
      const newShopResult = await transaction(async (client) => {
        const result = await client.query<{ id: string }>(
          'INSERT INTO shops (shop_id, name, owner_email) VALUES ($1, $2, $3) RETURNING id',
          [shopId, shopId.split('.')[0], 'owner@example.com']
        );

        await client.query(
          'INSERT INTO shop_pricing (shop_id, pricing_config) VALUES ($1, $2)',
          [result.rows[0].id, JSON.stringify(DEFAULT_PRICING_CONFIG)]
        );

        return result;
      });

      const config: PublicConfig = {
        shopId,
        shopName: shopId.split('.')[0],
        materials: DEFAULT_PRICING_CONFIG.materials
          .filter(m => m.enabled)
          .map(m => ({ material: m.material, colours: m.colours })),
        qualityProfiles: ['Draft', 'Standard', 'Fine'],
        maxFileSizeMb: 100,
        acceptedFileTypes: ['.stl', '.3mf', '.obj'],
      };

      return reply.send(config);
    }

    const shop = shopResult.rows[0];

    // Get pricing config
    const pricingResult = await query<{ pricing_config: PricingConfig }>(
      'SELECT pricing_config FROM shop_pricing WHERE shop_id = $1',
      [shop.id]
    );

    const pricingConfig = pricingResult.rows.length > 0
      ? pricingResult.rows[0].pricing_config
      : DEFAULT_PRICING_CONFIG;

    const config: PublicConfig = {
      shopId,
      shopName: shop.name,
      materials: pricingConfig.materials
        .filter(m => m.enabled)
        .map(m => ({ material: m.material, colours: m.colours })),
      qualityProfiles: ['Draft', 'Standard', 'Fine'],
      maxFileSizeMb: 100,
      acceptedFileTypes: ['.stl', '.3mf', '.obj'],
    };

    return reply.send(config);
  });

  // Initialize file upload
  fastify.post('/v1/quotes/init-upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = UploadInitRequestSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: validation.error.flatten(),
      });
    }

    const { shopId, fileName, fileSize, fileType } = validation.data;

    // Get shop
    const shopResult = await query<{ id: string }>(
      'SELECT id FROM shops WHERE shop_id = $1',
      [shopId]
    );

    if (shopResult.rows.length === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Shop not found' });
    }

    const shopDbId = shopResult.rows[0].id;

    // Generate upload URL
    const contentType = fileType.endsWith('.stl') ? 'application/sla' :
      fileType.endsWith('.3mf') ? 'model/3mf' : 'model/obj';

    const { uploadUrl, fileKey } = await getUploadUrl(fileName, contentType, shopId);
    const sessionId = nanoid();
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

    // Create upload session
    await query(
      `INSERT INTO upload_sessions (id, shop_id, file_key, file_name, file_size, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, shopDbId, fileKey, fileName, fileSize, expiresAt]
    );

    const response: UploadInitResponse = {
      uploadUrl,
      fileKey,
      sessionId,
      expiresAt,
    };

    return reply.send(response);
  });

  // Analyze uploaded file (get dimensions without full quote)
  fastify.post('/v1/quotes/analyze', async (request: FastifyRequest<{
    Body: { fileKey: string; shopId: string }
  }>, reply: FastifyReply) => {
    const { fileKey, shopId } = request.body;

    if (!fileKey || !shopId) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'fileKey and shopId are required',
      });
    }

    try {
      const geometry = await analyzeGeometry(fileKey);

      return reply.send({
        boundingBox: geometry.boundingBox,
        triangleCount: geometry.triangleCount,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      return reply.status(500).send({
        code: 'SLICING_FAILED',
        message: 'Failed to analyze file',
      });
    }
  });

  // Submit quote request
  fastify.post('/v1/quotes/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = QuoteRequestSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: validation.error.flatten(),
      });
    }

    const data = validation.data;

    // Verify upload session
    const sessionResult = await query<{
      id: string;
      shop_id: string;
      file_key: string;
      expires_at: Date;
    }>(
      `SELECT us.id, us.shop_id, us.file_key, us.expires_at, s.shop_id as shop_domain
       FROM upload_sessions us
       JOIN shops s ON s.id = us.shop_id
       WHERE us.id = $1 AND us.file_key = $2 AND s.shop_id = $3`,
      [data.sessionId, data.fileKey, data.shopId]
    );

    if (sessionResult.rows.length === 0) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid or expired upload session',
      });
    }

    const session = sessionResult.rows[0];

    if (new Date(session.expires_at) < new Date()) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Upload session has expired',
      });
    }

    // Get shop and pricing config
    const shopResult = await query<{
      id: string;
      name: string;
      owner_email: string;
    }>('SELECT id, name, owner_email FROM shops WHERE shop_id = $1', [data.shopId]);

    const shop = shopResult.rows[0];

    const pricingResult = await query<{ pricing_config: PricingConfig }>(
      'SELECT pricing_config FROM shop_pricing WHERE shop_id = $1',
      [shop.id]
    );

    const pricingConfig = pricingResult.rows.length > 0
      ? pricingResult.rows[0].pricing_config
      : DEFAULT_PRICING_CONFIG;

    // Generate file hash (placeholder - actual hash would come from file content)
    const fileHash = createHash('sha256')
      .update(`${data.fileKey}-${data.fileSize}`)
      .digest('hex');

    // Slice the model
    let slicingResult;
    try {
      slicingResult = await sliceModel(
        data.fileKey,
        fileHash,
        data.quality,
        data.infill || 20,
        pricingConfig.defaultPrinter
      );
    } catch (error) {
      console.error('Slicing failed:', error);
      // Use fallback estimation based on file size
      slicingResult = {
        printTimeSeconds: Math.round(data.fileSize / 1000), // Rough estimate
        filamentGrams: Math.round(data.fileSize / 50000), // Rough estimate
        filamentMetres: Math.round(data.fileSize / 50000) / 2.98,
        boundingBox: { x: 100, y: 100, z: 50 }, // Default
        triangleCount: 0,
        layerCount: 0,
        settingsHash: 'fallback',
      };
    }

    // Calculate price
    const breakdown = calculatePrice({
      slicingResult,
      material: data.material,
      quality: data.quality,
      quantity: data.quantity,
      pricingConfig,
    });

    // Create submission
    const submissionId = nanoid();

    await query(
      `INSERT INTO quote_submissions (
         id, shop_id, customer_name, customer_email, customer_phone, notes,
         material, colour, quantity, quality, infill,
         file_key, file_name, file_size, file_hash,
         bbox_x, bbox_y, bbox_z, filament_grams, print_time_seconds,
         price_estimate_low, price_estimate_high, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19, $20,
         $21, $22, $23
       )`,
      [
        submissionId, shop.id, data.customerName, data.customerEmail, data.customerPhone || null, data.notes || null,
        data.material, data.colour, data.quantity, data.quality, data.infill || 20,
        data.fileKey, data.fileName, data.fileSize, fileHash,
        slicingResult.boundingBox.x, slicingResult.boundingBox.y, slicingResult.boundingBox.z,
        slicingResult.filamentGrams, slicingResult.printTimeSeconds,
        breakdown.estimateLow, breakdown.estimateHigh, 'quoted',
      ]
    );

    // Update upload session status
    await query(
      'UPDATE upload_sessions SET status = $1 WHERE id = $2',
      ['completed', session.id]
    );

    // Create event
    await query(
      `INSERT INTO events (shop_id, type, submission_id, metadata)
       VALUES ($1, $2, $3, $4)`,
      [shop.id, 'submission_created', submissionId, JSON.stringify({ material: data.material, quality: data.quality })]
    );

    // Send emails
    try {
      const downloadUrl = await getDownloadUrl(data.fileKey, 7 * 24 * 3600); // 7 days
      const adminUrl = `${env.ADMIN_URL}/submissions/${submissionId}`;

      // Get full submission for email
      const submissionForEmail = {
        id: submissionId,
        shopId: data.shopId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        notes: data.notes,
        material: data.material,
        colour: data.colour,
        quantity: data.quantity,
        quality: data.quality,
        infill: data.infill || 20,
        fileKey: data.fileKey,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileHash,
        bboxX: slicingResult.boundingBox.x,
        bboxY: slicingResult.boundingBox.y,
        bboxZ: slicingResult.boundingBox.z,
        filamentGrams: slicingResult.filamentGrams,
        printTimeSeconds: slicingResult.printTimeSeconds,
        priceEstimateLow: breakdown.estimateLow,
        priceEstimateHigh: breakdown.estimateHigh,
        status: 'quoted' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Send owner notification
      await sendOwnerNotification(shop.owner_email, submissionForEmail, breakdown, downloadUrl, adminUrl);

      // Send customer confirmation
      await sendCustomerConfirmation(submissionForEmail, breakdown, shop.name);
    } catch (emailError) {
      console.error('Failed to send emails:', emailError);
      // Don't fail the request if email fails
    }

    const response: QuoteResponse = {
      submissionId,
      estimateLow: breakdown.estimateLow,
      estimateHigh: breakdown.estimateHigh,
      breakdown,
      leadTimeDays: Math.max(2, Math.ceil((slicingResult.printTimeSeconds * data.quantity) / (8 * 3600)) + 1),
      currency: 'AUD',
    };

    return reply.send(response);
  });

  // Health check
  fastify.get('/health', async (request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
