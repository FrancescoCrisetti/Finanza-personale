import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "./transaction-form";
import Link from "next/link";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name")
    .order("name");

  const { data: assets } = await supabase
    .from("assets")
    .select("id, ticker, type")
    .order("ticker");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, accounts(name), assets(ticker)")
    .order("date", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transazioni</h1>
        <Link
          href="/transactions/import"
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
        >
          Importa CSV
        </Link>
      </div>

      <TransactionForm
        accounts={accounts ?? []}
        assets={assets ?? []}
      />

      {transactions && transactions.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2">Data</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-left px-4 py-2">Conto</th>
                <th className="text-left px-4 py-2">Asset</th>
                <th className="text-right px-4 py-2">Qtà</th>
                <th className="text-right px-4 py-2">Prezzo</th>
                <th className="text-right px-4 py-2">Importo €</th>
                <th className="text-left px-4 py-2">Note</th>
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
                    {tx.quantity ? Number(tx.quantity).toFixed(6) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {tx.unit_price_eur
                      ? `€${Number(tx.unit_price_eur).toFixed(2)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {Number(tx.amount_eur).toLocaleString("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-500 truncate max-w-[150px]">
                    {tx.description || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
