-- Centralized daily-scrape price cache, keyed by (brand, url, variant_filter).
-- Populated by scripts/daily-scrape.ts (service role); the sync route reads the
-- latest rows per key instead of scraping on-demand. New rows are inserted on
-- every scrape (no upsert) so we can look at scraped_at to judge freshness.
CREATE TABLE brand_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  url text NOT NULL,
  variant_filter text,
  size text NOT NULL,
  regular_price numeric NOT NULL,
  sale_price numeric,
  scraped_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON brand_prices (brand, url, variant_filter, scraped_at DESC);

-- Service-role only — the daily scraper and the sync route both use the admin
-- client, no anon/authenticated access is needed for this shared cache table.
ALTER TABLE brand_prices ENABLE ROW LEVEL SECURITY;
