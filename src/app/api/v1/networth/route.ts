import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  computeCashByAccount,
  round,
} from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  const [transactions, { data: liabilities }, { data: externalAssets }] = await Promise.all([
    fetchAllTransactions(supabase, auth.userId),
    supabase.from("liabilities").select("*").eq("user_id", auth.userId),
    supabase.from("external_assets").select("*").eq("user_id", auth.userId),
  ]);

  const { holdings } = computeHoldingsAndRealized(transactions);
  const { holdings: enriched, totalMarketValue } = await enrichHoldingsWithPrices(
    supabase,
    auth.userId,
    holdings,
    { forceRefresh }
  );

  const cashByAccount = computeCashByAccount(transactions);
  const totalCash = Object.values(cashByAccount).reduce((s, v) => s + v, 0);

  const externalTotal = (externalAssets || []).reduce((s, e) => s + Number(e.value_eur), 0);
  const liabilitiesTotal = (liabilities || []).reduce((s, l) => s + Number(l.amount_eur), 0);

  const financialAssets = totalMarketValue + totalCash;
  const totalAssets = financialAssets + externalTotal;
  const netWorth = totalAssets - liabilitiesTotal;

  return NextResponse.json({
    net_worth: round(netWorth),
    total_assets: round(totalAssets),
    total_liabilities: round(liabilitiesTotal),
    breakdown: {
      invested_market_value: round(totalMarketValue),
      cash: round(totalCash),
      external_assets: round(externalTotal),
    },
    cash_by_account: Object.fromEntries(
      Object.entries(cashByAccount).map(([k, v]) => [k, round(v)])
    ),
    external_assets: (externalAssets || []).map((e) => ({
      name: e.name,
      type: e.type,
      value_eur: round(Number(e.value_eur)),
    })),
    liabilities: (liabilities || []).map((l) => ({
      name: l.name,
      type: l.type,
      amount_eur: round(Number(l.amount_eur)),
      interest_rate: l.interest_rate != null ? Number(l.interest_rate) : null,
      monthly_payment: l.monthly_payment != null ? round(Number(l.monthly_payment)) : null,
    })),
    unpriced: enriched.filter((h) => !h.priced).map((h) => h.ticker),
  });
}
