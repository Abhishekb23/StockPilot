CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL, email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL CHECK(role IN ('manager','staff')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(140) NOT NULL, phone VARCHAR(30), email VARCHAR(160), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sku VARCHAR(50) UNIQUE NOT NULL, name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL, selling_price NUMERIC(12,2) NOT NULL CHECK(selling_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), reorder_level INTEGER NOT NULL DEFAULT 5 CHECK(reorder_level >= 0),
  supplier_id UUID REFERENCES suppliers(id), is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id), user_id UUID NOT NULL REFERENCES users(id),
  movement_type VARCHAR(20) NOT NULL CHECK(movement_type IN ('purchase','sale','adjustment')),
  quantity_change INTEGER NOT NULL CHECK(quantity_change <> 0), note VARCHAR(300), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_search ON products(category,name);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id,created_at DESC);
