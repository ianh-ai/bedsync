CREATE TABLE user_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  shopify_domain text NOT NULL,
  shopify_access_token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own store" ON user_stores
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
