import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";

async function fetchAllTransactions(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const PAGE_SIZE = 1000;
  let all: any[] = [];
  let from = 0;

  while (true) {
    const { data } = await supabase
      .from("transactions")
      .select("*, accounts(name), assets(ticker, type)")
      .eq("user_id", userId)
      .range(from, from + PAGE_SIZE - 1);

    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();
  const transactions = await fetchAllTransactions(supabase, auth.userId);

  // Calculate holdings
  const holdings: Record<string, { ticker: string; type: string; quantity: number; totalCost: number }> = {};

  transactions?.forEach((tx) => {
    const asset = tx.assets as any;
    if (!asset?.ticker) return;

    if (!holdings[asset.ticker]) {
      holdings[asset.ticker] = { ticker: asset.ticker, type: asset.type, quantity: 0, totalCost: 0 };
    }

    if (tx.type === "BUY") {
      holdings[asset.ticker].quantity += Number(tx.quantity) || 0;
      holdings[asset.ticker].totalCost += Number(tx.amount_eur);
    } else if (tx.type === "SELL") {
      holdings[asset.ticker].quantity -= Number(tx.quantity) || 0;
      holdings[asset.ticker].totalCost -= Number(tx.amount_eur);
    }
  });

  // Calculate cash per account
  const cashByAccount: Record<string, number> = {};
  transactions?.forEach((tx) => {
    const account = (tx.accounts as any)?.name;
    if (!account) return;
    if (!cashByAccount[account]) cashByAccount[account] = 0;

    if (["DEPOSIT", "INCOME", "TRANSFER_IN", "SAVEBACK", "DIVIDEND"].includes(tx.type)) {
      cashByAccount[account] += Number(tx.amount_eur);
    } else if (["WITHDRAW", "EXPENSE", "TRANSFER_OUT", "BUY", "FEE"].includes(tx.type)) {
      cashByAccount[account] -= Number(tx.amount_eur);
    } else if (tx.type === "SELL") {
      cashByAccount[account] += Number(tx.amount_eur);
    }
  });

  return NextResponse.json({
    holdings: Object.values(holdings).filter((h) => h.quantity > 0),
    cash: cashByAccount,
    total_transactions: transactions?.length || 0,
  });
}
