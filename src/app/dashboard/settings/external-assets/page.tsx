"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface ExternalAsset {
  id: string;
  name: string;
  type: string;
  value_eur: number;
}

const TYPES = [
  { value: "real_estate", label: "Immobile" },
  { value: "pension", label: "Fondo pensione" },
  { value: "tfr", label: "TFR" },
  { value: "cash", label: "Liquidità esterna" },
  { value: "other", label: "Altro" },
];

export default function ExternalAssetsPage() {
  const [items, setItems] = useState<ExternalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("real_estate");
  const [value, setValue] = useState("");
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("external_assets").select("*").eq("user_id", user.id).order("created_at");
    setItems(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim() || !value) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("external_assets").insert({
      user_id: user.id,
      name: name.trim(),
      type,
      value_eur: parseFloat(value),
    });
    setName(""); setValue(""); setType("real_estate");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo asset?")) return;
    await supabase.from("external_assets").delete().eq("id", id);
    load();
  };

  const total = items.reduce((s, i) => s + Number(i.value_eur), 0);
  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold">Nuovo asset esterno</h2>
        <p className="text-sm text-gray-500">Beni non tracciati dalle transazioni (immobili, TFR, fondo pensione, conti esterni).</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input className={input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className={input} type="number" placeholder="Valore €" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <button onClick={add} disabled={!name.trim() || !value} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          Aggiungi
        </button>
      </section>

      <section className="bg-white rounded-lg border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">Asset esterni</h2>
          <span className="text-sm text-gray-500">Totale: €{total.toLocaleString("it-IT")}</span>
        </div>
        {loading ? (
          <div className="p-5 text-gray-500">Caricamento...</div>
        ) : items.length === 0 ? (
          <div className="p-5 text-gray-500">Nessun asset esterno</div>
        ) : (
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{i.name} <span className="text-xs text-gray-400">({TYPES.find((t) => t.value === i.type)?.label})</span></p>
                  <p className="text-sm text-gray-500">€{Number(i.value_eur).toLocaleString("it-IT")}</p>
                </div>
                <button onClick={() => remove(i.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Elimina</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
