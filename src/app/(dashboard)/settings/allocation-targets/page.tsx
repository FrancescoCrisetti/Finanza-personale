"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface AllocationTarget {
  id: string;
  asset_class: string;
  target_pct: number;
  tolerance_pct: number;
}

const ASSET_CLASSES = [
  { value: "equity", label: "Azionario" },
  { value: "bond", label: "Obbligazionario" },
  { value: "crypto", label: "Crypto" },
  { value: "commodity", label: "Materie prime" },
  { value: "cash", label: "Liquidità" },
  { value: "other", label: "Altro" },
];

export default function AllocationTargetsPage() {
  const [targets, setTargets] = useState<AllocationTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetClass, setAssetClass] = useState("equity");
  const [targetPct, setTargetPct] = useState("");
  const [tolerancePct, setTolerancePct] = useState("5");
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("allocation_targets")
      .select("*")
      .eq("user_id", user.id)
      .order("asset_class");
    setTargets(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!targetPct) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("allocation_targets").upsert(
      {
        user_id: user.id,
        asset_class: assetClass,
        target_pct: parseFloat(targetPct),
        tolerance_pct: tolerancePct ? parseFloat(tolerancePct) : 5,
      },
      { onConflict: "user_id,asset_class" }
    );
    setTargetPct("");
    setTolerancePct("5");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo target?")) return;
    await supabase.from("allocation_targets").delete().eq("id", id);
    load();
  };

  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const totalTarget = targets.reduce((s, t) => s + Number(t.target_pct), 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Imposta il peso % target per classe di asset. Se il peso reale del portafoglio si scosta dal target oltre la
        tolleranza indicata, comparirà un alert in dashboard e in <code>/api/v1/alerts</code>.
      </p>

      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold">Nuovo target</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select className={input} value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
            {ASSET_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input className={input} type="number" placeholder="Target %" value={targetPct} onChange={(e) => setTargetPct(e.target.value)} />
          <input className={input} type="number" placeholder="Tolleranza pp (default 5)" value={tolerancePct} onChange={(e) => setTolerancePct(e.target.value)} />
        </div>
        <button onClick={save} disabled={!targetPct} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          Salva
        </button>
      </section>

      <section className="bg-white rounded-lg border">
        {loading ? (
          <div className="p-5 text-gray-500">Caricamento...</div>
        ) : targets.length === 0 ? (
          <div className="p-5 text-gray-500">Nessun target configurato.</div>
        ) : (
          <ul className="divide-y">
            {targets.map((t) => (
              <li key={t.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{ASSET_CLASSES.find((c) => c.value === t.asset_class)?.label || t.asset_class}</p>
                  <p className="text-sm text-gray-500">
                    Target {Number(t.target_pct).toFixed(1)}% · tolleranza ±{Number(t.tolerance_pct).toFixed(1)}pp
                  </p>
                </div>
                <button onClick={() => remove(t.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Elimina</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {targets.length > 0 && Math.abs(totalTarget - 100) > 0.5 && (
        <p className="text-sm text-amber-600">
          Attenzione: la somma dei target è {totalTarget.toFixed(1)}% (dovrebbe essere ~100%).
        </p>
      )}
    </div>
  );
}
