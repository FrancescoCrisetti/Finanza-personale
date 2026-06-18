"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Asset {
  id: string;
  ticker: string;
  name: string | null;
  type: string;
  isin: string | null;
  price_api_id: string | null;
  asset_class: string | null;
  region: string | null;
  sector: string | null;
}

const ASSET_CLASSES = [
  { value: "", label: "—" },
  { value: "equity", label: "Azionario" },
  { value: "bond", label: "Obbligazionario" },
  { value: "crypto", label: "Crypto" },
  { value: "commodity", label: "Materie prime" },
  { value: "cash", label: "Liquidità" },
  { value: "other", label: "Altro" },
];

export function AssetList({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Asset>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (a: Asset) => {
    setEditingId(a.id);
    setDraft({
      price_api_id: a.price_api_id ?? "",
      asset_class: a.asset_class ?? "",
      region: a.region ?? "",
      sector: a.sector ?? "",
    });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft({});
  };

  const save = async (id: string) => {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("assets")
      .update({
        price_api_id: draft.price_api_id || null,
        asset_class: draft.asset_class || null,
        region: draft.region || null,
        sector: draft.sector || null,
      })
      .eq("id", id);
    setSaving(false);
    cancel();
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo asset?")) return;
    const supabase = createClient();
    await supabase.from("assets").delete().eq("id", id);
    router.refresh();
  };

  const cell = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  if (assets.length === 0) {
    return <p className="text-gray-500 text-sm">Nessun asset configurato.</p>;
  }

  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-3 py-2">Ticker</th>
            <th className="text-left px-3 py-2">Tipo</th>
            <th className="text-left px-3 py-2">ID prezzo</th>
            <th className="text-left px-3 py-2">Classe</th>
            <th className="text-left px-3 py-2">Area</th>
            <th className="text-left px-3 py-2">Settore</th>
            <th className="text-right px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => {
            const editing = editingId === a.id;
            const cls = ASSET_CLASSES.find((c) => c.value === a.asset_class)?.label;
            return (
              <tr key={a.id} className="border-b last:border-0 align-middle">
                <td className="px-3 py-2 font-mono font-medium">
                  {a.ticker}
                  {a.name && <span className="block text-xs text-gray-400 font-sans">{a.name}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{a.type}</span>
                </td>
                {editing ? (
                  <>
                    <td className="px-3 py-2">
                      <input className={cell} value={draft.price_api_id ?? ""} onChange={(e) => setDraft((d) => ({ ...d, price_api_id: e.target.value }))} placeholder="EIMI.MI / bitcoin" />
                    </td>
                    <td className="px-3 py-2">
                      <select className={cell} value={draft.asset_class ?? ""} onChange={(e) => setDraft((d) => ({ ...d, asset_class: e.target.value }))}>
                        {ASSET_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input className={cell} value={draft.region ?? ""} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={cell} value={draft.sector ?? ""} onChange={(e) => setDraft((d) => ({ ...d, sector: e.target.value }))} />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => save(a.id)} disabled={saving} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3 disabled:opacity-50">Salva</button>
                      <button onClick={cancel} className="text-gray-500 hover:text-gray-700 text-sm">Annulla</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{a.price_api_id || "-"}</td>
                    <td className="px-3 py-2">{cls || <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2">{a.region || <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2">{a.sector || <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(a)} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Modifica</button>
                      <button onClick={() => remove(a.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Elimina</button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
