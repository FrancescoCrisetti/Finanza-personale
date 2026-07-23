import { createClient } from "@/lib/supabase/server";
import { DashboardOverview } from "./dashboard-overview";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Overview finanziaria */}
      {user && <DashboardOverview userId={user.id} />}
    </div>
  );
}

