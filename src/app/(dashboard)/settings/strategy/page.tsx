import { createClient } from "@/lib/supabase/server";

export default async function StrategyPage() {
  const supabase = await createClient();

  const { data: strategy } = await supabase
    .from("strategy_versions")
    .select("*")
    .eq("is_active", true)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Strategia</h1>

      {strategy ? (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{strategy.label}</h2>
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              Attiva
            </span>
          </div>

          <pre className="bg-gray-50 rounded p-4 text-xs overflow-auto max-h-96">
            {JSON.stringify(strategy.config, null, 2)}
          </pre>

          {strategy.notes && (
            <p className="text-sm text-gray-600">{strategy.notes}</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
          <p>Nessuna strategia configurata.</p>
          <p className="text-sm mt-2">
            Inserisci la prima versione della strategia nel database.
          </p>
        </div>
      )}
    </div>
  );
}
