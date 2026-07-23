# Features da implementare

Ultimo aggiornamento: 2026-07-23

## Cosa manca adesso

### Bloccanti operativi (P0)
- [x] Configurazione completa ambiente locale e verifica login end-to-end con Supabase (nuova pagina `/settings/diagnostics`: verifica env var, connessione Supabase, sessione utente; scope semplificato per app single-user, nessun test multi-utente RLS necessario)
- [x] Validazione flusso import CSV in ambiente dev con dati reali (confermato dall'utente il 2026-07-23: import CSV reali eseguito con successo)

### Priorita alta (P1)
- [x] Aggiungere file `.env.local.example` allineato alle variabili richieste
- [x] Introdurre test automatizzati minimi per parser CSV critici (vitest, 11 test su bcc/binance/revolut/trade-republic)
- [x] Gestire e monitorare warning Next.js su migrazione da `middleware` a `proxy` (migrato `src/middleware.ts` -> `src/proxy.ts`, funzione rinominata `proxy`, warning sparito dalla build)

### Roadmap ETF/Crypto ancora aperta
- [ ] Grafico andamento patrimonio nel tempo (richiede nuova tabella snapshot net worth storico)

## Backlog prioritizzato

## P0 - Bloccanti
- [x] Configurazione completa ambiente locale e verifica login end-to-end con Supabase
- [x] Validazione flusso import CSV in ambiente dev con dati reali

## P1 - Alta priorita
- [x] Aggiungere file `.env.local.example` allineato alle variabili richieste
- [x] Introdurre test automatizzati minimi per parser CSV critici
- [x] Gestire e monitorare warning Next.js su migrazione da `middleware` a `proxy`

## P2 - Migliorie
- [ ] Definire metriche base di qualita dati (transazioni scartate, duplicate, invalide)
- [ ] Migliorare UX import con messaggi di errore piu specifici per ogni parser

## Idee future
- [ ] Alert periodici su variazioni net worth e cashflow
- [ ] Export report mensile (CSV/PDF)
- [ ] Obiettivi finanziari con tracking avanzamento

## Analisi ETF e Crypto (roadmap dedicata)

Obiettivo: vedere per ogni ETF/crypto acquistato tutti i dati utili (prezzo attuale, variazioni, PnL, peso, rendimento) per analizzare l'andamento degli investimenti.

### Fase 1 - Pricing affidabile (completata)
- [x] Fallback automatico simboli Yahoo per ETF (suffissi borsa .MI/.DE/.L/.AS/.PA/.SW)
- [x] Auto-salvataggio `price_api_id` risolto su `assets`
- [x] Allocazione per classe include anche asset non ancora prezzati (fallback su costo)
- [x] Colonne prezzo/fonte/aggiornamento nella pagina Asset

### Fase 2 - Scheda analitica ETF/Crypto (completata)
- [x] Variazioni % 1 giorno / 7 giorni / 30 giorni per asset (lette da `asset_price_history`, storicizzate ad ogni refresh prezzo + backfill una tantum, nessuna chiamata Yahoo/CoinGecko ad ogni reload pagina)
- [x] Nuovo endpoint API `/api/v1/asset-analytics` con dati completi per asset (prezzo, variazioni, PnL, peso, XIRR)
- [x] Nuova pagina dashboard "Investimenti" con filtro e tabelle separate per classe di asset (Azionario, Obbligazionario, Crypto, Materie prime, Liquidità, Altro)
- [x] Segnalazione asset non prezzati o con dati mancanti

### Fase 3 - Metriche di performance avanzate (completata)
- [x] Tabella storicizzazione prezzi giornalieri (`asset_price_history`, migrazione applicata e collegata al codice)
- [x] XIRR per singolo asset esposto nella scheda (già disponibile in `/api/v1/performance`, `/api/v1/asset-analytics` e nella pagina Investimenti)
- [x] Drawdown storico per asset/portafoglio (basato su `asset_price_history`, la profondità migliora nel tempo)
- [x] Volatilità rolling annualizzata per asset/portafoglio (basata su `asset_price_history`)
- [x] Contributo al rendimento complessivo per asset (`contribution_pct` = PnL asset / costo totale portafoglio)

### Fase 4 - Monitoraggio e alert (completata)
- [x] Soglie di prezzo configurabili per asset (`alert_price_above`/`alert_price_below` sulla pagina Asset)
- [x] Alert su deviazione da allocazione target (nuova pagina Impostazioni > Allocazione target, tabella `allocation_targets`)
- [x] Segnalazione asset con prezzo non aggiornato da oltre 3 giorni
- [x] Retry automatico (con backoff) su rate-limit/errore delle API esterne (Yahoo/CoinGecko) + fallback al prezzo in cache già esistente

### Fase 5 - Grafici e visualizzazioni
- [x] Libreria di charting (Recharts)
- [x] Grafico a torta/donut allocazione per classe (dashboard overview)
- [x] Grafico a barre cashflow mensile (entrate vs uscite, ultimi 6 mesi, dashboard overview)
- [x] Sparkline prezzo storico per asset nella pagina Investimenti (usa `asset_price_history`)
- [ ] Grafico andamento patrimonio nel tempo (rimandato: richiede una nuova tabella di snapshot giornaliero, dato che `external_assets`/`liabilities` non hanno storicizzazione e `asset_price_history` copre solo gli ultimi ~30gg)

## Regole di aggiornamento backlog
- Aggiornare stato e priorita dopo ogni task completato
- Spostare in cima i blocchi che impattano build, auth o import
- Mantenere descrizioni brevi e verificabili
