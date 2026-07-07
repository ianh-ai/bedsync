ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sync_all_last_run_at TIMESTAMPTZ;
