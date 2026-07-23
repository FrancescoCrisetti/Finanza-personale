# API Reference — Finanza Personale

Base URL: `https://<domain>/api/v1`

All endpoints require: `Authorization: Bearer <token>`

---

## Endpoints

### GET /api/v1/profile

User profile, accounts, investment strategy, philosophy, and PAC configuration. Call this first to understand who the user is and what their goals are.

**Response:**

```json
{
  "owner": {
    "name": "string",
    "birth_year": "number",
    "location": "string",
    "occupation": "string"
  },
  "accounts": [
    {
      "name": "string",
      "type": "bank | broker | exchange",
      "role": "string"
    }
  ],
  "strategy": {
    "inspiration": "string",
    "pillars": [
      {
        "id": "string",
        "name": "string",
        "status": "active | not_active",
        "target_eur": "number (optional)",
        "description": "string"
      }
    ]
  },
  "philosophy": {
    "etf": "string",
    "crypto": "string",
    "em_overweight": "string",
    "pillar3_trigger": "string"
  },
  "pac_schedule": {
    "frequency": "string",
    "timing": "string",
    "platform": "string",
    "assets": ["string"]
  },
  "notes": "string"
}
```

---

### GET /api/v1/summary

Portfolio snapshot: cash balances per account and current holdings with cost basis.

**Response:**

