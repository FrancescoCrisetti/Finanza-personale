-- ─────────────────────────────────────
-- 006 NET_WORTH_SNAPSHOTS: storico giornaliero del patrimonio netto
-- ─────────────────────────────────────
-- Popolata da un cron giornaliero (vedi /api/v1/cron/snapshot-networth) e,
-- come rete di sicurezza, dal caricamento della dashboard se manca lo
-- snapshot del giorno corrente. A differenza di asset_price_history non
-- esiste una fonte esterna da cui fare backfill: i giorni mancanti restano
-- vuoti nel grafico.

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  net_worth DECIMAL(18,2) NOT NULL,
  total_assets DECIMAL(18,2) NOT NULL,
  total_liabilities DECIMAL(18,2) NOT NULL,
  invested_market_value DECIMAL(18,2) NOT NULL,
  cash DECIMAL(18,2) NOT NULL,
  external_assets DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON net_worth_snapshots FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_date ON net_worth_snapshots(user_id, date);
