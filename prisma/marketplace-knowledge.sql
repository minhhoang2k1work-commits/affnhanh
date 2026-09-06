-- Additive and safe to re-run. No existing product data is changed.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "marketplaceData" JSONB;
