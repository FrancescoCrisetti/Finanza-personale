import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

type AuthResult =
  | { error: string; status: number }
  | { userId: string };

export async function authenticateApiRequest(request: NextRequest): Promise<AuthResult> {
  // Support both: Authorization header OR ?token= query param
  const authHeader = request.headers.get("authorization");
  const queryToken = request.nextUrl.searchParams.get("token");

  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return { error: "Missing authentication: use Authorization header or ?token= param", status: 401 };
  }

  const supabase = createServiceClient();

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
