-- Add soft-delete support and denormalized user_id to tracked_products
ALTER TABLE tracked_products
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_id     UUID REFERENCES auth.users;

-- Back-fill user_id from the joined shopify_stores row
UPDATE tracked_products tp
SET    user_id = ss.user_id
FROM   shopify_stores ss
WHERE  tp.store_id = ss.id
  AND  tp.user_id IS NULL;

-- Index for subscription limit lookups (brand count per user)
CREATE INDEX IF NOT EXISTS tracked_products_user_id_brand_idx
  ON tracked_products (user_id, brand)
  WHERE deleted_at IS NULL;
