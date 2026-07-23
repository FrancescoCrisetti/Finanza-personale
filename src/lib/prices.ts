import { createServiceClient } from "@/lib/supabase/service";

type SupabaseService = ReturnType<typeof createServiceClient>;

export interface AssetRow {
  id: string;
  ticker: string;
  name: string | null;
  type: string; // 'etf' | 'crypto' | 'fiat'
  isin: string | null;
  price_api_id: string | null;
  asset_class?: string | null;
  region?: string | null;
  sector?: string | null;
}

export interface PriceResult {
  asset_id: string;
  price_eur: number;
  native_price: number | null;
  native_currency: string | null;
  source: string;
  updated_at: string;
}

interface PriceFetchResult {
  price_eur: number;
  native_price: number | null;
  native_currency: string | null;
  source: string;
  resolvedApiId?: string | null;
}

const CACHE_MAX_AGE_MINUTES = 30;

// Mapping di fallback ticker -> id CoinGecko per le crypto più comuni.
const COINGECKO_FALLBACK: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  LTC: "litecoin",
  USDT: "tether",
  USDC: "usd-coin",
};

const YAHOO_SUFFIX_FALLBACKS = ["", ".MI", ".DE", ".L", ".AS", ".PA", ".SW"];

// Numero di tentativi extra in caso di rate-limit (429) o errore di rete transitorio.
const FETCH_MAX_RETRIES = 2;

async function fetchJson(url: string, attempt = 0): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "finanza-personale/1.0" },
      cache: "no-store",
    });
    if (res.status === 429 && attempt < FETCH_MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    if (attempt < FETCH_MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    return null;
  }
}

// Prezzo ETF/azione da Yahoo Finance (non ufficiale). Restituisce prezzo e valuta nativa.
async function fetchYahooPrice(symbol: string): Promise<{ price: number; currency: string } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const data = (await fetchJson(url)) as
    | { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; currency?: string } }> } }
    | null;
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  return { price: meta.regularMarketPrice, currency: meta.currency || "EUR" };
}

// Tasso di cambio: 1 unità di `currency` in EUR.
const fxCache: Record<string, { rate: number; ts: number }> = {};
async function fetchFxToEur(currency: string): Promise<number | null> {
  const cur = currency.toUpperCase();
  if (cur === "EUR") return 1;

  const cached = fxCache[cur];
  if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.rate;

  // Yahoo pair es. USDEUR=X
  const yahoo = await fetchYahooPrice(`${cur}EUR=X`);
  if (yahoo && yahoo.price > 0) {
    fxCache[cur] = { rate: yahoo.price, ts: Date.now() };
    return yahoo.price;
  }
  return null;
}

