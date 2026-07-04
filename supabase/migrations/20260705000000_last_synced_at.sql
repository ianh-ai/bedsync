ALTER TABLE tracked_products
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
