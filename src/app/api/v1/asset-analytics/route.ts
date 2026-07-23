import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  round,
  xirr,
  type TxRow,
  type CashFlow,
} from "@/lib/analytics";
import { getStoredPriceChanges, getPerformanceMetrics } from "@/lib/prices";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  const transactions = await fetchAllTransactions(supabase, auth.userId);
  const { holdings } = computeHoldingsAndRealized(transactions);
  const { holdings: enriched, totalMarketValue } = await enrichHoldingsWithPrices(
    supabase,
    auth.userId,
    holdings,
    { forceRefresh }
  );

  const currentPrices = new Map<string, number>();
  for (const h of enriched) {
    if (h.currentPrice != null) currentPrices.set(h.asset_id, h.currentPrice);
  }

  const changesMap = await getStoredPriceChanges(
    supabase,
    auth.userId,
    enriched.map((h) => h.asset_id),
    currentPrices
  );

  const { perAsset: metricsMap, portfolio: portfolioMetrics } = await getPerformanceMetrics(
    supabase,
    auth.userId,
    enriched.map((h) => ({ asset_id: h.asset_id, quantity: h.quantity }))
  );

  const totalCostPortfolio = enriched.reduce((s, h) => s + h.totalCost, 0);

  // Transazioni raggruppate per asset, per calcolare l'XIRR per singolo strumento.
  const txByAsset = new Map<string, TxRow[]>();
  for (const t of transactions) {
    if (!t.asset_id) continue;
    if (!txByAsset.has(t.asset_id)) txByAsset.set(t.asset_id, []);
    txByAsset.get(t.asset_id)!.push(t);
  }

  const assets = enriched
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
        type: h.type,
        asset_class: h.asset_class,
        quantity: round(h.quantity, 8),
        avg_cost: round(h.avgCost, 4),
        total_cost: round(h.totalCost),
        current_price: h.currentPrice != null ? round(h.currentPrice, 4) : null,
        market_value: h.marketValue != null ? round(h.marketValue) : null,
        pnl: h.pnl != null ? round(h.pnl) : null,
        pnl_pct: h.pnlPct != null ? round(h.pnlPct) : null,
        weight_pct: h.weightPct != null ? round(h.weightPct) : null,
        contribution_pct: totalCostPortfolio > 0 && h.pnl != null ? round((h.pnl / totalCostPortfolio) * 100) : null,
        xirr_pct: assetXirr != null ? round(assetXirr * 100) : null,
        change_1d_pct: changes?.change_1d_pct != null ? round(changes.change_1d_pct) : null,
        change_7d_pct: changes?.change_7d_pct != null ? round(changes.change_7d_pct) : null,
        change_30d_pct: changes?.change_30d_pct != null ? round(changes.change_30d_pct) : null,
        drawdown_pct: metrics?.drawdown_pct != null ? round(metrics.drawdown_pct) : null,
        volatility_pct: metrics?.volatility_pct != null ? round(metrics.volatility_pct) : null,
        history_days: metrics?.history_days || 0,
        priced: h.priced,
      };
    })
    .sort((a, b) => (b.market_value || 0) - (a.market_value || 0));

  return NextResponse.json({
    assets,
    total_market_value: round(totalMarketValue),
    total_cost: round(totalCostPortfolio),
    total_pnl: round(enriched.reduce((s, h) => s + (h.pnl || 0), 0)),
    unpriced: enriched.filter((h) => !h.priced).map((h) => h.ticker),
    portfolio_drawdown_pct: portfolioMetrics.drawdown_pct != null ? round(portfolioMetrics.drawdown_pct) : null,
    portfolio_volatility_pct: portfolioMetrics.volatility_pct != null ? round(portfolioMetrics.volatility_pct) : null,
    portfolio_history_days: portfolioMetrics.history_days,
    note: "change_1d_pct/7d/30d per gli ETF sono calcolate in valuta nativa (senza conversione FX storica). xirr_pct è il rendimento annualizzato money-weighted per singolo asset. drawdown_pct/volatility_pct si basano sullo storico prezzi salvato (asset_price_history) e migliorano nel tempo. contribution_pct = quanti punti percentuali di rendimento sul costo totale del portafoglio ha contribuito questo asset. Le metriche di portafoglio sono una stima basata sulle quantità attuali applicate allo storico prezzi disponibile (non considera la liquidità né variazioni di quantità nel tempo).",
  });
}
