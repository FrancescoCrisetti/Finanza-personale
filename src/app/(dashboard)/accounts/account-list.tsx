"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Account {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  bank: "Banca",
  broker: "Broker",
  exchange: "Exchange",
};

export function AccountList({ accounts }: { accounts: Account[] }) {
  const router = useRouter();

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare il conto "${name}"?`)) return;

    const supabase = createClient();
    const { error } = await supabase.from("accounts").delete().eq("id", id);

    if (error) {
      alert(`Errore: ${error.message}`);
    } else {
      router.refresh();
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        Nessun conto configurato. Aggiungine uno sopra.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-2">Nome</th>
            <th className="text-left px-4 py-2">Tipo</th>
            <th className="text-left px-4 py-2">Note</th>
            <th className="text-left px-4 py-2">Stato</th>
            <th className="text-right px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">{account.name}</td>
              <td className="px-4 py-2">
                <span className="px-2 py-0.5 rounded text-xs bg-gray-100">
                  {TYPE_LABELS[account.type] || account.type}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-500">{account.notes || "-"}</td>
              <td className="px-4 py-2">
                <span className={`text-xs ${account.is_active ? "text-green-600" : "text-gray-400"}`}>
                  {account.is_active ? "Attivo" : "Disattivo"}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => handleDelete(account.id, account.name)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
