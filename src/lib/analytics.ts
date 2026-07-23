import { createServiceClient } from "@/lib/supabase/service";
import { getAssetPrices, type AssetRow, type PriceResult } from "@/lib/prices";

type SupabaseService = ReturnType<typeof createServiceClient>;

export interface TxRow {
  id: string;
  date: string;
  type: string;
  quantity: number | null;
  amount_eur: number;
  unit_price_eur: number | null;
  category: string | null;
  description: string | null;
  account_id: string;
  asset_id: string | null;
  accounts?: { name: string } | null;
  assets?: AssetRow | null;
}

export interface Holding {
  asset_id: string;
  ticker: string;
  name: string | null;
  type: string;
  asset_class: string | null;
  region: string | null;
  sector: string | null;
  quantity: number;
  totalCost: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  weightPct: number | null;
  priced: boolean;
}

export interface RealizedLot {
  asset_id: string;
  ticker: string;
  date: string;
  proceeds: number;
  costBasis: number;
  gain: number;
  type: string; // 'etf' | 'crypto'
}

const CASH_IN = ["DEPOSIT", "INCOME", "TRANSFER_IN", "SAVEBACK", "DIVIDEND"];
const CASH_OUT = ["WITHDRAW", "EXPENSE", "TRANSFER_OUT", "BUY", "FEE"];

export async function fetchAllTransactions(supabase: SupabaseService, userId: string): Promise<TxRow[]> {
  const PAGE_SIZE = 1000;
  let all: TxRow[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("transactions")
      .select("*, accounts(name), assets(id, ticker, name, type, isin, price_api_id, asset_class, region, sector)")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data as TxRow[]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// ── Holdings con costo medio + plusvalenze realizzate (metodo costo medio) ──
export function computeHoldingsAndRealized(transactions: TxRow[]): {
  holdings: Map<string, Holding>;
  realized: RealizedLot[];
} {
  const holdings = new Map<string, Holding>();
  const realized: RealizedLot[] = [];

  for (const tx of transactions) {
    const asset = tx.assets;
    if (!asset?.id || !tx.quantity) continue;

    let h = holdings.get(asset.id);
    if (!h) {
      h = {
        asset_id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        type: asset.type,
        asset_class: asset.asset_class ?? null,
        region: asset.region ?? null,
        sector: asset.sector ?? null,
        quantity: 0,
        totalCost: 0,
        avgCost: 0,
        currentPrice: null,
        marketValue: null,
        pnl: null,
        pnlPct: null,
        weightPct: null,
        priced: false,
      };
      holdings.set(asset.id, h);
    }

    const qty = Number(tx.quantity) || 0;
    const amount = Number(tx.amount_eur) || 0;

    if (tx.type === "BUY") {
      h.quantity += qty;
      h.totalCost += amount;
    } else if (tx.type === "SELL") {
      const avg = h.quantity > 0 ? h.totalCost / h.quantity : 0;
      const costBasis = avg * qty;
      realized.push({
        asset_id: asset.id,
        ticker: asset.ticker,
        date: tx.date,
        proceeds: amount,
        costBasis,
        gain: amount - costBasis,
        type: asset.type,
      });
      h.quantity -= qty;
      h.totalCost -= costBasis;
      if (h.quantity < 1e-9) {
        h.quantity = 0;
        h.totalCost = 0;
      }
    }

    h.avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
  }

  return { holdings, realized };
}

// ── Arricchisce le holdings con i prezzi di mercato ──
export async function enrichHoldingsWithPrices(
  supabase: SupabaseService,
  userId: string,
  holdings: Map<string, Holding>,
  options: { forceRefresh?: boolean } = {}
): Promise<{ holdings: Holding[]; totalMarketValue: number; pricedValue: number }> {
  const active = [...holdings.values()].filter((h) => h.quantity > 0);

  const assetRows: AssetRow[] = active.map((h) => ({
    id: h.asset_id,
    ticker: h.ticker,
    name: h.name,
    type: h.type,
    isin: null,
    price_api_id: null,
  }));

  // Recupera price_api_id reale dagli asset
  const { data: assetMeta } = await supabase
    .from("assets")
    .select("id, ticker, type, isin, price_api_id")
    .eq("user_id", userId)
    .in(
      "id",
      active.map((h) => h.asset_id)
    );
  const metaMap = new Map<string, { isin: string | null; price_api_id: string | null }>();
  for (const m of (assetMeta as Array<{ id: string; isin: string | null; price_api_id: string | null }> | null) || []) {
    metaMap.set(m.id, { isin: m.isin, price_api_id: m.price_api_id });
  }
  for (const a of assetRows) {
    const m = metaMap.get(a.id);
    if (m) {
      a.isin = m.isin;
      a.price_api_id = m.price_api_id;
    }
  }

  const prices: Map<string, PriceResult> = await getAssetPrices(supabase, userId, assetRows, options);

  let totalMarketValue = 0;
  for (const h of active) {
    const p = prices.get(h.asset_id);
    if (p) {
      h.currentPrice = p.price_eur;
      h.marketValue = p.price_eur * h.quantity;
      h.pnl = h.marketValue - h.totalCost;
      h.pnlPct = h.totalCost > 0 ? (h.pnl / h.totalCost) * 100 : null;
      h.priced = true;
      totalMarketValue += h.marketValue;
    }
  }

  const pricedValue = totalMarketValue;
  for (const h of active) {
    if (h.marketValue != null && pricedValue > 0) {
      h.weightPct = (h.marketValue / pricedValue) * 100;
    }
  }

  return { holdings: active, totalMarketValue, pricedValue };
}

// ── Cash per conto ──
export function computeCashByAccount(transactions: TxRow[]): Record<string, number> {
  const cash: Record<string, number> = {};
  for (const tx of transactions) {
    const account = tx.accounts?.name;
    if (!account) continue;
    if (!cash[account]) cash[account] = 0;
    const amount = Number(tx.amount_eur) || 0;
    if (CASH_IN.includes(tx.type)) cash[account] += amount;
    else if (CASH_OUT.includes(tx.type)) cash[account] -= amount;
    else if (tx.type === "SELL") cash[account] += amount;
  }
  return cash;
}

// ── Cash flow mensile + tasso di risparmio ──
export interface MonthlyCashflow {
  month: string;
  income: number;
  expense: number;
  net: number;
  invested: number;
  savingsRate: number | null;
}

export function computeCashflow(transactions: TxRow[]): {
  monthly: MonthlyCashflow[];
  totals: { income: number; expense: number; net: number; invested: number; savingsRate: number | null };
} {
  const INCOME = ["INCOME", "DIVIDEND", "SAVEBACK"];
  const EXPENSE = ["EXPENSE", "FEE"];

  const byMonth = new Map<string, { income: number; expense: number; invested: number }>();

  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    let m = byMonth.get(month);
    if (!m) {
      m = { income: 0, expense: 0, invested: 0 };
      byMonth.set(month, m);
    }
    const amount = Number(tx.amount_eur) || 0;
    if (INCOME.includes(tx.type)) m.income += amount;
    else if (EXPENSE.includes(tx.type)) m.expense += amount;
    if (tx.type === "BUY") m.invested += amount;
    else if (tx.type === "SELL") m.invested -= amount;
  }

  const monthly: MonthlyCashflow[] = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => {
      const net = v.income - v.expense;
      return {
        month,
        income: round(v.income),
        expense: round(v.expense),
        net: round(net),
        invested: round(v.invested),
        savingsRate: v.income > 0 ? round((net / v.income) * 100) : null,
      };
    });

  const tIncome = monthly.reduce((s, m) => s + m.income, 0);
  const tExpense = monthly.reduce((s, m) => s + m.expense, 0);
  const tInvested = monthly.reduce((s, m) => s + m.invested, 0);
  const tNet = tIncome - tExpense;

  return {
    monthly,
    totals: {
      income: round(tIncome),
      expense: round(tExpense),
      net: round(tNet),
      invested: round(tInvested),
      savingsRate: tIncome > 0 ? round((tNet / tIncome) * 100) : null,
    },
  };
}

