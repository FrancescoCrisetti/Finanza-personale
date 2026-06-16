import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildProfileText, updateGist } from "@/lib/gist";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const content = await buildProfileText(user.id);
  const result = await updateGist(content);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, url: result.url });
}
