"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  name: string;
  birth_year: string;
  location: string;
  occupation: string;
  dependents: string;
  income_stability: string;
  risk_score: string;
  risk_tolerance: string;
  philosophy_etf: string;
  philosophy_crypto: string;
  philosophy_em_overweight: string;
  philosophy_pillar3_trigger: string;
  pac_frequency: string;
  pac_timing: string;
  pac_platform: string;
  pac_assets: string;
  notes: string;
}

const EMPTY: Profile = {
  name: "",
  birth_year: "",
  location: "",
  occupation: "",
  dependents: "",
  income_stability: "",
  risk_score: "",
  risk_tolerance: "",
  philosophy_etf: "",
  philosophy_crypto: "",
  philosophy_em_overweight: "",
  philosophy_pillar3_trigger: "",
  pac_frequency: "",
  pac_timing: "",
  pac_platform: "",
  pac_assets: "",
  notes: "",
};

export default function ProfilePage() {
  const [form, setForm] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) {
      setForm({
        name: data.name ?? "",
        birth_year: data.birth_year?.toString() ?? "",
        location: data.location ?? "",
        occupation: data.occupation ?? "",
        dependents: data.dependents?.toString() ?? "",
        income_stability: data.income_stability ?? "",
        risk_score: data.risk_score?.toString() ?? "",
        risk_tolerance: data.risk_tolerance ?? "",
        philosophy_etf: data.philosophy_etf ?? "",
        philosophy_crypto: data.philosophy_crypto ?? "",
        philosophy_em_overweight: data.philosophy_em_overweight ?? "",
        philosophy_pillar3_trigger: data.philosophy_pillar3_trigger ?? "",
        pac_frequency: data.pac_frequency ?? "",
        pac_timing: data.pac_timing ?? "",
        pac_platform: data.pac_platform ?? "",
        pac_assets: (data.pac_assets ?? []).join(", "),
        notes: data.notes ?? "",
      });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof Profile, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        name: form.name || null,
        birth_year: form.birth_year ? parseInt(form.birth_year) : null,
        location: form.location || null,
        occupation: form.occupation || null,
        dependents: form.dependents ? parseInt(form.dependents) : null,
        income_stability: form.income_stability || null,
        risk_score: form.risk_score ? parseInt(form.risk_score) : null,
        risk_tolerance: form.risk_tolerance || null,
        philosophy_etf: form.philosophy_etf || null,
        philosophy_crypto: form.philosophy_crypto || null,
        philosophy_em_overweight: form.philosophy_em_overweight || null,
        philosophy_pillar3_trigger: form.philosophy_pillar3_trigger || null,
        pac_frequency: form.pac_frequency || null,
        pac_timing: form.pac_timing || null,
        pac_platform: form.pac_platform || null,
        pac_assets: form.pac_assets
          ? form.pac_assets.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <div className="text-gray-500">Caricamento...</div>;

  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const label = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <div className="space-y-6">
      {/* Anagrafica */}
      <section className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Anagrafica</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={label}>Nome</label><input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className={label}>Anno di nascita</label><input type="number" className={input} value={form.birth_year} onChange={(e) => set("birth_year", e.target.value)} /></div>
          <div><label className={label}>Località</label><input className={input} value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
          <div><label className={label}>Occupazione</label><input className={input} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} /></div>
          <div><label className={label}>Persone a carico</label><input type="number" className={input} value={form.dependents} onChange={(e) => set("dependents", e.target.value)} /></div>
          <div><label className={label}>Stabilità del reddito</label><input className={input} placeholder="es. alta / media / bassa" value={form.income_stability} onChange={(e) => set("income_stability", e.target.value)} /></div>
        </div>
      </section>

      {/* Profilo di rischio */}
      <section className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Profilo di rischio</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Punteggio di rischio (1-7)</label>
            <select className={input} value={form.risk_score} onChange={(e) => set("risk_score", e.target.value)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div><label className={label}>Tolleranza al rischio</label><input className={input} placeholder="es. accetto drawdown del 30%" value={form.risk_tolerance} onChange={(e) => set("risk_tolerance", e.target.value)} /></div>
        </div>
      </section>

      {/* Filosofia */}
      <section className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Filosofia di investimento</h2>
        <div className="space-y-4">
          <div><label className={label}>ETF</label><textarea className={input} rows={2} value={form.philosophy_etf} onChange={(e) => set("philosophy_etf", e.target.value)} /></div>
          <div><label className={label}>Crypto</label><textarea className={input} rows={2} value={form.philosophy_crypto} onChange={(e) => set("philosophy_crypto", e.target.value)} /></div>
          <div><label className={label}>Sovrappeso mercati emergenti</label><textarea className={input} rows={2} value={form.philosophy_em_overweight} onChange={(e) => set("philosophy_em_overweight", e.target.value)} /></div>
          <div><label className={label}>Trigger pilastro 3</label><textarea className={input} rows={2} value={form.philosophy_pillar3_trigger} onChange={(e) => set("philosophy_pillar3_trigger", e.target.value)} /></div>
        </div>
      </section>

      {/* PAC */}
      <section className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Piano di accumulo (PAC)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={label}>Frequenza</label><input className={input} placeholder="es. mensile" value={form.pac_frequency} onChange={(e) => set("pac_frequency", e.target.value)} /></div>
          <div><label className={label}>Timing</label><input className={input} placeholder="es. metà mese" value={form.pac_timing} onChange={(e) => set("pac_timing", e.target.value)} /></div>
          <div><label className={label}>Piattaforma</label><input className={input} value={form.pac_platform} onChange={(e) => set("pac_platform", e.target.value)} /></div>
          <div><label className={label}>Asset (separati da virgola)</label><input className={input} placeholder="EIMI, MEUD, MWRD" value={form.pac_assets} onChange={(e) => set("pac_assets", e.target.value)} /></div>
        </div>
      </section>

      {/* Note */}
      <section className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Note</h2>
        <textarea className={input} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-5 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
          {saving ? "Salvataggio..." : "Salva profilo"}
        </button>
        {saved && <span className="text-sm text-green-600">Salvato ✓</span>}
      </div>
    </div>
  );
}