// ── XIRR (rendimento ponderato per i flussi) ──
export interface CashFlow {
  date: Date;
  amount: number;
}

export function xirr(flows: CashFlow[], guess = 0.1): number | null {
  if (flows.length < 2) return null;
  const hasPos = flows.some((f) => f.amount > 0);
  const hasNeg = flows.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());

  const t0 = sorted[0].date.getTime();
  const years = (d: Date) => (d.getTime() - t0) / (365 * 24 * 3600 * 1000);

  const npv = (rate: number) =>
    sorted.reduce((s, f) => s + f.amount / Math.pow(1 + rate, years(f.date)), 0);
  const dnpv = (rate: number) =>
    sorted.reduce((s, f) => {
      const t = years(f.date);
      return s - (t * f.amount) / Math.pow(1 + rate, t + 1);
    }, 0);

  // Find a valid bracket [low, high] where NPV changes sign.
  // If no sign change exists, XIRR is not well-defined for these flows.
  const low = -0.9999;
  let high = 1;
  let fLow = npv(low);
  let fHigh = npv(high);

  while (fLow * fHigh > 0 && high < 1e6) {
    high *= 2;
    fHigh = npv(high);
  }

  if (!isFinite(fLow) || !isFinite(fHigh) || fLow * fHigh > 0) return null;

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate);
    const deriv = dnpv(rate);
    if (Math.abs(deriv) < 1e-10) break;
    const next = rate - value / deriv;
    if (!isFinite(next)) return null;
    if (Math.abs(next - rate) < 1e-7) return next;
    rate = next;
  }

  // Fallback to bisection inside the valid bracket for stability.
  let left = low;
  let right = high;
  let fLeft = npv(left);

  for (let i = 0; i < 120; i++) {
    const mid = (left + right) / 2;
    const fMid = npv(mid);
    if (!isFinite(fMid)) return null;
    if (Math.abs(fMid) < 1e-8 || Math.abs(right - left) < 1e-8) return mid;

    if (fLeft * fMid <= 0) {
      right = mid;
    } else {
      left = mid;
      fLeft = fMid;
    }
  }

  const result = (left + right) / 2;
  return isFinite(result) && result > -0.9999 ? result : null;
}

