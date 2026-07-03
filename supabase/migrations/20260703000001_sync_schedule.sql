ALTER TABLE shopify_stores ADD COLUMN IF NOT EXISTS sync_schedule text DEFAULT 'off';