// Prezzo crypto in EUR da CoinGecko.
async function fetchCryptoPriceEur(coingeckoId: string): Promise<number | null> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=eur`;
  const data = (await fetchJson(url)) as Record<string, { eur?: number }> | null;
  const price = data?.[coingeckoId]?.eur;
  return typeof price === "number" ? price : null;
}

function resolveYahooSymbol(asset: AssetRow): string | null {
  if (asset.price_api_id) return asset.price_api_id;
  if (asset.ticker) return asset.ticker;
  return null;
}

function resolveYahooCandidates(asset: AssetRow): string[] {
  const base = resolveYahooSymbol(asset);
  if (!base) return [];

  if (asset.price_api_id) return [asset.price_api_id];

  const upper = base.toUpperCase();
  const hasSuffix = /\.[A-Z]{1,4}$/.test(upper);
  if (hasSuffix) return [upper];

  return YAHOO_SUFFIX_FALLBACKS.map((suffix) => `${upper}${suffix}`);
}

function resolveCoingeckoId(asset: AssetRow): string | null {
  if (asset.price_api_id) return asset.price_api_id;
  const upper = asset.ticker?.toUpperCase();
  if (upper && COINGECKO_FALLBACK[upper]) return COINGECKO_FALLBACK[upper];
  return asset.ticker ? asset.ticker.toLowerCase() : null;
}

// Recupera il prezzo corrente in EUR per un singolo asset dalla fonte esterna.
async function fetchPriceEur(
  asset: AssetRow
): Promise<PriceFetchResult | null> {
  if (asset.type === "crypto") {
    const id = resolveCoingeckoId(asset);
    if (!id) return null;
    const price = await fetchCryptoPriceEur(id);
    if (price == null) return null;
    return {
      price_eur: price,
      native_price: price,
      native_currency: "EUR",
      source: "coingecko",
      resolvedApiId: asset.price_api_id || id,
    };
  }

  if (asset.type === "etf") {
    const candidates = resolveYahooCandidates(asset);
    for (const symbol of candidates) {
      const yahoo = await fetchYahooPrice(symbol);
      if (!yahoo) continue;
      const fx = await fetchFxToEur(yahoo.currency);
      if (fx == null) continue;
      return {
        price_eur: yahoo.price * fx,
        native_price: yahoo.price,
        native_currency: yahoo.currency,
        source: "yahoo",
        resolvedApiId: symbol,
      };
    }
    return null;
  }

  // fiat: 1 EUR (i saldi cash sono già in EUR)
  return null;
}

// Restituisce i prezzi in EUR per gli asset richiesti, usando la cache e
// aggiornando le voci scadute o mancanti dalla fonte esterna.
export async function getAssetPrices(
  supabase: SupabaseService,
  userId: string,
  assets: AssetRow[],
  options: { forceRefresh?: boolean } = {}
): Promise<Map<string, PriceResult>> {
  const result = new Map<string, PriceResult>();
  if (assets.length === 0) return result;

  const { data: cached } = await supabase
    .from("asset_prices")
    .select("*")
    .eq("user_id", userId)
    .in(
      "asset_id",
      assets.map((a) => a.id)
    );

  const cacheMap = new Map<string, PriceResult>();
  for (const row of (cached as PriceResult[] | null) || []) {
    cacheMap.set(row.asset_id, row);
  }

  const now = Date.now();
  const toRefresh: AssetRow[] = [];

  for (const asset of assets) {
    if (asset.type === "fiat") continue;
    const cachedRow = cacheMap.get(asset.id);
    const fresh =
      cachedRow &&
      !options.forceRefresh &&
      now - new Date(cachedRow.updated_at).getTime() < CACHE_MAX_AGE_MINUTES * 60 * 1000;

    if (fresh) {
      result.set(asset.id, cachedRow);
    } else {
      toRefresh.push(asset);
    }
  }

  // Aggiorna in parallelo gli asset scaduti/mancanti.
  const refreshed = await Promise.all(
    toRefresh.map(async (asset) => {
      const price = await fetchPriceEur(asset);
      return { asset, price };
    })
  );

  const upserts: Array<Record<string, unknown>> = [];
  const assetsToPatch: Array<{ id: string; price_api_id: string }> = [];
  for (const { asset, price } of refreshed) {
    if (!price) {
      // se il refresh fallisce ma c'è un valore in cache, usalo comunque
      const cachedRow = cacheMap.get(asset.id);
      if (cachedRow) result.set(asset.id, cachedRow);
      continue;
    }
    const row: PriceResult = {
      asset_id: asset.id,
      price_eur: price.price_eur,
      native_price: price.native_price,
      native_currency: price.native_currency,
      source: price.source,
      updated_at: new Date().toISOString(),
    };
    result.set(asset.id, row);
    upserts.push({ ...row, user_id: userId });

    if (!asset.price_api_id && price.resolvedApiId) {
      assetsToPatch.push({ id: asset.id, price_api_id: price.resolvedApiId });
    }
  }

  if (upserts.length > 0) {
    await supabase.from("asset_prices").upsert(upserts, { onConflict: "asset_id" });
  }

  if (assetsToPatch.length > 0) {
    await Promise.all(
      assetsToPatch.map((a) =>
        supabase
          .from("assets")
          .update({ price_api_id: a.price_api_id })
          .eq("id", a.id)
          .eq("user_id", userId)
      )
    );
  }

  // Storicizza il prezzo del giorno + eventuale backfill (usa le stesse chiamate
  // esterne del refresh appena fatto, non aggiunge nuove chiamate al caricamento pagina).
  if (refreshed.length > 0) {
    await saveHistorySnapshotsAndBackfill(supabase, userId, refreshed);
  }

  return result;
}

// ─── Storico prezzi (asset_price_history) + variazioni % 1g/7g/30g ───
// Le variazioni si calcolano leggendo lo storico salvato su DB: non viene
// chiamato Yahoo/CoinGecko ad ogni caricamento pagina, solo quando il prezzo
// corrente viene rinfrescato (cache scaduta, ogni 30 min) o per il backfill iniziale.

export interface PriceChangeResult {
  change_1d_pct: number | null;
  change_7d_pct: number | null;
  change_30d_pct: number | null;
}

async function fetchYahooChartSeries(
  symbol: string
): Promise<{ timestamps: number[]; closes: number[] } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  const data = (await fetchJson(url)) as
    | {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: (number | null)[] }> };
          }>;
        };
      }
    | null;
  const chartResult = data?.chart?.result?.[0];
  const timestamps = chartResult?.timestamp;
  const closes = chartResult?.indicators?.quote?.[0]?.close;
  if (!timestamps?.length || !closes?.length) return null;

  const cleanTimestamps: number[] = [];
  const cleanCloses: number[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === "number") {
      cleanTimestamps.push(timestamps[i] * 1000);
      cleanCloses.push(c);
    }
  }
  if (cleanCloses.length === 0) return null;
  return { timestamps: cleanTimestamps, closes: cleanCloses };
}

async function fetchCoingeckoSeries(
  id: string
): Promise<{ timestamps: number[]; prices: number[] } | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=30&interval=daily`;
  const data = (await fetchJson(url)) as { prices?: [number, number][] } | null;
  if (!data?.prices?.length) return null;
  return {
    timestamps: data.prices.map((p) => p[0]),
    prices: data.prices.map((p) => p[1]),
  };
}

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Dopo un refresh di prezzo, salva lo snapshot del giorno e, se l'asset non ha
// ancora storico sufficiente, esegue un backfill una tantum (fino a 30gg) usando
// la stessa fonte già usata per il prezzo corrente (nessuna chiamata extra ripetuta).
async function saveHistorySnapshotsAndBackfill(
  supabase: SupabaseService,
  userId: string,
  refreshed: Array<{ asset: AssetRow; price: PriceFetchResult | null }>
): Promise<void> {
  const todayStr = toDateStr(Date.now());
  const rows: Array<Record<string, unknown>> = [];

  for (const { asset, price } of refreshed) {
    if (!price) continue;
    rows.push({
      asset_id: asset.id,
      user_id: userId,
      date: todayStr,
      price_eur: price.price_eur,
      source: price.source,
    });
  }

  if (rows.length > 0) {
    await supabase.from("asset_price_history").upsert(rows, { onConflict: "asset_id,date" });
  }

  // Verifica quali asset hanno poco storico e meritano un backfill.
  const assetIds = refreshed.map((r) => r.asset.id);
  if (assetIds.length === 0) return;

  const { data: historyCounts } = await supabase
    .from("asset_price_history")
    .select("asset_id")
    .eq("user_id", userId)
    .in("asset_id", assetIds);

  const countMap = new Map<string, number>();
  for (const row of (historyCounts as Array<{ asset_id: string }> | null) || []) {
    countMap.set(row.asset_id, (countMap.get(row.asset_id) || 0) + 1);
  }

  const needsBackfill = refreshed.filter(
    (r) => r.price && (countMap.get(r.asset.id) || 0) < 5
  );
  if (needsBackfill.length === 0) return;

  const backfillRows: Array<Record<string, unknown>> = [];

  await Promise.all(
    needsBackfill.map(async ({ asset, price }) => {
      if (!price) return;
      if (asset.type === "crypto") {
        const id = resolveCoingeckoId(asset);
        if (!id) return;
        const series = await fetchCoingeckoSeries(id);
        if (!series) return;
        for (let i = 0; i < series.timestamps.length; i++) {
          backfillRows.push({
            asset_id: asset.id,
            user_id: userId,
            date: toDateStr(series.timestamps[i]),
            price_eur: series.prices[i],
            source: "coingecko",
          });
        }
      } else if (asset.type === "etf") {
        const candidates = resolveYahooCandidates(asset);
        for (const symbol of candidates) {
          const series = await fetchYahooChartSeries(symbol);
          if (!series) continue;
          // Converte lo storico in EUR usando il tasso di cambio corrente (approssimazione).
          const fxRate = price.native_currency && price.native_price ? price.price_eur / price.native_price : 1;
          for (let i = 0; i < series.timestamps.length; i++) {
            backfillRows.push({
              asset_id: asset.id,
              user_id: userId,
              date: toDateStr(series.timestamps[i]),
              price_eur: series.closes[i] * fxRate,
              source: "yahoo",
            });
          }
          break;
        }
      }
    })
  );

  if (backfillRows.length > 0) {
    await supabase.from("asset_price_history").upsert(backfillRows, { onConflict: "asset_id,date" });
  }
}

