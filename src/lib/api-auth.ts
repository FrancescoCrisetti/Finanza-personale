import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

type AuthResult =
  | { error: string; status: number }
  | { userId: string };

export async function authenticateApiRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.slice(7);

  const supabase = createServiceClient();

  // Find token by checking hash
  const { data: tokens } = await supabase
    .from("api_tokens")
    .select("id, user_id, name");

  if (!tokens || tokens.length === 0) {
    return { error: "Invalid token", status: 401 };
  }

  // Simple token comparison (in production use bcrypt)
  // For now we store plain tokens hashed with a simple check
  const { data: matchedToken } = await supabase
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", token)
    .single();

  if (!matchedToken) {
    return { error: "Invalid token", status: 401 };
  }

  // Update last_used_at
  await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matchedToken.id);

  return { userId: matchedToken.user_id };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
