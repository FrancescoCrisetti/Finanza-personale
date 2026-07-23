import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  xirr,
  type TxRow,
  type CashFlow,
} from "@/lib/analytics";
import { getStoredPriceChanges, getPerformanceMetrics, getPriceHistorySeries } from "@/lib/prices";
import { InvestmentsView, type InvestmentRow } from "./investments-view";

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const service = createServiceClient();

  const transactions = await fetchAllTransactions(service, user.id);
  const { holdings } = computeHoldingsAndRealized(transactions);
  const { holdings: enriched } = await enrichHoldingsWithPrices(service, user.id, holdings);
  const active = enriched.filter((h) => h.quantity > 0);

  const currentPrices = new Map<string, number>();
  for (const h of active) {
    if (h.currentPrice != null) currentPrices.set(h.asset_id, h.currentPrice);
  }

  const changesMap = await getStoredPriceChanges(
    service,
    user.id,
    active.map((h) => h.asset_id),
    currentPrices
  );

  const { perAsset: metricsMap, portfolio: portfolioMetrics } = await getPerformanceMetrics(
    service,
    user.id,
    active.map((h) => ({ asset_id: h.asset_id, quantity: h.quantity }))
  );

  const totalCostPortfolio = active.reduce((s, h) => s + h.totalCost, 0);

  const priceHistoryMap = await getPriceHistorySeries(
    service,
    user.id,
    active.map((h) => h.asset_id)
  );

  const txByAsset = new Map<string, TxRow[]>();
  for (const t of transactions) {
    if (!t.asset_id) continue;
    if (!txByAsset.has(t.asset_id)) txByAsset.set(t.asset_id, []);
    txByAsset.get(t.asset_id)!.push(t);
  }

  const rows: InvestmentRow[] = active
    .map((h) => {
      const txs = txByAsset.get(h.asset_id) || [];
      const flows: CashFlow[] = [];
      for (const t of txs) {
        const amount = Number(t.amount_eur) || 0;
        if (t.type === "BUY") flows.push({ date: new Date(t.date), amount: -amount });
        else if (t.type === "SELL" || t.type === "DIVIDEND") flows.push({ date: new Date(t.date), amount });
      }
      if (h.marketValue != null) flows.push({ date: new Date(), amount: h.marketValue });
      const assetXirr = xirr(flows);
      const changes = changesMap.get(h.asset_id) || null;
      const metrics = metricsMap.get(h.asset_id) || null;

      return {
        ticker: h.ticker,
        name: h.name,
        assetClass: h.asset_class || "other",
        quantity: h.quantity,
        avgCost: h.avgCost,
        currentPrice: h.currentPrice,
        marketValue: h.marketValue,
        pnl: h.pnl,
        pnlPct: h.pnlPct,
        weightPct: h.weightPct,
        contributionPct: totalCostPortfolio > 0 && h.pnl != null ? (h.pnl / totalCostPortfolio) * 100 : null,
        xirrPct: assetXirr != null ? assetXirr * 100 : null,
        change1d: changes?.change_1d_pct ?? null,
        change7d: changes?.change_7d_pct ?? null,
        change30d: changes?.change_30d_pct ?? null,
        drawdownPct: metrics?.drawdown_pct ?? null,
        volatilityPct: metrics?.volatility_pct ?? null,
        priceHistory: priceHistoryMap.get(h.asset_id) || [],
        priced: h.priced,
      };
    })
    .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Investimenti</h1>
      <InvestmentsView rows={rows} portfolioMetrics={portfolioMetrics} />
    </div>
  );
}
