# AGENTS.md

## Project Overview

Personal finance tracker. Imports CSV bank/broker exports, stores in Supabase, exposes REST API for AI agents to analyze portfolio data.

**Stack:** Next.js 16 (App Router, TypeScript), Supabase (PostgreSQL + Auth), Tailwind CSS 4, Vercel deployment.

## Commands

```bash
npm run dev      # Dev server on :3000
npm run build    # Production build
npm run lint     # TypeScript + ESLint
npm run test     # Vitest - unit test per i parser CSV
```

## Architecture

```
src/app/api/v1/       → REST API (Bearer token auth via api-auth.ts)
src/app/(dashboard)/  → UI pages, route group (no URL segment): /dashboard, /transactions, /accounts, /assets, /investments, /settings/* (Supabase session auth via middleware.ts)
src/lib/parsers/      → CSV parsers (one per bank/broker)
src/lib/supabase/     → DB clients (client.ts=browser, server.ts=SSR, service.ts=API)
supabase/migrations/  → SQL schema
```

## Key Conventions

- **Parsers** export `parseXxxTransactions(csvText: string): ParsedTransaction[]`. All amounts are positive EUR; direction is determined by `type` field.
- **Deduplication**: `UNIQUE(user_id, source, external_id)` on transactions. Use upsert with `ignoreDuplicates: true`.
- **API auth**: Bearer token matched against `api_tokens.token_hash`. Service client bypasses RLS.
- **UI auth**: Supabase session + optional `ALLOWED_EMAIL` env restriction.
- **Cash calculation**: DEPOSIT/INCOME/TRANSFER_IN/SAVEBACK/DIVIDEND add to cash. WITHDRAW/EXPENSE/TRANSFER_OUT/BUY/FEE subtract. SELL adds.
- **Import page** groups CSV rows by minute (Binance) or matches by transaction_id (others).

## Transaction Types

`BUY`, `SELL`, `DEPOSIT`, `WITHDRAW`, `EXPENSE`, `INCOME`, `TRANSFER_IN`, `TRANSFER_OUT`, `FEE`, `DIVIDEND`

## Database Schema

See [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql). Tables: `accounts`, `assets`, `transactions`, `strategy_versions`, `api_tokens`. All have RLS with `auth.uid() = user_id`.

## API Documentation

See [API.md](API.md) for full endpoint reference.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (API routes) |
| `ALLOWED_EMAIL` | No | Restrict login to single email |

## Pitfalls

- Supabase REST default limit is 1000 rows. API routes use `fetchAllTransactions()` with pagination loop.
- Binance CSV splits buy/spend rows by 1 second — parser groups by minute to match them.
- Trade Republic card refunds have positive `amount` in CARD_TRANSACTION rows.
- Italian CSV formats: dates as DD/MM/YYYY, amounts with comma decimal (`1.234,56`).
- Do not produce documentation after code changes unless explicitly asked.