// Flussi per XIRR del portafoglio investito (BUY out, SELL/DIVIDEND in + valore attuale).
export function computePortfolioXirr(transactions: TxRow[], terminalValue: number): number | null {
  const flows: CashFlow[] = [];
  for (const tx of transactions) {
    const amount = Number(tx.amount_eur) || 0;
    if (tx.type === "BUY") flows.push({ date: new Date(tx.date), amount: -amount });
    else if (tx.type === "SELL") flows.push({ date: new Date(tx.date), amount });
    else if (tx.type === "DIVIDEND") flows.push({ date: new Date(tx.date), amount });
  }
  if (flows.length === 0) return null;
  flows.push({ date: new Date(), amount: terminalValue });
  flows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return xirr(flows);
}

// ── Fisco: plus/minus realizzate per anno ──
export interface TaxYear {
  year: number;
  realizedGain: number;
  realizedLoss: number;
  net: number;
  dividends: number;
}

export function computeTax(realized: RealizedLot[], transactions: TxRow[]): TaxYear[] {
  const byYear = new Map<number, TaxYear>();
  const ensure = (year: number) => {
    let y = byYear.get(year);
    if (!y) {
      y = { year, realizedGain: 0, realizedLoss: 0, net: 0, dividends: 0 };
      byYear.set(year, y);
    }
    return y;
  };

  for (const lot of realized) {
    const year = new Date(lot.date).getFullYear();
    const y = ensure(year);
    if (lot.gain >= 0) y.realizedGain += lot.gain;
    else y.realizedLoss += Math.abs(lot.gain);
    y.net += lot.gain;
  }

  for (const tx of transactions) {
    if (tx.type === "DIVIDEND") {
      const year = new Date(tx.date).getFullYear();
      ensure(year).dividends += Number(tx.amount_eur) || 0;
    }
  }

  return [...byYear.values()]
    .map((y) => ({
      year: y.year,
      realizedGain: round(y.realizedGain),
      realizedLoss: round(y.realizedLoss),
      net: round(y.net),
      dividends: round(y.dividends),
    }))
    .sort((a, b) => b.year - a.year);
}

// ── Asset allocation ──
export interface AllocationSlice {
  key: string;
  value: number;
  weightPct: number;
}

export function computeAllocation(
  holdings: Holding[],
  cash: number
): {
  byClass: AllocationSlice[];
  byPosition: AllocationSlice[];
  byRegion: AllocationSlice[];
  bySector: AllocationSlice[];
} {
  const activeHoldings = holdings.filter((h) => h.quantity > 0);
  const valueForAllocation = (h: Holding) => (h.marketValue != null ? h.marketValue : h.totalCost);
  const total = activeHoldings.reduce((s, h) => s + valueForAllocation(h), 0) + cash;

  const classMap = new Map<string, number>();
  const posMap = new Map<string, number>();
  const regionMap = new Map<string, number>();
  const sectorMap = new Map<string, number>();

  if (cash > 0) classMap.set("cash", cash);

  for (const h of activeHoldings) {
    const mv = valueForAllocation(h);
    if (mv <= 0) continue;
    const cls = h.asset_class || (h.type === "crypto" ? "crypto" : h.type === "etf" ? "equity" : "other");
    classMap.set(cls, (classMap.get(cls) || 0) + mv);
    posMap.set(h.ticker, (posMap.get(h.ticker) || 0) + mv);
    if (h.region) regionMap.set(h.region, (regionMap.get(h.region) || 0) + mv);
    if (h.sector) sectorMap.set(h.sector, (sectorMap.get(h.sector) || 0) + mv);
  }

  const toSlices = (m: Map<string, number>): AllocationSlice[] =>
    [...m.entries()]
      .map(([key, value]) => ({ key, value: round(value), weightPct: total > 0 ? round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value);

  return {
    byClass: toSlices(classMap),
    byPosition: toSlices(posMap),
    byRegion: toSlices(regionMap),
    bySector: toSlices(sectorMap),
  };
}

export function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
