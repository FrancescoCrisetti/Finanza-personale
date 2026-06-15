"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Banca" },
  { value: "broker", label: "Broker" },
  { value: "exchange", label: "Exchange" },
];

export function AccountForm() {
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

    const { error: insertError } = await supabase.from("accounts").insert({
      user_id: user.id,
      name: form.get("name") as string,
      type: form.get("type") as string,
      notes: (form.get("notes") as string) || null,
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
      <h2 className="font-semibold">Aggiungi conto</h2>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nome</label>
          <input
            type="text"
            name="name"
            required
            placeholder="es. Trade Republic"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select name="type" required className="w-full border rounded px-2 py-1.5 text-sm">
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Note</label>
          <input
            type="text"
            name="notes"
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="Opzionale"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "Salvataggio..." : "Aggiungi conto"}
      </button>
    </form>
  );
}
