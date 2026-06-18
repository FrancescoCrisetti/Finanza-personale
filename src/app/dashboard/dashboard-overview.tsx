import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  computeCashByAccount,
  computeAllocation,
  computePortfolioXirr,
} from "@/lib/analytics";

function eur(n: number): string {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

const CLASS_LABELS: Record<string, string> = {
  equity: "Azionario",
  bond: "Obbligazionario",
  crypto: "Crypto",
  commodity: "Materie prime",
  cash: "Liquidità",
  other: "Altro",
};

const CLASS_COLORS: Record<string, string> = {
  equity: "bg-blue-500",
  bond: "bg-emerald-500",
  crypto: "bg-amber-500",
  commodity: "bg-purple-500",
  cash: "bg-gray-400",
  other: "bg-rose-500",
};

export async function DashboardOverview({ userId }: { userId: string }) {
  const supabase = createServiceClient();

  const [transactions, { data: liabilities }, { data: externalAssets }] = await Promise.all([
    fetchAllTransactions(supabase, userId),
    supabase.from("liabilities").select("amount_eur").eq("user_id", userId),
    supabase.from("external_assets").select("value_eur").eq("user_id", userId),
  ]);

  if (transactions.length === 0) return null;

  const { holdings } = computeHoldingsAndRealized(transactions);
  const { holdings: enriched, totalMarketValue } = await enrichHoldingsWithPrices(supabase, userId, holdings);

  const cashByAccount = computeCashByAccount(transactions);
  const totalCash = Object.values(cashByAccount).reduce((s, v) => s + v, 0);

  const totalCost = enriched.reduce((s, h) => s + h.totalCost, 0);
  const totalPnl = enriched.reduce((s, h) => s + (h.pnl || 0), 0);
  const pnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const externalTotal = (externalAssets || []).reduce((s, e) => s + Number(e.value_eur), 0);
  const liabilitiesTotal = (liabilities || []).reduce((s, l) => s + Number(l.amount_eur), 0);

  const portfolioValue = totalMarketValue + totalCash;
  const netWorth = portfolioValue + externalTotal - liabilitiesTotal;

  const xirr = computePortfolioXirr(transactions, totalMarketValue);
  const allocation = computeAllocation(enriched, totalCash);

  const cards = [
    { label: "Patrimonio netto", value: eur(netWorth), sub: liabilitiesTotal > 0 ? `incl. -${eur(liabilitiesTotal)} debiti` : "" },
    { label: "Valore portafoglio", value: eur(portfolioValue), sub: `${eur(totalMarketValue)} investito + ${eur(totalCash)} cash` },
    {
      label: "P&L investimenti",
      value: eur(totalPnl),
      sub: `${totalPnl >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`,
      positive: totalPnl >= 0,
    },
    {
      label: "XIRR (annualizzato)",
      value: xirr != null ? `${(xirr * 100).toFixed(1)}%` : "—",
      sub: "rendimento money-weighted",
      positive: xirr != null ? xirr >= 0 : undefined,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div
              className={`text-2xl font-bold mt-1 ${
                c.positive === undefined ? "" : c.positive ? "text-green-600" : "text-red-600"
              }`}
            >
              {c.value}
            </div>
            {c.sub && <div className="text-xs text-gray-400 mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>

      {allocation.byClass.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm font-semibold mb-3">Allocazione per classe</div>
          <div className="flex h-3 rounded-full overflow-hidden mb-3">
            {allocation.byClass.map((s) => (
              <div
                key={s.key}
                className={CLASS_COLORS[s.key] || "bg-gray-300"}
                style={{ width: `${s.weightPct}%` }}
                title={`${CLASS_LABELS[s.key] || s.key}: ${s.weightPct}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {allocation.byClass.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2.5 h-2.5 rounded-sm ${CLASS_COLORS[s.key] || "bg-gray-300"}`} />
                {CLASS_LABELS[s.key] || s.key} · {s.weightPct}%
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
