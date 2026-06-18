"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface CapitalLoss {
  id: string;
  year: number;
  amount_eur: number;
  expires_year: number;
  notes: string | null;
}

export default function TaxPage() {
  const [items, setItems] = useState<CapitalLoss[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear.toString());
  const [amount, setAmount] = useState("");
  const [expires, setExpires] = useState((currentYear + 4).toString());
  const [notes, setNotes] = useState("");
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("tax_capital_losses")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!year || !amount) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tax_capital_losses").insert({
      user_id: user.id,
      year: parseInt(year),
      amount_eur: parseFloat(amount),
      expires_year: parseInt(expires),
      notes: notes || null,
    });
    setAmount(""); setNotes("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questa voce?")) return;
    await supabase.from("tax_capital_losses").delete().eq("id", id);
    load();
  };

  const active = items.filter((i) => i.expires_year >= currentYear);
  const totalAvailable = active.reduce((s, i) => s + Number(i.amount_eur), 0);
  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        Lo <strong>zainetto fiscale</strong> raccoglie le minusvalenze realizzate compensabili con future plusvalenze.
        In Italia scadono dopo 4 anni. Le plus/minus realizzate dalle tue vendite sono calcolate automaticamente
        dall&apos;API (<code>/api/v1/tax</code>); qui inserisci manualmente il credito da compensare. Valori indicativi, non consulenza fiscale.
      </div>

      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold">Nuova minusvalenza a credito</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <input className={input} type="number" placeholder="Anno" value={year} onChange={(e) => setYear(e.target.value)} />
          <input className={input} type="number" placeholder="Importo €" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={input} type="number" placeholder="Scade nel" value={expires} onChange={(e) => setExpires(e.target.value)} />
          <input className={input} placeholder="Note" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button onClick={add} disabled={!year || !amount} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          Aggiungi
        </button>
      </section>

      <section className="bg-white rounded-lg border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">Zainetto fiscale</h2>
          <span className="text-sm text-gray-500">Disponibile: €{totalAvailable.toLocaleString("it-IT")}</span>
        </div>
        {loading ? (
          <div className="p-5 text-gray-500">Caricamento...</div>
        ) : items.length === 0 ? (
          <div className="p-5 text-gray-500">Nessuna voce</div>
        ) : (
          <ul className="divide-y">
            {items.map((i) => {
              const expired = i.expires_year < currentYear;
              return (
                <li key={i.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      €{Number(i.amount_eur).toLocaleString("it-IT")} <span className="text-xs text-gray-400">({i.year})</span>
                      {expired && <span className="ml-2 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">scaduta</span>}
                    </p>
                    <p className="text-sm text-gray-500">
                      Scade nel {i.expires_year}{i.notes && <> · {i.notes}</>}
                    </p>
                  </div>
                  <button onClick={() => remove(i.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Elimina</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