// Trova il valore più recente con data <= target; se non esiste, usa il più vecchio disponibile.
function valueAtOrBefore(dates: string[], values: number[], targetDate: string): number | null {
  let best: number | null = null;
  let bestDate = "";
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] <= targetDate && dates[i] > bestDate) {
      bestDate = dates[i];
      best = values[i];
    }
  }
  if (best == null && values.length > 0) best = values[0];
  return best;
}

function pctChange(current: number, past: number | null): number | null {
  if (past == null || past === 0) return null;
  return ((current - past) / past) * 100;
}

// Calcola le variazioni % (1g/7g/30g) leggendo lo storico salvato su DB
// (nessuna chiamata a Yahoo/CoinGecko). `currentPrices` è la mappa dei prezzi
// correnti già risolta da getAssetPrices/enrichHoldingsWithPrices.
export async function getStoredPriceChanges(
  supabase: SupabaseService,
  userId: string,
  assetIds: string[],
  currentPrices: Map<string, number>
): Promise<Map<string, PriceChangeResult>> {
  const map = new Map<string, PriceChangeResult>();
  if (assetIds.length === 0) return map;

  const since = toDateStr(Date.now() - 31 * 24 * 3600 * 1000);
  const { data } = await supabase
    .from("asset_price_history")
    .select("asset_id, date, price_eur")
    .eq("user_id", userId)
    .in("asset_id", assetIds)
    .gte("date", since)
    .order("date", { ascending: true });

  const byAsset = new Map<string, { dates: string[]; prices: number[] }>();
  for (const row of (data as Array<{ asset_id: string; date: string; price_eur: number }> | null) || []) {
    if (!byAsset.has(row.asset_id)) byAsset.set(row.asset_id, { dates: [], prices: [] });
    const entry = byAsset.get(row.asset_id)!;
    entry.dates.push(row.date);
    entry.prices.push(Number(row.price_eur));
  }

  const now = Date.now();
  const oneDayAgo = toDateStr(now - 24 * 3600 * 1000);
  const sevenDaysAgo = toDateStr(now - 7 * 24 * 3600 * 1000);
  const thirtyDaysAgo = toDateStr(now - 30 * 24 * 3600 * 1000);

  for (const assetId of assetIds) {
    const history = byAsset.get(assetId);
    const current = currentPrices.get(assetId);
    if (!history || current == null || history.dates.length === 0) continue;

    map.set(assetId, {
      change_1d_pct: pctChange(current, valueAtOrBefore(history.dates, history.prices, oneDayAgo)),
      change_7d_pct: pctChange(current, valueAtOrBefore(history.dates, history.prices, sevenDaysAgo)),
      change_30d_pct: pctChange(current, valueAtOrBefore(history.dates, history.prices, thirtyDaysAgo)),
    });
  }

  return map;
}

