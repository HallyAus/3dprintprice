import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import {
  AdminLoginRequestSchema,
  MagicLinkVerifySchema,
  SubmissionFiltersSchema,
  UpdateSubmissionStatusSchema,
  UpdatePricingConfigSchema,
  StatsDateRangeSchema,
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
  type DashboardStats,
  type SubmissionStatus,
} from '@printforge/shared';
import { query } from '../db/index.js';
import { getDownloadUrl } from '../services/storage.js';
import { sendMagicLink } from '../services/email.js';
import { validatePricingConfig } from '../services/pricing.js';
import { env } from '../config/env.js';

// Auth middleware
async function verifyAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Login with password
  fastify.post('/v1/admin/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = AdminLoginRequestSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: validation.error.flatten(),
      });
    }

    const { email, password, useMagicLink } = validation.data;

    // Find user
    const userResult = await query<{
      id: string;
      shop_id: string;
      password_hash: string | null;
      role: string;
    }>(
      `SELECT au.id, au.shop_id, au.password_hash, au.role, s.name as shop_name, s.shop_id as shop_domain
       FROM admin_users au
       JOIN shops s ON s.id = au.shop_id
       WHERE au.email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (useMagicLink) {
      // Generate magic link
      const token = nanoid(64);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await query(
        `UPDATE admin_users SET magic_link_token = $1, magic_link_expires_at = $2 WHERE id = $3`,
        [token, expiresAt, user.id]
      );

      const magicLinkUrl = `${env.ADMIN_URL}/auth/verify?token=${token}`;

      const shopResult = await query<{ name: string }>('SELECT name FROM shops WHERE id = $1', [user.shop_id]);
      await sendMagicLink(email, magicLinkUrl, shopResult.rows[0]?.name || 'PrintForge');

      return reply.send({ message: 'Magic link sent to your email' });
    }

    // Password login
    if (!password || !user.password_hash) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    const validPassword = await argon2.verify(user.password_hash, password);

    if (!validPassword) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    // Update last login
    await query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Create event
    await query(
      `INSERT INTO events (shop_id, type, metadata) VALUES ($1, $2, $3)`,
      [user.shop_id, 'admin_login', JSON.stringify({ email })]
    );

    // Generate JWT
    const token = fastify.jwt.sign({
      userId: user.id,
      shopId: user.shop_id,
      role: user.role,
    }, { expiresIn: '7d' });

    return reply.send({
      token,
      user: {
        id: user.id,
        email,
        role: user.role,
      },
    });
  });

  // Verify magic link
  fastify.post('/v1/admin/verify-magic-link', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = MagicLinkVerifySchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      });
    }

    const { token } = validation.data;

    const userResult = await query<{
      id: string;
      shop_id: string;
      email: string;
      role: string;
      magic_link_expires_at: Date;
    }>(
      `SELECT id, shop_id, email, role, magic_link_expires_at
       FROM admin_users
       WHERE magic_link_token = $1`,
      [token]
    );

    if (userResult.rows.length === 0) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }

    const user = userResult.rows[0];

    if (new Date(user.magic_link_expires_at) < new Date()) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Token has expired' });
    }

    // Clear magic link and update last login
    await query(
      `UPDATE admin_users SET magic_link_token = NULL, magic_link_expires_at = NULL, last_login_at = NOW() WHERE id = $1`,
      [user.id]
    );

    // Generate JWT
    const jwtToken = fastify.jwt.sign({
      userId: user.id,
      shopId: user.shop_id,
      role: user.role,
    }, { expiresIn: '7d' });

    return reply.send({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });

  // Get current user
  fastify.get('/v1/admin/me', { preHandler: [verifyAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, shopId } = request.user as { userId: string; shopId: string };

    const userResult = await query<{
      id: string;
      email: string;
      role: string;
      last_login_at: Date;
    }>(
      `SELECT au.id, au.email, au.role, au.last_login_at, s.name as shop_name, s.shop_id as shop_domain
       FROM admin_users au
       JOIN shops s ON s.id = au.shop_id
       WHERE au.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'User not found' });
    }

    const user = userResult.rows[0];

    return reply.send({
      id: user.id,
      email: user.email,
      role: user.role,
      lastLoginAt: user.last_login_at,
      shop: {
        id: shopId,
        name: (user as unknown as { shop_name: string }).shop_name,
        domain: (user as unknown as { shop_domain: string }).shop_domain,
      },
    });
  });

  // Get submissions list
  fastify.get('/v1/admin/submissions', { preHandler: [verifyAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { shopId } = request.user as { shopId: string };
    const validation = SubmissionFiltersSchema.safeParse(request.query);

    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid filters',
        details: validation.error.flatten(),
      });
    }

    const filters = validation.data;

    let whereClause = 'WHERE shop_id = $1';
    const params: unknown[] = [shopId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.material) {
      whereClause += ` AND material = $${paramIndex++}`;
      params.push(filters.material);
    }

    if (filters.dateFrom) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.dateTo);
    }

    if (filters.search) {
      whereClause += ` AND (customer_name ILIKE $${paramIndex} OR customer_email ILIKE $${paramIndex} OR file_name ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const orderBy = `ORDER BY ${filters.sortBy === 'customerName' ? 'customer_name' : filters.sortBy === 'priceEstimateHigh' ? 'price_estimate_high' : 'created_at'} ${filters.sortOrder}`;
    const offset = (filters.page - 1) * filters.limit;

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM quote_submissions ${whereClause}`,
      params
    );

    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get submissions
    const submissionsResult = await query<{
      id: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string | null;
      material: string;
      colour: string;
      quantity: number;
      quality: string;
      file_name: string;
      file_size: number;
      bbox_x: number | null;
      bbox_y: number | null;
      bbox_z: number | null;
      filament_grams: number | null;
      print_time_seconds: number | null;
      price_estimate_low: number | null;
      price_estimate_high: number | null;
      status: string;
      created_at: Date;
    }>(
      `SELECT id, customer_name, customer_email, customer_phone, material, colour, quantity, quality,
              file_name, file_size, bbox_x, bbox_y, bbox_z, filament_grams, print_time_seconds,
              price_estimate_low, price_estimate_high, status, created_at
       FROM quote_submissions ${whereClause} ${orderBy}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, filters.limit, offset]
    );

    return reply.send({
      submissions: submissionsResult.rows.map(row => ({
        id: row.id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        material: row.material,
        colour: row.colour,
        quantity: row.quantity,
        quality: row.quality,
        fileName: row.file_name,
        fileSize: row.file_size,
        boundingBox: row.bbox_x ? { x: Number(row.bbox_x), y: Number(row.bbox_y), z: Number(row.bbox_z) } : null,
        filamentGrams: row.filament_grams ? Number(row.filament_grams) : null,
        printTimeSeconds: row.print_time_seconds,
        priceEstimateLow: row.price_estimate_low ? Number(row.price_estimate_low) : null,
        priceEstimateHigh: row.price_estimate_high ? Number(row.price_estimate_high) : null,
        status: row.status,
        createdAt: row.created_at,
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / filters.limit),
      },
    });
  });

  // Get single submission
  fastify.get<{ Params: { id: string } }>('/v1/admin/submissions/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { shopId } = request.user as { shopId: string };
    const { id } = request.params;

    const result = await query<{
      id: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string | null;
      notes: string | null;
      material: string;
      colour: string;
      quantity: number;
      quality: string;
      infill: number;
      file_key: string;
      file_name: string;
      file_size: number;
      file_hash: string | null;
      bbox_x: number | null;
      bbox_y: number | null;
      bbox_z: number | null;
      filament_grams: number | null;
      print_time_seconds: number | null;
      price_estimate_low: number | null;
      price_estimate_high: number | null;
      status: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM quote_submissions WHERE id = $1 AND shop_id = $2`,
      [id, shopId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Submission not found' });
    }

    const row = result.rows[0];

    // Generate signed download URL
    const downloadUrl = await getDownloadUrl(row.file_key, 3600);

    // Log view event
    await query(
      `INSERT INTO events (shop_id, type, submission_id) VALUES ($1, $2, $3)`,
      [shopId, 'submission_viewed', id]
    );

    return reply.send({
      id: row.id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      notes: row.notes,
      material: row.material,
      colour: row.colour,
      quantity: row.quantity,
      quality: row.quality,
      infill: row.infill,
      fileKey: row.file_key,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileHash: row.file_hash,
      boundingBox: row.bbox_x ? { x: Number(row.bbox_x), y: Number(row.bbox_y), z: Number(row.bbox_z) } : null,
      filamentGrams: row.filament_grams ? Number(row.filament_grams) : null,
      printTimeSeconds: row.print_time_seconds,
      priceEstimateLow: row.price_estimate_low ? Number(row.price_estimate_low) : null,
      priceEstimateHigh: row.price_estimate_high ? Number(row.price_estimate_high) : null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      downloadUrl,
    });
  });

  // Update submission status
  fastify.patch<{ Params: { id: string } }>('/v1/admin/submissions/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { shopId } = request.user as { shopId: string };
    const { id } = request.params;

    const validation = UpdateSubmissionStatusSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: validation.error.flatten(),
      });
    }

    const { status, notes } = validation.data;

    const result = await query(
      `UPDATE quote_submissions SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND shop_id = $4
       RETURNING id`,
      [status, notes, id, shopId]
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Submission not found' });
    }

    // Log event
    const eventType = status === 'accepted' ? 'submission_accepted' :
      status === 'rejected' ? 'submission_rejected' :
        status === 'completed' ? 'submission_completed' : null;

    if (eventType) {
      await query(
        `INSERT INTO events (shop_id, type, submission_id) VALUES ($1, $2, $3)`,
        [shopId, eventType, id]
      );
    }

    return reply.send({ success: true });
  });

  // Delete submission (GDPR compliance)
  fastify.delete<{ Params: { id: string } }>('/v1/admin/submissions/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { shopId } = request.user as { shopId: string };
    const { id } = request.params;

    const result = await query(
      `DELETE FROM quote_submissions WHERE id = $1 AND shop_id = $2 RETURNING id`,
      [id, shopId]
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Submission not found' });
    }

    return reply.send({ success: true });
  });

  // Get pricing config
  fastify.get('/v1/admin/pricing', { preHandler: [verifyAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { shopId } = request.user as { shopId: string };

    const result = await query<{ pricing_config: PricingConfig }>(
      'SELECT pricing_config FROM shop_pricing WHERE shop_id = $1',
      [shopId]
    );

    if (result.rows.length === 0) {
      return reply.send(DEFAULT_PRICING_CONFIG);
    }

    return reply.send(result.rows[0].pricing_config);
  });

  // Update pricing config
  fastify.patch('/v1/admin/pricing', { preHandler: [verifyAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { shopId, userId } = request.user as { shopId: string; userId: string };

    const validation = UpdatePricingConfigSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid pricing config',
        details: validation.error.flatten(),
      });
    }

    // Get current config
    const currentResult = await query<{ pricing_config: PricingConfig }>(
      'SELECT pricing_config FROM shop_pricing WHERE shop_id = $1',
      [shopId]
    );

    const currentConfig = currentResult.rows.length > 0
      ? currentResult.rows[0].pricing_config
      : DEFAULT_PRICING_CONFIG;

    // Merge with new values
    const newConfig: PricingConfig = {
      ...currentConfig,
      ...validation.data,
    };

    // Validate complete config
    const errors = validatePricingConfig(newConfig);
    if (errors.length > 0) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid pricing configuration',
        details: { errors },
      });
    }

    // Upsert pricing config
    await query(
      `INSERT INTO shop_pricing (shop_id, pricing_config)
       VALUES ($1, $2)
       ON CONFLICT (shop_id) DO UPDATE SET pricing_config = $2, updated_at = NOW()`,
      [shopId, JSON.stringify(newConfig)]
    );

    // Log event
    await query(
      `INSERT INTO events (shop_id, type, metadata) VALUES ($1, $2, $3)`,
      [shopId, 'pricing_updated', JSON.stringify({ updatedBy: userId })]
    );

    return reply.send(newConfig);
  });

  // Get dashboard stats
  fastify.get('/v1/admin/stats', { preHandler: [verifyAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { shopId } = request.user as { shopId: string };

    const validation = StatsDateRangeSchema.safeParse(request.query);
    const { from, to, period } = validation.success ? validation.data : { from: undefined, to: undefined, period: 'month' as const };

    // Default date range: last 30 days
    const dateFrom = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = to || new Date().toISOString();

    // Total submissions
    const totalResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM quote_submissions WHERE shop_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [shopId, dateFrom, dateTo]
    );

    // Total revenue (from accepted/completed)
    const revenueResult = await query<{ sum: string | null }>(
      `SELECT SUM(price_estimate_high) as sum FROM quote_submissions
       WHERE shop_id = $1 AND status IN ('accepted', 'completed') AND created_at >= $2 AND created_at <= $3`,
      [shopId, dateFrom, dateTo]
    );

    // Average estimate
    const avgResult = await query<{ avg: string | null }>(
      `SELECT AVG((price_estimate_low + price_estimate_high) / 2) as avg FROM quote_submissions
       WHERE shop_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [shopId, dateFrom, dateTo]
    );

    // Conversion rate
    const conversionResult = await query<{ total: string; converted: string }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status IN ('accepted', 'completed')) as converted
       FROM quote_submissions WHERE shop_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [shopId, dateFrom, dateTo]
    );

    // Top materials
    const materialsResult = await query<{ material: string; count: string }>(
      `SELECT material, COUNT(*) as count FROM quote_submissions
       WHERE shop_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY material ORDER BY count DESC LIMIT 5`,
      [shopId, dateFrom, dateTo]
    );

    // Status breakdown
    const statusResult = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM quote_submissions
       WHERE shop_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY status`,
      [shopId, dateFrom, dateTo]
    );

    // Submissions over time
    const timeGrouping = period === 'day' ? 'YYYY-MM-DD' :
      period === 'week' ? 'IYYY-IW' :
        period === 'year' ? 'YYYY' : 'YYYY-MM';

    const timeResult = await query<{ date: string; count: string; revenue: string | null }>(
      `SELECT
         TO_CHAR(created_at, '${timeGrouping}') as date,
         COUNT(*) as count,
         SUM(CASE WHEN status IN ('accepted', 'completed') THEN price_estimate_high ELSE 0 END) as revenue
       FROM quote_submissions
       WHERE shop_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY TO_CHAR(created_at, '${timeGrouping}')
       ORDER BY date`,
      [shopId, dateFrom, dateTo]
    );

    const totalSubmissions = parseInt(totalResult.rows[0].count, 10);
    const totalConverted = parseInt(conversionResult.rows[0].converted, 10);

    const stats: DashboardStats = {
      totalSubmissions,
      totalRevenue: parseFloat(revenueResult.rows[0].sum || '0'),
      averageEstimate: parseFloat(avgResult.rows[0].avg || '0'),
      conversionRate: totalSubmissions > 0 ? totalConverted / totalSubmissions : 0,
      topMaterials: materialsResult.rows.map(row => ({
        material: row.material as DashboardStats['topMaterials'][0]['material'],
        count: parseInt(row.count, 10),
        percentage: totalSubmissions > 0 ? parseInt(row.count, 10) / totalSubmissions : 0,
      })),
      submissionsOverTime: timeResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count, 10),
        revenue: parseFloat(row.revenue || '0'),
      })),
      statusBreakdown: statusResult.rows.map(row => ({
        status: row.status as SubmissionStatus,
        count: parseInt(row.count, 10),
        percentage: totalSubmissions > 0 ? parseInt(row.count, 10) / totalSubmissions : 0,
      })),
    };

    return reply.send(stats);
  });

  // Update shop settings
  fastify.patch<{ Body: { name?: string; ownerEmail?: string } }>('/v1/admin/shop', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { shopId } = request.user as { shopId: string };
    const { name, ownerEmail } = request.body;

    if (!name && !ownerEmail) {
      return reply.status(400).send({ code: 'VALIDATION_ERROR', message: 'No fields to update' });
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (ownerEmail) {
      updates.push(`owner_email = $${paramIndex++}`);
      params.push(ownerEmail);
    }

    params.push(shopId);

    await query(
      `UPDATE shops SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      params
    );

    return reply.send({ success: true });
  });
}
