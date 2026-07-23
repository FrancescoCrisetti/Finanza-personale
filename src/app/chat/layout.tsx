import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "../(dashboard)/sidebar";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <Sidebar email={user.email || ""} />
      <main className="flex-1 h-screen overflow-hidden">{children}</main>
    </div>
  );
}
