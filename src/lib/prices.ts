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

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "finanza-personale/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
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

function resolveCoingeckoId(asset: AssetRow): string | null {
  if (asset.price_api_id) return asset.price_api_id;
  const upper = asset.ticker?.toUpperCase();
  if (upper && COINGECKO_FALLBACK[upper]) return COINGECKO_FALLBACK[upper];
  return asset.ticker ? asset.ticker.toLowerCase() : null;
}

// Recupera il prezzo corrente in EUR per un singolo asset dalla fonte esterna.
async function fetchPriceEur(
  asset: AssetRow
): Promise<{ price_eur: number; native_price: number | null; native_currency: string | null; source: string } | null> {
  if (asset.type === "crypto") {
    const id = resolveCoingeckoId(asset);
    if (!id) return null;
    const price = await fetchCryptoPriceEur(id);
    if (price == null) return null;
    return { price_eur: price, native_price: price, native_currency: "EUR", source: "coingecko" };
  }

  if (asset.type === "etf") {
    const symbol = resolveYahooSymbol(asset);
    if (!symbol) return null;
    const yahoo = await fetchYahooPrice(symbol);
    if (!yahoo) return null;
    const fx = await fetchFxToEur(yahoo.currency);
    if (fx == null) return null;
    return {
      price_eur: yahoo.price * fx,
      native_price: yahoo.price,
      native_currency: yahoo.currency,
      source: "yahoo",
    };
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
  }

  if (upserts.length > 0) {
    await supabase.from("asset_prices").upsert(upserts, { onConflict: "asset_id" });
  }

  return result;
}
