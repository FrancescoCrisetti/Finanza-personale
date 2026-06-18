import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  computePortfolioXirr,
  xirr,
  round,
  type TxRow,
  type CashFlow,
} from "@/lib/analytics";

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

  // XIRR complessivo del portafoglio investito
  const portfolioXirr = computePortfolioXirr(transactions, totalMarketValue);

  // Dividendi totali
  const dividends = transactions
    .filter((t) => t.type === "DIVIDEND")
    .reduce((s, t) => s + (Number(t.amount_eur) || 0), 0);

  // XIRR per singolo asset
  const txByAsset = new Map<string, TxRow[]>();
  for (const t of transactions) {
    if (!t.asset_id) continue;
    if (!txByAsset.has(t.asset_id)) txByAsset.set(t.asset_id, []);
    txByAsset.get(t.asset_id)!.push(t);
  }

  const perAsset = enriched.map((h) => {
    const txs = txByAsset.get(h.asset_id) || [];
    const flows: CashFlow[] = [];
    for (const t of txs) {
      const amount = Number(t.amount_eur) || 0;
      if (t.type === "BUY") flows.push({ date: new Date(t.date), amount: -amount });
      else if (t.type === "SELL") flows.push({ date: new Date(t.date), amount });
      else if (t.type === "DIVIDEND") flows.push({ date: new Date(t.date), amount });
    }
    if (h.marketValue != null) flows.push({ date: new Date(), amount: h.marketValue });
    flows.sort((a, b) => a.date.getTime() - b.date.getTime());
    const rate = xirr(flows);

    return {
      ticker: h.ticker,
      market_value: h.marketValue != null ? round(h.marketValue) : null,
      total_cost: round(h.totalCost),
      pnl: h.pnl != null ? round(h.pnl) : null,
      pnl_pct: h.pnlPct != null ? round(h.pnlPct) : null,
      xirr_pct: rate != null ? round(rate * 100) : null,
    };
  });

  return NextResponse.json({
    portfolio: {
      market_value: round(totalMarketValue),
      total_cost: round(enriched.reduce((s, h) => s + h.totalCost, 0)),
      total_pnl: round(enriched.reduce((s, h) => s + (h.pnl || 0), 0)),
      xirr_pct: portfolioXirr != null ? round(portfolioXirr * 100) : null,
      dividends_total: round(dividends),
    },
    by_asset: perAsset,
    note: "xirr_pct = rendimento annualizzato ponderato per i flussi (money-weighted). null se non calcolabile.",
  });
}
