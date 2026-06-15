"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TRANSACTION_TYPES = [
  "BUY",
  "SELL",
  "DEPOSIT",
  "WITHDRAW",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "FEE",
  "INCOME",
  "EXPENSE",
  "SAVEBACK",
  "DIVIDEND",
] as const;

interface Props {
  accounts: { id: string; name: string }[];
  assets: { id: string; ticker: string; type: string }[];
}

export function TransactionForm({ accounts, assets }: Props) {
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

    const quantity = form.get("quantity") as string;
    const unitPrice = form.get("unit_price_eur") as string;

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: user.id,
      date: form.get("date") as string,
      account_id: form.get("account_id") as string,
      asset_id: (form.get("asset_id") as string) || null,
      type: form.get("type") as string,
      quantity: quantity ? parseFloat(quantity) : null,
      unit_price_eur: unitPrice ? parseFloat(unitPrice) : null,
      amount_eur: parseFloat(form.get("amount_eur") as string),
      description: (form.get("description") as string) || null,
      source: "MANUAL",
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
      <h2 className="font-semibold">Nuova transazione</h2>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data</label>
          <input
            type="date"
            name="date"
            required
            defaultValue={new Date().toISOString().split("T")[0]}
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select name="type" required className="w-full border rounded px-2 py-1.5 text-sm">
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Conto</label>
          <select name="account_id" required className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Seleziona...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Asset</label>
          <select name="asset_id" className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Nessuno (cash)</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.ticker} ({a.type})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Quantità</label>
          <input
            type="number"
            name="quantity"
            step="any"
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="es. 0.5"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Prezzo unit. €</label>
          <input
            type="number"
            name="unit_price_eur"
            step="any"
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="es. 54000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Importo € *</label>
          <input
            type="number"
            name="amount_eur"
            step="any"
            required
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="es. 300"
          />
        </div>

        <div className="col-span-1 sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Note</label>
          <input
            type="text"
            name="description"
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
        {loading ? "Salvataggio..." : "Aggiungi transazione"}
      </button>
    </form>
  );
}
