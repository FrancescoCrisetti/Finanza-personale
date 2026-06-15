# Finanza Personale

Personal finance tracker with CSV import from multiple brokers/banks and REST API for portfolio analysis.

## Features

- **CSV Import** — Parse and import transactions from:
  - Trade Republic (account statement export)
  - Binance (transaction history export)
  - BCC (movements CSV)
  - Revolut (account statement CSV)
- **Idempotent imports** — Re-importing the same CSV won't create duplicates
- **REST API** — Portfolio summary with cash balances and holdings
- **Dashboard** — Transaction list and import UI

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Supabase (PostgreSQL + Auth)
- Deployed on Vercel

## API Endpoints

### `GET /api/v1/summary`

Returns cash balances per account and current holdings.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "cash": {
    "Trade Republic": 4807.14,
    "BCC": 1682.71,
    "Revolut": 27.12,
    "Binance": 201.45
  },
  "holdings": [
    { "ticker": "EIMI", "type": "etf", "quantity": 33.63, "totalCost": 1251.48 }
  ],
  "total_transactions": 1415
}
```

### `GET /api/v1/transactions`

Returns paginated transaction list.

**Headers:** `Authorization: Bearer <token>`

## Setup

```bash
npm install
cp .env.local.example .env.local  # fill in your keys
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## Database

Migrations are in `supabase/migrations/`. The schema includes:
- `accounts` — Bank/broker accounts
- `assets` — Tracked assets (ETFs, crypto)
- `transactions` — All imported transactions
- `api_tokens` — API authentication tokens
