import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  round,
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

  return NextResponse.json({
    holdings: enriched.map((h) => ({
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
      priced: h.priced,
    })),
    total_market_value: round(totalMarketValue),
    total_cost: round(enriched.reduce((s, h) => s + h.totalCost, 0)),
    total_pnl: round(enriched.reduce((s, h) => s + (h.pnl || 0), 0)),
    unpriced: enriched.filter((h) => !h.priced).map((h) => h.ticker),
  });
}
