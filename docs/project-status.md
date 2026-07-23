# Stato dell'arte

Ultimo aggiornamento: 2026-07-22
Owner: Team Finanza-personale

## Obiettivo del progetto
Tracciatore di finanza personale con import CSV da banche/broker, persistenza su Supabase e API REST per analisi portfolio.

## Stack attuale
- Next.js 16 (App Router, TypeScript)
- Supabase (PostgreSQL + Auth)
- Tailwind CSS 4

## Stato operativo
- Build: OK (`npm run build`)
- Dev server: da verificare dopo configurazione completa delle variabili ambiente
- Auth middleware: presente, con controllo variabili ambiente Supabase

## Funzionalita presenti
- Import CSV (Trade Republic, Binance, BCC, Revolut)
- Deduplicazione transazioni in import
- Dashboard con sezioni account, asset, transazioni, impostazioni
- API v1 per summary, transactions, holdings, networth, performance, tax, strategy e altre route

## Rischi aperti
- Configurazione ambiente locale non completa finche non e impostata `SUPABASE_SERVICE_ROLE_KEY`
- Warning Next.js su deprecazione convenzione `middleware` verso `proxy`

## Decisioni recenti
- Reinstallate dipendenze npm per ripristinare binding nativo Tailwind (`@tailwindcss/oxide`)
- Aggiunta gestione esplicita errore env mancanti nel middleware

## Prossimo aggiornamento
Aggiornare questa pagina quando cambia uno tra:
- stato build/dev
- architettura API o auth
- dipendenze core
- rischio bloccante
