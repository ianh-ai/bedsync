-- Per-size price guardrails for tracked products.
-- Shape: {"Queen": {"floor": 800, "ceiling": 1500}, "King": {"floor": 1000}}
-- Each size key is optional; floor and ceiling within it are both optional.
ALTER TABLE tracked_products ADD COLUMN IF NOT EXISTS guardrails jsonb;
