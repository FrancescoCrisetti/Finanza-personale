"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Goal {
  id: string;
  name: string;
  target_eur: number;
  current_eur: number;
  target_date: string | null;
  priority: number;
  pillar: string | null;
  notes: string | null;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("3");
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("priority", { ascending: true });
    setGoals(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim() || !target) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("goals").insert({
      user_id: user.id,
      name: name.trim(),
      target_eur: parseFloat(target),
      current_eur: current ? parseFloat(current) : 0,
      target_date: date || null,
      priority: parseInt(priority) || 3,
    });
    setName(""); setTarget(""); setCurrent(""); setDate(""); setPriority("3");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo obiettivo?")) return;
    await supabase.from("goals").delete().eq("id", id);
    load();
  };

  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold">Nuovo obiettivo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <input className={input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={input} type="number" placeholder="Target €" value={target} onChange={(e) => setTarget(e.target.value)} />
          <input className={input} type="number" placeholder="Attuale €" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={input} type="number" placeholder="Priorità" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
        <button onClick={add} disabled={!name.trim() || !target} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          Aggiungi
        </button>
      </section>

      <section className="bg-white rounded-lg border">
        {loading ? (
          <div className="p-5 text-gray-500">Caricamento...</div>
        ) : goals.length === 0 ? (
          <div className="p-5 text-gray-500">Nessun obiettivo</div>
        ) : (
          <ul className="divide-y">
            {goals.map((g) => {
              const pct = g.target_eur > 0 ? Math.min(100, (Number(g.current_eur) / Number(g.target_eur)) * 100) : 0;
              return (
                <li key={g.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-sm text-gray-500">
                        €{Number(g.current_eur).toLocaleString("it-IT")} / €{Number(g.target_eur).toLocaleString("it-IT")}
                        {g.target_date && <> · entro {new Date(g.target_date).toLocaleDateString("it-IT")}</>}
                        {" · priorità "}{g.priority}
                      </p>
                    </div>
                    <button onClick={() => remove(g.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Elimina</button>
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
