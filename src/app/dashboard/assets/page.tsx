import { createClient } from "@/lib/supabase/server";
import { AssetForm } from "./asset-form";

export default async function AssetsPage() {
  const supabase = await createClient();

  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .order("type")
    .order("ticker");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Asset</h1>

      <AssetForm />

      {assets && assets.length > 0 ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2">Ticker</th>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-left px-4 py-2">ISIN</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono font-medium">{asset.ticker}</td>
                  <td className="px-4 py-2">{asset.name || "-"}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100">
                      {asset.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                    {asset.isin || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Nessun asset configurato.</p>
      )}
    </div>
  );
}
