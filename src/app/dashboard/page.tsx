import { createClient } from "@/lib/supabase/server";
import { SyncGistButton } from "./sync-gist-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("name");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, accounts(name), assets(ticker)")
    .order("date", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <SyncGistButton />
      </div>

      {/* Accounts */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Conti</h2>
        {accounts && accounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-lg border p-4"
              >
                <div className="text-sm text-gray-500">{account.type}</div>
                <div className="font-semibold">{account.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            Nessun conto configurato. Aggiungi il primo dalla sezione Transazioni.
          </p>
        )}
      </section>

      {/* Recent Transactions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Ultime transazioni</h2>
        {transactions && transactions.length > 0 ? (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-left px-4 py-2">Tipo</th>
                  <th className="text-left px-4 py-2">Conto</th>
                  <th className="text-left px-4 py-2">Asset</th>
                  <th className="text-right px-4 py-2">Importo €</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{tx.date}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100">
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-2">{(tx.accounts as any)?.name}</td>
                    <td className="px-4 py-2">{(tx.assets as any)?.ticker}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {Number(tx.amount_eur).toLocaleString("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            Nessuna transazione ancora. Inizia aggiungendone una.
          </p>
        )}
      </section>
    </div>
  );
}
