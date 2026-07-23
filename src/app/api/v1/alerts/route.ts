import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getAlerts } from "@/lib/alerts";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();
  const alerts = await getAlerts(supabase, auth.userId);

  return NextResponse.json({
    alerts,
    count: alerts.length,
    note: "Include soglie di prezzo per asset, prezzi non aggiornati da oltre 3 giorni e deviazione dall'allocazione target (se configurata in Impostazioni > Allocazione target).",
  });
}
