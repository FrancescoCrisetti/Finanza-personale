import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const type = url.searchParams.get("type");
  const account = url.searchParams.get("account");

  let query = supabase
    .from("transactions")
    .select("*, accounts(name), assets(ticker, type)")
    .eq("user_id", auth.userId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("type", type.toUpperCase());
  if (account) query = query.eq("accounts.name", account);

  const { data, error } = await query;

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ transactions: data, count: data?.length || 0 });
}
