import { createClient } from "@/lib/supabase/server";
import { AssetForm } from "./asset-form";
import { AssetList } from "./asset-list";

export default async function AssetsPage() {
  const supabase = await createClient();

  const { data: assets } = await supabase
    .from("assets")
    .select("*, asset_prices(price_eur,native_price,native_currency,source,updated_at)")
    .order("type")
    .order("ticker");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Asset</h1>

      <AssetForm />

      <AssetList assets={assets || []} />
    </div>
  );
}
