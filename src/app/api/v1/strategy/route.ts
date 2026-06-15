import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();

  const { data: strategy } = await supabase
    .from("strategy_versions")
    .select("*")
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .single();

  if (!strategy) {
    return NextResponse.json({ strategy: null, message: "No active strategy found" });
  }

  return NextResponse.json({ strategy: strategy.config, label: strategy.label });
}
