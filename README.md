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

### OAuth redirect in Codespaces (Google login)

If login redirects you to the Vercel domain instead of your Codespace URL, configure Supabase Auth redirect URLs:

1. Open Supabase Dashboard → Authentication → URL Configuration
2. Keep your production Site URL as is (for example Vercel)
3. Add your Codespace callback URL to Additional Redirect URLs:
  - https://YOUR-CODESPACE-NAME-3000.app.github.dev/auth/callback
4. If your Codespace hostname changes, add the new URL again

Note: the app already sends OAuth with the current origin as redirect target; Supabase will only allow URLs that are explicitly configured.

## Dove reperire i file CSV

### Binance

1. Vai in Orders → Assets History
2. In alto a destra clicca il bottone di download (apre Download Center)
3. Pagina diretta: https://www.binance.com/en/my/download-center?type=asset-transaction-history
4. In Data type seleziona Asset History - Transaction History
5. Seleziona time range e formato CSV
6. Clicca Generate

### BCC Inbank

1. Vai in Conti correnti → Lista movimenti
2. Seleziona le date
3. In basso clicca Movimenti conto (.csv)

### Revolut

1. Clicca in alto Estratto conto
2. Seleziona le date
3. Tipo: Excel
4. Genera il file

### Trade Republic

1. Vai in Profilo → Estratti conto
2. Apri Esportazione transazioni
3. Seleziona periodo
4. Crea export

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## Database

Migrations are in `supabase/migrations/`. The schema includes:
- `accounts` — Bank/broker accounts
- `assets` — Tracked assets (ETFs, crypto)
- `transactions` — All imported transactions
- `api_tokens` — API authentication tokens
