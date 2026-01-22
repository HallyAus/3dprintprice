import pg from 'pg';
import { config } from 'dotenv';
import * as argon2 from 'argon2';
import { DEFAULT_PRICING_CONFIG } from '@printforge/shared';

config();

async function seed() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🌱 Seeding database...');

    // Create a demo shop
    const shopResult = await pool.query(`
      INSERT INTO shops (shop_id, name, owner_email)
      VALUES ($1, $2, $3)
      ON CONFLICT (shop_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, ['demo-shop.myshopify.com', 'Demo Print Shop', 'owner@example.com']);

    const shopId = shopResult.rows[0].id;
    console.log('✅ Created demo shop:', shopId);

    // Create pricing config
    await pool.query(`
      INSERT INTO shop_pricing (shop_id, pricing_config)
      VALUES ($1, $2)
      ON CONFLICT (shop_id) DO UPDATE SET pricing_config = EXCLUDED.pricing_config
    `, [shopId, JSON.stringify(DEFAULT_PRICING_CONFIG)]);

    console.log('✅ Created default pricing config');

    // Create admin user
    const passwordHash = await argon2.hash('admin123');
    await pool.query(`
      INSERT INTO admin_users (shop_id, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (shop_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [shopId, 'admin@example.com', passwordHash, 'owner']);

    console.log('✅ Created admin user: admin@example.com / admin123');

    // Create some sample submissions
    const materials = ['PLA', 'PETG', 'ABS'];
    const qualities = ['Draft', 'Standard', 'Fine'];
    const statuses = ['pending', 'quoted', 'accepted', 'completed'];

    for (let i = 0; i < 10; i++) {
      const material = materials[Math.floor(Math.random() * materials.length)];
      const quality = qualities[Math.floor(Math.random() * qualities.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const grams = Math.floor(Math.random() * 200) + 20;
      const printTime = Math.floor(Math.random() * 14400) + 1800;

      await pool.query(`
        INSERT INTO quote_submissions (
          shop_id, customer_name, customer_email, customer_phone, notes,
          material, colour, quantity, quality, infill,
          file_key, file_name, file_size, file_hash,
          bbox_x, bbox_y, bbox_z, filament_grams, print_time_seconds,
          price_estimate_low, price_estimate_high, status, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days'
        )
      `, [
        shopId,
        `Customer ${i + 1}`,
        `customer${i + 1}@example.com`,
        `04${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        Math.random() > 0.5 ? 'Please ensure smooth surface finish' : null,
        material,
        ['White', 'Black', 'Grey', 'Blue'][Math.floor(Math.random() * 4)],
        quantity,
        quality,
        [15, 20, 30, 50][Math.floor(Math.random() * 4)],
        `uploads/${Date.now()}-${i}.stl`,
        `model_${i + 1}.stl`,
        Math.floor(Math.random() * 5000000) + 100000,
        `${Math.random().toString(36).substring(2, 15)}`,
        Math.floor(Math.random() * 150) + 10,
        Math.floor(Math.random() * 150) + 10,
        Math.floor(Math.random() * 100) + 5,
        grams,
        printTime,
        (grams * 0.03 + printTime / 3600 * 5) * 0.9 * quantity,
        (grams * 0.03 + printTime / 3600 * 5) * 1.1 * quantity,
        status,
      ]);
    }

    console.log('✅ Created 10 sample submissions');

    // Create some events
    await pool.query(`
      INSERT INTO events (shop_id, type, metadata)
      VALUES
        ($1, 'admin_login', '{"email": "admin@example.com"}'::jsonb),
        ($1, 'pricing_updated', '{"field": "markupPercent", "oldValue": 0.15, "newValue": 0.20}'::jsonb)
    `, [shopId]);

    console.log('✅ Created sample events');

    console.log('\n🎉 Database seeding completed!');
    console.log('\nDemo credentials:');
    console.log('  Shop ID: demo-shop.myshopify.com');
    console.log('  Admin Email: admin@example.com');
    console.log('  Admin Password: admin123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
