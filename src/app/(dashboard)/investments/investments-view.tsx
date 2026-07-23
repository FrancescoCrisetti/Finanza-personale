"use client";

import { useMemo, useState } from "react";
import { Sparkline } from "./sparkline";

export interface InvestmentRow {
  ticker: string;
  name: string | null;
  assetClass: string;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  weightPct: number | null;
  xirrPct: number | null;
  change1d: number | null;
  change7d: number | null;
  change30d: number | null;
  drawdownPct: number | null;
  volatilityPct: number | null;
  contributionPct: number | null;
  priceHistory: number[];
  priced: boolean;
}

const CLASS_LABELS: Record<string, string> = {
  equity: "Azionario",
  bond: "Obbligazionario",
  crypto: "Crypto",
  commodity: "Materie prime",
  cash: "Liquidità",
  other: "Altro",
};

const CLASS_ORDER = ["equity", "bond", "crypto", "commodity", "cash", "other"];

function eur(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function changeColor(n: number | null): string {
  if (n == null) return "text-gray-400";
  return n >= 0 ? "text-green-600" : "text-red-600";
}

function InvestmentsTable({ rows }: { rows: InvestmentRow[] }) {
  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-3 py-2">Asset</th>
            <th className="text-right px-3 py-2">Quantità</th>
            <th className="text-right px-3 py-2">Prezzo</th>
            <th className="text-center px-3 py-2">Trend</th>
            <th className="text-right px-3 py-2">1g</th>
            <th className="text-right px-3 py-2">7g</th>
            <th className="text-right px-3 py-2">30g</th>
            <th className="text-right px-3 py-2">Valore</th>
            <th className="text-right px-3 py-2">Costo medio</th>
            <th className="text-right px-3 py-2">P&L</th>
            <th className="text-right px-3 py-2">XIRR</th>
            <th className="text-right px-3 py-2">Drawdown</th>
            <th className="text-right px-3 py-2">Volatilità</th>
            <th className="text-right px-3 py-2">Contributo</th>
            <th className="text-right px-3 py-2">Peso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">
                {r.ticker}
                {r.name && <span className="block text-xs text-gray-400 font-normal">{r.name}</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono">{r.quantity.toFixed(6)}</td>
              <td className="px-3 py-2 text-right font-mono">{eur(r.currentPrice)}</td>
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <Sparkline prices={r.priceHistory} positive={r.change30d != null ? r.change30d >= 0 : null} />
                </div>
              </td>
              <td className={`px-3 py-2 text-right font-mono ${changeColor(r.change1d)}`}>{pct(r.change1d)}</td>
              <td className={`px-3 py-2 text-right font-mono ${changeColor(r.change7d)}`}>{pct(r.change7d)}</td>
              <td className={`px-3 py-2 text-right font-mono ${changeColor(r.change30d)}`}>{pct(r.change30d)}</td>
              <td className="px-3 py-2 text-right font-mono">{eur(r.marketValue)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{eur(r.avgCost)}</td>
              <td className={`px-3 py-2 text-right font-mono ${changeColor(r.pnl)}`}>
                {eur(r.pnl)}
                {r.pnlPct != null && <span className="block text-xs">{pct(r.pnlPct)}</span>}
              </td>
              <td className={`px-3 py-2 text-right font-mono ${changeColor(r.xirrPct)}`}>{pct(r.xirrPct)}</td>
              <td className="px-3 py-2 text-right font-mono text-red-600">{r.drawdownPct != null ? pct(r.drawdownPct) : "—"}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">{r.volatilityPct != null ? `${r.volatilityPct.toFixed(1)}%` : "—"}</td>
              <td className={`px-3 py-2 text-right font-mono ${changeColor(r.contributionPct)}`}>{pct(r.contributionPct)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">
                {r.weightPct != null ? `${r.weightPct.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvestmentsView({
  rows,
  portfolioMetrics,
}: {
  rows: InvestmentRow[];
  portfolioMetrics?: { drawdown_pct: number | null; volatility_pct: number | null; history_days: number };
}) {
  const [filter, setFilter] = useState<string>("all");

  const groups = useMemo(() => {
    const byClass = new Map<string, InvestmentRow[]>();
    for (const r of rows) {
      const key = r.assetClass || "other";
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key)!.push(r);
    }
    return CLASS_ORDER.filter((c) => byClass.has(c)).map((c) => ({
      key: c,
      label: CLASS_LABELS[c] || c,
      rows: byClass.get(c)!,
      total: byClass.get(c)!.reduce((s, r) => s + (r.marketValue || 0), 0),
    }));
  }, [rows]);

  const visibleGroups = filter === "all" ? groups : groups.filter((g) => g.key === filter);
  const unpriced = rows.filter((r) => !r.priced);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm border ${
            filter === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          Tutti ({rows.length})
        </button>
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => setFilter(g.key)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              filter === g.key ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {g.label} ({g.rows.length})
          </button>
        ))}
      </div>

      {unpriced.length > 0 && (
        <div className="bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200 p-3">
          Prezzo non disponibile per: {unpriced.map((r) => r.ticker).join(", ")}
        </div>
      )}

      {portfolioMetrics && (portfolioMetrics.drawdown_pct != null || portfolioMetrics.volatility_pct != null) && (
        <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-gray-500">Drawdown portafoglio (stima)</div>
            <div className="font-mono text-red-600">{pct(portfolioMetrics.drawdown_pct)}</div>
          </div>
          <div>
            <div className="text-gray-500">Volatilità portafoglio (stima)</div>
            <div className="font-mono">
              {portfolioMetrics.volatility_pct != null ? `${portfolioMetrics.volatility_pct.toFixed(1)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Giorni di storico</div>
            <div className="font-mono">{portfolioMetrics.history_days}</div>
          </div>
        </div>
      )}

      {visibleGroups.map((g) => (
        <section key={g.key} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{g.label}</h2>
            <span className="text-sm text-gray-500">{eur(g.total)}</span>
          </div>
          <InvestmentsTable rows={g.rows} />
        </section>
      ))}

      {visibleGroups.length === 0 && (
        <div className="bg-white rounded-lg border p-6 text-center text-gray-400">Nessuna posizione attiva</div>
      )}
    </div>
  );
}
