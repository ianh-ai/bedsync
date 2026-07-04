ALTER TABLE shopify_stores
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'shopify',
  ADD COLUMN IF NOT EXISTS wc_consumer_key TEXT,
  ADD COLUMN IF NOT EXISTS wc_consumer_secret TEXT;
