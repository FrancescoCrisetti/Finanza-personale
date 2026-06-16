import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildProfileText } from "@/lib/gist";

async function authenticateByKey(key: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", key)
    .single();

  if (!data) return null;

  await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data.user_id;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const userId = await authenticateByKey(key);
  if (!userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = await buildProfileText(userId);

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
