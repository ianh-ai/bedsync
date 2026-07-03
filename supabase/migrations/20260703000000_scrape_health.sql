ALTER TABLE tracked_products
  ADD COLUMN IF NOT EXISTS scrape_status text,
  ADD COLUMN IF NOT EXISTS scrape_error text,
  ADD COLUMN IF NOT EXISTS scrape_attempted_at timestamptz;
