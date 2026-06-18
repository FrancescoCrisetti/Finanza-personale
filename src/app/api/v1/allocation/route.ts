import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  computeCashByAccount,
  computeAllocation,
  round,
} from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  const transactions = await fetchAllTransactions(supabase, auth.userId);
  const { holdings } = computeHoldingsAndRealized(transactions);
  const { holdings: enriched } = await enrichHoldingsWithPrices(supabase, auth.userId, holdings, {
    forceRefresh,
  });

  const cashByAccount = computeCashByAccount(transactions);
  const totalCash = Object.values(cashByAccount).reduce((s, v) => s + v, 0);

  const allocation = computeAllocation(enriched, totalCash);

  return NextResponse.json({
    total_cash: round(totalCash),
    by_class: allocation.byClass,
    by_position: allocation.byPosition,
    by_region: allocation.byRegion,
    by_sector: allocation.bySector,
    note: "by_region e by_sector sono popolati solo per gli asset con tag region/sector impostati.",
  });
}
