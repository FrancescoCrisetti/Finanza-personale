import { createClient } from "@/lib/supabase/server";

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {detail && <div className="text-xs text-gray-400">{detail}</div>}
      </div>
      <span
        className={`text-xs font-semibold px-2 py-1 rounded-full ${
          ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}
      >
        {ok ? "OK" : "Errore"}
      </span>
    </div>
  );
}

export default async function DiagnosticsPage() {
  const envChecks = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
  ];

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let dbOk = false;
  let dbDetail = "";
  try {
    const { error } = await supabase.from("accounts").select("id").limit(1);
    dbOk = !error;
    dbDetail = error ? error.message : "Connessione e RLS attive";
  } catch (e) {
    dbDetail = e instanceof Error ? e.message : "Errore sconosciuto";
  }

  const allowedEmail = process.env.ALLOWED_EMAIL;
  const emailMatch = !allowedEmail || user?.email === allowedEmail;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Diagnostica</h2>
        <p className="text-sm text-gray-500 mt-1">
          Verifica rapida della configurazione: variabili d&apos;ambiente, connessione a Supabase e sessione corrente.
        </p>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm font-semibold mb-2">Variabili d&apos;ambiente</div>
        {envChecks.map((c) => (
          <Row key={c.key} label={c.key} ok={!!c.value} detail={c.value ? undefined : "Non impostata in .env.local"} />
        ))}
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm font-semibold mb-2">Connessione Supabase</div>
        <Row label="Query di test (tabella accounts)" ok={dbOk} detail={dbDetail} />
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm font-semibold mb-2">Sessione</div>
        <Row
          label="Utente autenticato"
          ok={!userError && !!user}
          detail={user ? user.email : userError?.message || "Nessun utente in sessione"}
        />
        <Row
          label="Email consentita (ALLOWED_EMAIL)"
          ok={emailMatch}
          detail={allowedEmail ? `Richiesta: ${allowedEmail}` : "Nessuna restrizione impostata"}
        />
      </div>
    </div>
  );
}
