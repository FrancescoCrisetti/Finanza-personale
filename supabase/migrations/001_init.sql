-- ─────────────────────────────────────
-- ACCOUNTS: conti e portafogli
-- ─────────────────────────────────────
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('bank','broker','exchange')),
  currency VARCHAR(10) DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────
-- ASSETS: strumenti finanziari
-- ─────────────────────────────────────
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  ticker VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  type VARCHAR(10) NOT NULL
    CHECK (type IN ('fiat','crypto','etf')),
  price_api_id VARCHAR(100),
  isin VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────
-- TRANSACTIONS: tutto ciò che accade
-- ─────────────────────────────────────
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  account_id UUID REFERENCES accounts NOT NULL,
  asset_id UUID REFERENCES assets,
  type VARCHAR(20) NOT NULL CHECK (type IN (
    'INCOME',
    'EXPENSE',
    'BUY',
    'SELL',
    'DEPOSIT',
    'WITHDRAW',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'FEE',
    'SAVEBACK',
    'DIVIDEND'
  )),
  quantity DECIMAL(24,8),
  unit_price_eur DECIMAL(18,4),
  amount_eur DECIMAL(14,4) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  source VARCHAR(20) DEFAULT 'MANUAL',
  external_id VARCHAR(100),
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source, external_id)
);

-- ─────────────────────────────────────
-- STRATEGY_VERSIONS: strategia versionata
-- ─────────────────────────────────────
CREATE TABLE strategy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  config JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────
-- API_TOKENS: per accesso esterno
-- ─────────────────────────────────────
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(100) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON strategy_versions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own" ON api_tokens FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────
-- INDEXES per performance
-- ─────────────────────────────────────
CREATE INDEX idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_asset ON transactions(user_id, asset_id);
CREATE INDEX idx_transactions_account ON transactions(user_id, account_id);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);
