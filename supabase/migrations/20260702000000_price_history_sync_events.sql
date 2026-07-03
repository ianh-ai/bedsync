-- Price history: immutable time-series insert on every scrape
CREATE TABLE price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  size text NOT NULL,
  sale_price numeric NOT NULL,
  regular_price numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON price_history (product_id, recorded_at DESC);
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access their own price history" ON price_history
  FOR ALL USING (
    product_id IN (
      SELECT tp.id FROM tracked_products tp
      JOIN shopify_stores ss ON ss.id = tp.store_id
      WHERE ss.user_id = auth.uid()
    )
  );

-- Sync events: one row per Shopify sync with per-variant before/after details
CREATE TABLE sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  synced_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  details jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX ON sync_events (product_id, synced_at DESC);
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access their own sync events" ON sync_events
  FOR ALL USING (
    product_id IN (
      SELECT tp.id FROM tracked_products tp
      JOIN shopify_stores ss ON ss.id = tp.store_id
      WHERE ss.user_id = auth.uid()
    )
  );
