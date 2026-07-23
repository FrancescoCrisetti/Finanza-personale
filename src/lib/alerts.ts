import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  computeCashByAccount,
  computeAllocation,
} from "@/lib/analytics";

type SupabaseService = ReturnType<typeof createServiceClient>;

export interface Alert {
  type: "price_above" | "price_below" | "allocation_deviation" | "stale_price";
  severity: "warning" | "info";
  message: string;
}

const STALE_PRICE_DAYS = 3;
const DEFAULT_TOLERANCE_PCT = 5;

const CLASS_LABELS: Record<string, string> = {
  equity: "Azionario",
  bond: "Obbligazionario",
  crypto: "Crypto",
  commodity: "Materie prime",
  cash: "Liquidità",
  other: "Altro",
};

// Calcola tutti gli alert attivi per l'utente: soglie di prezzo, prezzi non
// aggiornati e deviazione dell'allocazione reale rispetto ai target configurati.
export async function getAlerts(supabase: SupabaseService, userId: string): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const transactions = await fetchAllTransactions(supabase, userId);
  const { holdings } = computeHoldingsAndRealized(transactions);
  const { holdings: enriched } = await enrichHoldingsWithPrices(supabase, userId, holdings);

  const activeIds = enriched.map((h) => h.asset_id);
  if (activeIds.length === 0) return alerts;

  const [{ data: assetMeta }, { data: priceRows }, { data: targets }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, alert_price_above, alert_price_below")
      .eq("user_id", userId)
      .in("id", activeIds),
    supabase.from("asset_prices").select("asset_id, updated_at").eq("user_id", userId).in("asset_id", activeIds),
    supabase.from("allocation_targets").select("asset_class, target_pct, tolerance_pct").eq("user_id", userId),
  ]);

  const metaMap = new Map<string, { alert_price_above: number | null; alert_price_below: number | null }>();
  for (const m of (assetMeta as Array<{ id: string; alert_price_above: number | null; alert_price_below: number | null }> | null) || []) {
    metaMap.set(m.id, { alert_price_above: m.alert_price_above, alert_price_below: m.alert_price_below });
  }

  const updatedMap = new Map<string, string>();
  for (const p of (priceRows as Array<{ asset_id: string; updated_at: string }> | null) || []) {
    updatedMap.set(p.asset_id, p.updated_at);
  }

  // Soglie di prezzo configurate per asset.
  for (const h of enriched) {
    const meta = metaMap.get(h.asset_id);
    if (!meta || h.currentPrice == null) continue;
    if (meta.alert_price_above != null && h.currentPrice >= meta.alert_price_above) {
      alerts.push({
        type: "price_above",
        severity: "warning",
        message: `${h.ticker}: prezzo ${h.currentPrice.toFixed(2)}€ ha superato la soglia di ${Number(meta.alert_price_above).toFixed(2)}€`,
      });
    }
    if (meta.alert_price_below != null && h.currentPrice <= meta.alert_price_below) {
      alerts.push({
        type: "price_below",
        severity: "warning",
        message: `${h.ticker}: prezzo ${h.currentPrice.toFixed(2)}€ è sceso sotto la soglia di ${Number(meta.alert_price_below).toFixed(2)}€`,
      });
    }
  }

  // Prezzi non aggiornati da troppo tempo.
  const now = Date.now();
  for (const h of enriched) {
    const updatedAt = updatedMap.get(h.asset_id);
    if (!updatedAt) continue;
    const ageDays = (now - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > STALE_PRICE_DAYS) {
      alerts.push({
        type: "stale_price",
        severity: "info",
        message: `${h.ticker}: prezzo non aggiornato da ${Math.floor(ageDays)} giorni`,
      });
    }
  }

  // Deviazione dall'allocazione target (se configurata).
  if (targets && targets.length > 0) {
    const cashByAccount = computeCashByAccount(transactions);
    const totalCash = Object.values(cashByAccount).reduce((s, v) => s + v, 0);
    const allocation = computeAllocation(enriched, totalCash);
    const actualByClass = new Map(allocation.byClass.map((s) => [s.key, s.weightPct]));

    for (const t of targets as Array<{ asset_class: string; target_pct: number; tolerance_pct: number }>) {
      const actual = actualByClass.get(t.asset_class) || 0;
      const tolerance = t.tolerance_pct ?? DEFAULT_TOLERANCE_PCT;
      const deviation = actual - Number(t.target_pct);
      if (Math.abs(deviation) > tolerance) {
        alerts.push({
          type: "allocation_deviation",
          severity: "warning",
          message: `${CLASS_LABELS[t.asset_class] || t.asset_class}: peso attuale ${actual.toFixed(1)}% vs target ${Number(t.target_pct).toFixed(1)}% (scostamento ${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}pp)`,
        });
      }
    }
  }

  return alerts;
}
