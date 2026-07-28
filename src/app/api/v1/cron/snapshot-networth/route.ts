import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeNetWorthSnapshot } from "@/lib/analytics";

// Chiamata giornaliera da Vercel Cron (vedi vercel.json). Vercel invia
// automaticamente l'header "Authorization: Bearer $CRON_SECRET" quando la
// env var CRON_SECRET è configurata sul progetto.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: accountRows } = await supabase.from("accounts").select("user_id");
  const userIds = [...new Set((accountRows || []).map((a) => a.user_id as string))];

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const userId of userIds) {
    const snapshot = await computeNetWorthSnapshot(supabase, userId);
    const { error } = await supabase.from("net_worth_snapshots").upsert(
      {
        user_id: userId,
        date: today,
        net_worth: snapshot.netWorth,
        total_assets: snapshot.totalAssets,
        total_liabilities: snapshot.totalLiabilities,
        invested_market_value: snapshot.investedMarketValue,
        cash: snapshot.cash,
        external_assets: snapshot.externalAssets,
      },
      { onConflict: "user_id,date" }
    );
    if (!error) created++;
  }

  return NextResponse.json({ ok: true, date: today, snapshots_created: created });
}
