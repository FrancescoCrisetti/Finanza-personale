-- ─────────────────────────────────────
-- 005 ALERTS: soglie di prezzo e deviazione da allocazione target
-- ─────────────────────────────────────

-- ── Soglie di prezzo configurabili per asset ──
ALTER TABLE assets ADD COLUMN IF NOT EXISTS alert_price_above DECIMAL(18,6);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS alert_price_below DECIMAL(18,6);

-- ── ALLOCATION_TARGETS: allocazione target per classe di asset ──
CREATE TABLE IF NOT EXISTS allocation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  asset_class VARCHAR(20) NOT NULL,
  target_pct DECIMAL(5,2) NOT NULL,
  tolerance_pct DECIMAL(5,2) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_class)
);

ALTER TABLE allocation_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON allocation_targets FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_allocation_targets_user ON allocation_targets(user_id);
