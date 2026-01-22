-- PrintForge Database Schema
-- PostgreSQL 14+

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id VARCHAR(255) UNIQUE NOT NULL,  -- Shopify permanent domain
    name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shop pricing configuration
CREATE TABLE IF NOT EXISTS shop_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    pricing_config JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id)
);

-- Quote submissions
CREATE TABLE IF NOT EXISTS quote_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,

    -- Customer details
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    notes TEXT,

    -- Print options
    material VARCHAR(20) NOT NULL,
    colour VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    quality VARCHAR(20) NOT NULL,
    infill INTEGER NOT NULL DEFAULT 20,

    -- File info
    file_key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64),

    -- Slicing results
    bbox_x DECIMAL(10, 2),
    bbox_y DECIMAL(10, 2),
    bbox_z DECIMAL(10, 2),
    filament_grams DECIMAL(10, 2),
    print_time_seconds INTEGER,

    -- Pricing
    price_estimate_low DECIMAL(10, 2),
    price_estimate_high DECIMAL(10, 2),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    magic_link_token VARCHAR(255),
    magic_link_expires_at TIMESTAMP WITH TIME ZONE,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, email)
);

-- Analytics events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    submission_id UUID REFERENCES quote_submissions(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upload sessions (for tracking file uploads)
CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    file_key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slicing cache (to avoid re-slicing identical files)
CREATE TABLE IF NOT EXISTS slicing_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_hash VARCHAR(64) NOT NULL,
    settings_hash VARCHAR(64) NOT NULL,
    print_time_seconds INTEGER NOT NULL,
    filament_grams DECIMAL(10, 2) NOT NULL,
    filament_metres DECIMAL(10, 2) NOT NULL,
    bbox_x DECIMAL(10, 2) NOT NULL,
    bbox_y DECIMAL(10, 2) NOT NULL,
    bbox_z DECIMAL(10, 2) NOT NULL,
    triangle_count INTEGER,
    layer_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(file_hash, settings_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_shop_id ON quote_submissions(shop_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON quote_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON quote_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_material ON quote_submissions(material);
CREATE INDEX IF NOT EXISTS idx_submissions_customer_email ON quote_submissions(customer_email);

CREATE INDEX IF NOT EXISTS idx_events_shop_id ON events(shop_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_submission_id ON events(submission_id);

CREATE INDEX IF NOT EXISTS idx_admin_users_shop_id ON admin_users(shop_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_magic_link_token ON admin_users(magic_link_token);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_shop_id ON upload_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_file_key ON upload_sessions(file_key);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON upload_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_slicing_cache_hashes ON slicing_cache(file_hash, settings_hash);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_shops_updated_at ON shops;
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_pricing_updated_at ON shop_pricing;
CREATE TRIGGER update_shop_pricing_updated_at BEFORE UPDATE ON shop_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_submissions_updated_at ON quote_submissions;
CREATE TRIGGER update_quote_submissions_updated_at BEFORE UPDATE ON quote_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
