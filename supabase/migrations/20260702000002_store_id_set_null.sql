-- Change tracked_products.store_id FK from ON DELETE CASCADE to ON DELETE SET NULL
-- so unlinking a Shopify store preserves tracked products.
ALTER TABLE tracked_products
  DROP CONSTRAINT IF EXISTS tracked_products_store_id_fkey;

ALTER TABLE tracked_products
  ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE tracked_products
  ADD CONSTRAINT tracked_products_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES shopify_stores(id) ON DELETE SET NULL;
