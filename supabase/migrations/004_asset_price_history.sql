-- ─────────────────────────────────────
-- 004 ASSET_PRICE_HISTORY: storico prezzi giornalieri per analisi variazioni
-- ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  price_eur DECIMAL(18,6) NOT NULL,
  source VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, date)
);

ALTER TABLE asset_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON asset_price_history FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_asset_price_history_asset_date
  ON asset_price_history(asset_id, date DESC);
