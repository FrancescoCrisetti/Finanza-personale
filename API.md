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

1. **Start** → call `/profile` to understand user context, strategy, accounts
2. **Analyze** → call `/summary` for current balances and positions
3. **Deep dive** → call `/transactions` with filters when details are needed (e.g. spending analysis, PAC history, income breakdown)

Use Python `urllib.request` to make calls. Pass the token via `Authorization: Bearer <token>` header.
