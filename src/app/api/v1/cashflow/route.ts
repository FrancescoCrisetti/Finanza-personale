import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllTransactions, computeCashflow } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();
  const months = parseInt(request.nextUrl.searchParams.get("months") || "0");

  const transactions = await fetchAllTransactions(supabase, auth.userId);
  const { monthly, totals } = computeCashflow(transactions);

  const limited = months > 0 ? monthly.slice(-months) : monthly;

  return NextResponse.json({
    monthly: limited,
    totals,
    note: "income = INCOME+DIVIDEND+SAVEBACK; expense = EXPENSE+FEE; invested = BUY-SELL; savingsRate = net/income.",
  });
}