```json
{
  "cash": {
    "<account_name>": "<number (EUR balance)>"
  },
  "holdings": [
    { "ticker": "string", "type": "etf | crypto", "quantity": "number", "totalCost": "number" }
  ],
  "total_transactions": "number"
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `cash` | object | EUR cash balance per account |
| `holdings[].ticker` | string | Asset ticker or ISIN |
| `holdings[].type` | string | `"etf"` or `"crypto"` |
| `holdings[].quantity` | number | Units held |
| `holdings[].totalCost` | number | Total EUR cost basis |
| `total_transactions` | number | Total imported transactions |

---

### GET /api/v1/transactions

Paginated transaction list, newest first. Use filters to narrow results.

**Query Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | 100 | Results per page (max 1000) |
| `offset` | 0 | Pagination offset |
| `type` | — | Filter by transaction type |
| `account` | — | Filter by account name |
| `account_id` | — | Filter by account id (UUID). More precise alternative to `account` |
| `from` | — | Min date inclusive (`YYYY-MM-DD`). Usable alone or with `to` |
| `to` | — | Max date inclusive (`YYYY-MM-DD`). Usable alone or with `from` |

**Transaction Types:**

| Type | Cash effect | Description |
|------|-------------|-------------|
| `DEPOSIT` | +cash | External money in |
| `WITHDRAW` | -cash | External money out |
| `BUY` | -cash, +asset | Purchase ETF/crypto |
| `SELL` | +cash, -asset | Sale ETF/crypto |
| `INCOME` | +cash | Interest, cashback, tax refunds, card refunds |
| `EXPENSE` | -cash | Card payments, subscriptions |
| `TRANSFER_IN` | +cash | From own account |
| `TRANSFER_OUT` | -cash | To own account |
| `FEE` | -cash | Fees, taxes |
| `DIVIDEND` | +cash | Dividend payout |

**Response:**

```json
{
  "transactions": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD",
      "type": "string",
      "quantity": "number | null",
      "amount_eur": "number",
      "description": "string",
      "category": "string",
      "accounts": { "name": "string" },
      "assets": { "ticker": "string", "type": "string" } | null
    }
  ],
  "count": "number"
}
```

---

### GET /api/v1/holdings

Posizioni con valore di mercato attuale, costo medio, P&L e peso %. Prezzi: CoinGecko (crypto) + Yahoo Finance (ETF), con cache 30 min. Usa `?refresh=1` per forzare l'aggiornamento.

```json
{
  "holdings": [
    { "ticker": "string", "name": "string", "type": "etf|crypto", "asset_class": "string|null",
      "quantity": "number", "avg_cost": "number", "total_cost": "number",
      "current_price": "number|null", "market_value": "number|null",
      "pnl": "number|null", "pnl_pct": "number|null", "weight_pct": "number|null", "priced": "boolean" }
  ],
  "total_market_value": "number",
  "total_cost": "number",
  "total_pnl": "number",
  "unpriced": ["string"]
}
```

---

### GET /api/v1/asset-analytics

Scheda analitica per ogni posizione: prezzo, variazioni % 1g/7g/30g, PnL, peso e XIRR per singolo asset. Prezzi con cache 30 min, variazioni calcolate on-demand da Yahoo Finance (ETF) e CoinGecko (crypto). Usa `?refresh=1` per forzare l'aggiornamento dei prezzi.

```json
{
  "assets": [
    { "ticker": "string", "name": "string", "type": "etf|crypto", "asset_class": "string|null",
      "quantity": "number", "avg_cost": "number", "total_cost": "number",
      "current_price": "number|null", "market_value": "number|null",
      "pnl": "number|null", "pnl_pct": "number|null", "weight_pct": "number|null",
      "contribution_pct": "number|null",
      "xirr_pct": "number|null",
      "change_1d_pct": "number|null", "change_7d_pct": "number|null", "change_30d_pct": "number|null",
      "drawdown_pct": "number|null", "volatility_pct": "number|null", "history_days": "number",
      "priced": "boolean" }
  ],
  "total_market_value": "number",
  "total_cost": "number",
  "total_pnl": "number",
  "unpriced": ["string"],
  "portfolio_drawdown_pct": "number|null",
  "portfolio_volatility_pct": "number|null",
  "portfolio_history_days": "number",
  "note": "string"
}
```

Nota: per gli ETF le variazioni % sono calcolate in valuta nativa dello strumento (senza rifare la conversione FX storica giorno per giorno). `drawdown_pct`/`volatility_pct` si basano sullo storico salvato in `asset_price_history` e migliorano progressivamente con l'uso dell'app. Le metriche di portafoglio sono una stima (quantità attuali applicate allo storico prezzi disponibile, senza liquidità).

---

### GET /api/v1/allocation

Asset allocation per classe, posizione e (se taggati) area geografica e settore. Include il cash. `?refresh=1` per aggiornare i prezzi.

```json
{
  "total_cash": "number",
  "by_class": [{ "key": "string", "value": "number", "weightPct": "number" }],
  "by_position": [{ "key": "string", "value": "number", "weightPct": "number" }],
  "by_region": [{ "key": "string", "value": "number", "weightPct": "number" }],
  "by_sector": [{ "key": "string", "value": "number", "weightPct": "number" }]
}
```

---

### GET /api/v1/networth

Patrimonio netto = valore di mercato investito + cash + asset esterni − passività.

```json
{
  "net_worth": "number",
  "total_assets": "number",
  "total_liabilities": "number",
  "breakdown": { "invested_market_value": "number", "cash": "number", "external_assets": "number" },
  "cash_by_account": { "<account>": "number" },
  "external_assets": [{ "name": "string", "type": "string", "value_eur": "number" }],
  "liabilities": [{ "name": "string", "type": "string", "amount_eur": "number", "interest_rate": "number|null", "monthly_payment": "number|null" }]
}
```

---

### GET /api/v1/cashflow

Flussi di cassa mensili e tasso di risparmio. `?months=N` per gli ultimi N mesi. `income`=INCOME+DIVIDEND+SAVEBACK, `expense`=EXPENSE+FEE, `invested`=BUY−SELL.

```json
{
  "monthly": [{ "month": "YYYY-MM", "income": "number", "expense": "number", "net": "number", "invested": "number", "savingsRate": "number|null" }],
  "totals": { "income": "number", "expense": "number", "net": "number", "invested": "number", "savingsRate": "number|null" }
}
```

---

### GET /api/v1/performance

XIRR (rendimento annualizzato money-weighted) complessivo e per asset, P&L e dividendi totali. `?refresh=1` per aggiornare i prezzi.

```json
{
  "portfolio": { "market_value": "number", "total_cost": "number", "total_pnl": "number", "xirr_pct": "number|null", "dividends_total": "number" },
  "by_asset": [{ "ticker": "string", "market_value": "number|null", "total_cost": "number", "pnl": "number|null", "pnl_pct": "number|null", "xirr_pct": "number|null" }]
}
```

---

### GET /api/v1/tax

Plus/minusvalenze realizzate per anno (metodo costo medio), dividendi e zainetto fiscale (minusvalenze compensabili, scadenza 4 anni, inserite manualmente). Valori indicativi, non consulenza fiscale.

```json
{
  "by_year": [{ "year": "number", "realizedGain": "number", "realizedLoss": "number", "net": "number", "dividends": "number" }],
  "tax_shield": { "total_available": "number", "entries": [{ "year": "number", "amount_eur": "number", "expires_year": "number", "expired": "boolean" }] }
}
```

---

### GET /api/v1/alerts

Alert attivi sul portafoglio: soglie di prezzo per asset (configurabili nella pagina Asset), asset con prezzo non aggiornato da oltre 3 giorni, e deviazione dell'allocazione reale rispetto ai target configurati in Impostazioni > Allocazione target (se presenti).

```json
{
  "alerts": [{ "type": "price_above|price_below|allocation_deviation|stale_price", "severity": "warning|info", "message": "string" }],
  "count": "number",
  "note": "string"
}
```

---

## Errors

```json
{ "error": "Unauthorized", "status": 401 }
```

| Status | Meaning |
|--------|---------|
| 401 | Invalid or missing token |
| 500 | Server error |

---

## Workflow for AI agents

1. **Start** → call `/profile` for user context, risk profile, goals, accounts
2. **Net worth** → call `/networth` for the full picture (assets − liabilities)
3. **Portfolio** → call `/holdings` (market value + P&L) and `/allocation` (diversification)
4. **Performance** → call `/performance` for XIRR and returns
5. **Cash flow** → call `/cashflow` for income/expenses and savings rate
6. **Tax** → call `/tax` for realized gains/losses and tax shield
7. **Deep dive** → call `/transactions` with filters for granular detail
8. **Alerts** → call `/alerts` for price threshold breaches, stale prices, and allocation drift

Use Python `urllib.request` to make calls. Pass the token via `Authorization: Bearer <token>` header.
