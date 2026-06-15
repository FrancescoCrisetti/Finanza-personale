"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold">Finanza Personale</h1>
        <p className="text-gray-600">Accedi per continuare</p>
        <button
          onClick={handleLogin}
          className="w-full bg-black text-white rounded-lg px-4 py-3 font-medium hover:bg-gray-800 transition-colors"
        >
          Accedi con Google
        </button>
      </div>
    </main>
  );
}
