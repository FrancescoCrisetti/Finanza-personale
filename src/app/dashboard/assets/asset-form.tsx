"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ASSET_TYPES = [
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "fiat", label: "Fiat" },
];

export function AssetForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Non autenticato");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("assets").insert({
      user_id: user.id,
      ticker: (form.get("ticker") as string).toUpperCase(),
      name: (form.get("name") as string) || null,
      type: form.get("type") as string,
      isin: (form.get("isin") as string) || null,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 space-y-4">
      <h2 className="font-semibold">Aggiungi asset</h2>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ticker</label>
          <input
            type="text"
            name="ticker"
            required
            placeholder="es. BTC"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Nome</label>
          <input
            type="text"
            name="name"
            placeholder="es. Bitcoin"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select name="type" required className="w-full border rounded px-2 py-1.5 text-sm">
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">ISIN</label>
          <input
            type="text"
            name="isin"
            placeholder="Solo per ETF"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "Salvataggio..." : "Aggiungi asset"}
      </button>
    </form>
  );
}
