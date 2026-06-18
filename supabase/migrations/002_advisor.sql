-- ─────────────────────────────────────
-- 002 ADVISOR: dati per analisi finanziaria avanzata
-- ─────────────────────────────────────

-- ── PROFILES: profilo utente (sposta i dati hardcoded su DB) ──
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users NOT NULL,
  name VARCHAR(100),
  birth_year INTEGER,
  location VARCHAR(100),
  occupation VARCHAR(100),
  -- filosofia di investimento
  philosophy_etf TEXT,
  philosophy_crypto TEXT,
  philosophy_em_overweight TEXT,
  philosophy_pillar3_trigger TEXT,
  -- piano di accumulo
  pac_frequency VARCHAR(50),
  pac_timing VARCHAR(50),
  pac_platform VARCHAR(100),
  pac_assets TEXT[],
  -- profilo di rischio
  risk_score INTEGER CHECK (risk_score BETWEEN 1 AND 7),
  risk_tolerance TEXT,
  -- contesto
  dependents INTEGER,
  income_stability VARCHAR(50),
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── LIABILITIES: passività / debiti ──
CREATE TABLE IF NOT EXISTS liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('mortgage','loan','credit','other')),
  amount_eur DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(6,3),
  monthly_payment DECIMAL(12,2),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── EXTERNAL_ASSETS: asset non tracciati (immobili, TFR, pensione, ecc.) ──
CREATE TABLE IF NOT EXISTS external_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('real_estate','pension','tfr','cash','other')),
  value_eur DECIMAL(14,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'EUR',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── GOALS: obiettivi finanziari ──
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(100) NOT NULL,
  target_eur DECIMAL(14,2) NOT NULL,
  current_eur DECIMAL(14,2) DEFAULT 0,
  target_date DATE,
  priority INTEGER DEFAULT 3,
  pillar VARCHAR(10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ASSET_PRICES: cache prezzi correnti ──
CREATE TABLE IF NOT EXISTS asset_prices (
  asset_id UUID PRIMARY KEY REFERENCES assets ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users NOT NULL,
  price_eur DECIMAL(18,6) NOT NULL,
  native_price DECIMAL(18,6),
  native_currency VARCHAR(10),
  source VARCHAR(30),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TAX_CAPITAL_LOSSES: zainetto fiscale (minusvalenze a credito) ──
CREATE TABLE IF NOT EXISTS tax_capital_losses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  year INTEGER NOT NULL,
  amount_eur DECIMAL(14,2) NOT NULL,
  expires_year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tag di classificazione su ASSETS (per asset allocation) ──
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_class VARCHAR(20);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS region VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sector VARCHAR(50);

-- ─────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_capital_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON liabilities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON external_assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON asset_prices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON tax_capital_losses FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_liabilities_user ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_external_assets_user ON external_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_losses_user ON tax_capital_losses(user_id);
