"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Liability {
  id: string;
  name: string;
  type: string;
  amount_eur: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  end_date: string | null;
}

const TYPES = [
  { value: "mortgage", label: "Mutuo" },
  { value: "loan", label: "Prestito" },
  { value: "credit", label: "Credito/Carta" },
  { value: "other", label: "Altro" },
];

export default function LiabilitiesPage() {
  const [items, setItems] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("loan");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [payment, setPayment] = useState("");
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("liabilities").select("*").eq("user_id", user.id).order("created_at");
    setItems(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim() || !amount) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("liabilities").insert({
      user_id: user.id,
      name: name.trim(),
      type,
      amount_eur: parseFloat(amount),
      interest_rate: rate ? parseFloat(rate) : null,
      monthly_payment: payment ? parseFloat(payment) : null,
    });
    setName(""); setAmount(""); setRate(""); setPayment(""); setType("loan");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questa passività?")) return;
    await supabase.from("liabilities").delete().eq("id", id);
    load();
  };

  const total = items.reduce((s, i) => s + Number(i.amount_eur), 0);
  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold">Nuova passività</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <input className={input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className={input} type="number" placeholder="Importo €" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={input} type="number" placeholder="Tasso %" value={rate} onChange={(e) => setRate(e.target.value)} />
          <input className={input} type="number" placeholder="Rata mensile €" value={payment} onChange={(e) => setPayment(e.target.value)} />
        </div>
        <button onClick={add} disabled={!name.trim() || !amount} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          Aggiungi
        </button>
      </section>

      <section className="bg-white rounded-lg border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">Passività</h2>
          <span className="text-sm text-gray-500">Totale: €{total.toLocaleString("it-IT")}</span>
        </div>
        {loading ? (
          <div className="p-5 text-gray-500">Caricamento...</div>
        ) : items.length === 0 ? (
          <div className="p-5 text-gray-500">Nessuna passività</div>
        ) : (
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{i.name} <span className="text-xs text-gray-400">({TYPES.find((t) => t.value === i.type)?.label})</span></p>
                  <p className="text-sm text-gray-500">
                    €{Number(i.amount_eur).toLocaleString("it-IT")}
                    {i.interest_rate != null && <> · {i.interest_rate}%</>}
                    {i.monthly_payment != null && <> · rata €{Number(i.monthly_payment).toLocaleString("it-IT")}</>}
                  </p>
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