// ─── Drawdown, volatilità (Fase 3 - Metriche di performance avanzate) ───
// Basate esclusivamente sullo storico salvato in asset_price_history (nessuna
// chiamata esterna). La profondità dello storico cresce nel tempo (backfill
// iniziale ~30gg), quindi queste metriche diventano più significative con l'uso.

export interface PerformanceMetrics {
  drawdown_pct: number | null;
  volatility_pct: number | null;
  history_days: number;
}

// Massima perdita percentuale da un picco al minimo successivo (valore <= 0).
function computeDrawdownPct(prices: number[]): number | null {
  if (prices.length < 2) return null;
  let peak = prices[0];
  let maxDrawdown = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    if (peak > 0) {
      const dd = (p - peak) / peak;
      if (dd < maxDrawdown) maxDrawdown = dd;
    }
  }
  return maxDrawdown * 100;
}

// Volatilità annualizzata (deviazione standard dei rendimenti giornalieri * sqrt(252)).
function computeVolatilityPct(prices: number[]): number | null {
  if (prices.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

// Drawdown e volatilità per singolo asset + una stima per il portafoglio
// complessivo (somma quantità_corrente * prezzo storico, senza liquidità;
// approssimazione che assume quantità costante nel periodo osservato).
export async function getPerformanceMetrics(
  supabase: SupabaseService,
  userId: string,
  holdings: Array<{ asset_id: string; quantity: number }>
): Promise<{
  perAsset: Map<string, PerformanceMetrics>;
  portfolio: PerformanceMetrics;
}> {
  const perAsset = new Map<string, PerformanceMetrics>();
  const assetIds = holdings.map((h) => h.asset_id);
  const empty: PerformanceMetrics = { drawdown_pct: null, volatility_pct: null, history_days: 0 };
  if (assetIds.length === 0) return { perAsset, portfolio: empty };

  const { data } = await supabase
    .from("asset_price_history")
    .select("asset_id, date, price_eur")
    .eq("user_id", userId)
    .in("asset_id", assetIds)
    .order("date", { ascending: true });

  const byAsset = new Map<string, { dates: string[]; prices: number[] }>();
  for (const row of (data as Array<{ asset_id: string; date: string; price_eur: number }> | null) || []) {
    if (!byAsset.has(row.asset_id)) byAsset.set(row.asset_id, { dates: [], prices: [] });
    const entry = byAsset.get(row.asset_id)!;
    entry.dates.push(row.date);
    entry.prices.push(Number(row.price_eur));
  }

  for (const assetId of assetIds) {
    const series = byAsset.get(assetId);
    if (!series || series.prices.length === 0) {
      perAsset.set(assetId, empty);
      continue;
    }
    perAsset.set(assetId, {
      drawdown_pct: computeDrawdownPct(series.prices),
      volatility_pct: computeVolatilityPct(series.prices),
      history_days: series.prices.length,
    });
  }

  // Serie approssimata del portafoglio: per ogni data disponibile, somma
  // quantità_corrente * prezzo (forward-fill sui giorni mancanti per singolo asset).
  const allDates = Array.from(new Set([...byAsset.values()].flatMap((s) => s.dates))).sort();
  const quantityByAsset = new Map(holdings.map((h) => [h.asset_id, h.quantity]));
  const lastKnown = new Map<string, number>();
  const portfolioSeries: number[] = [];

  for (const date of allDates) {
    let total = 0;
    let hasAny = false;
    for (const [assetId, series] of byAsset.entries()) {
      const idx = series.dates.indexOf(date);
      if (idx !== -1) lastKnown.set(assetId, series.prices[idx]);
      const price = lastKnown.get(assetId);
      const qty = quantityByAsset.get(assetId) || 0;
      if (price != null && qty > 0) {
        total += price * qty;
        hasAny = true;
      }
    }
    if (hasAny) portfolioSeries.push(total);
  }

  return {
    perAsset,
    portfolio: {
      drawdown_pct: computeDrawdownPct(portfolioSeries),
      volatility_pct: computeVolatilityPct(portfolioSeries),
      history_days: portfolioSeries.length,
    },
  };
}

// Serie storica dei prezzi (ordinata per data) per asset, usata per le sparkline
// nella pagina Investimenti. Nessuna chiamata esterna, solo lettura da
// asset_price_history.
export async function getPriceHistorySeries(
  supabase: SupabaseService,
  userId: string,
  assetIds: string[]
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (assetIds.length === 0) return result;

  const { data } = await supabase
    .from("asset_price_history")
    .select("asset_id, date, price_eur")
    .eq("user_id", userId)
    .in("asset_id", assetIds)
    .order("date", { ascending: true });

  for (const row of (data as Array<{ asset_id: string; date: string; price_eur: number }> | null) || []) {
    if (!result.has(row.asset_id)) result.set(row.asset_id, []);
    result.get(row.asset_id)!.push(Number(row.price_eur));
  }

  return result;
}

