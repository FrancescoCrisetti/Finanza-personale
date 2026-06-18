import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();

  const [{ data: profile }, { data: accounts }, { data: goals }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", auth.userId).single(),
    supabase.from("accounts").select("name, type, notes, is_active").eq("user_id", auth.userId).order("name"),
    supabase.from("goals").select("*").eq("user_id", auth.userId).order("priority", { ascending: true }),
  ]);

  return NextResponse.json({
    owner: profile
      ? {
          name: profile.name,
          birth_year: profile.birth_year,
          location: profile.location,
          occupation: profile.occupation,
          dependents: profile.dependents,
          income_stability: profile.income_stability,
        }
      : null,
    accounts: (accounts || []).map((a) => ({
      name: a.name,
      type: a.type,
      role: a.notes,
      active: a.is_active,
    })),
    risk: profile
      ? {
          score: profile.risk_score,
          tolerance: profile.risk_tolerance,
        }
      : null,
    philosophy: profile
      ? {
          etf: profile.philosophy_etf,
          crypto: profile.philosophy_crypto,
          em_overweight: profile.philosophy_em_overweight,
          pillar3_trigger: profile.philosophy_pillar3_trigger,
        }
      : null,
    pac_schedule: profile
      ? {
          frequency: profile.pac_frequency,
          timing: profile.pac_timing,
          platform: profile.pac_platform,
          assets: profile.pac_assets,
        }
      : null,
    goals: (goals || []).map((g) => ({
      name: g.name,
      target_eur: Number(g.target_eur),
      current_eur: Number(g.current_eur),
      target_date: g.target_date,
      priority: g.priority,
      pillar: g.pillar,
      notes: g.notes,
    })),
    notes: profile?.notes ?? null,
  });
}
