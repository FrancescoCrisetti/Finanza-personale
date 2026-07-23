import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./account-form";
import { AccountList } from "./account-list";

export default async function AccountsPage() {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("name");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Conti</h1>

      <AccountForm />

      <AccountList accounts={accounts ?? []} />
    </div>
  );
}
