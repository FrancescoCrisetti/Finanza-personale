"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface ApiToken {
  id: string;
  name: string;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const supabase = createClient();

  const fetchTokens = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("api_tokens")
      .select("id, name, token_hash, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setTokens(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const generateToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "fp_";
    for (let i = 0; i < 40; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreate = async () => {
    if (!newTokenName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const token = generateToken();

    const { error } = await supabase.from("api_tokens").insert({
      user_id: user.id,
      name: newTokenName.trim(),
      token_hash: token,
    });

    if (!error) {
      setCreatedToken(token);
      setNewTokenName("");
      fetchTokens();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo token? L'accesso API con questo token smetterà di funzionare.")) return;

    await supabase.from("api_tokens").delete().eq("id", id);
    fetchTokens();
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return "••••••••";
    return token.slice(0, 6) + "••••••••" + token.slice(-4);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Token API</h1>

      {/* Create new token */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Crea nuovo token</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="Nome token (es. Claude, Automazione...)"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newTokenName.trim()}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "..." : "Crea"}
          </button>
        </div>

        {createdToken && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">
              Token creato! Copialo ora, non verrà più mostrato:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono break-all">
                {createdToken}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdToken);
                }}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Copia
              </button>
            </div>
            <button
              onClick={() => setCreatedToken(null)}
              className="mt-2 text-sm text-green-700 hover:underline"
            >
              Chiudi
            </button>
          </div>
        )}
      </div>

      {/* Token list */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Token attivi</h2>
        </div>

        {loading ? (
          <div className="p-6 text-gray-500">Caricamento...</div>
        ) : tokens.length === 0 ? (
          <div className="p-6 text-gray-500">Nessun token creato</div>
        ) : (
          <ul className="divide-y">
            {tokens.map((token) => (
              <li key={token.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{token.name}</p>
                  <p className="text-sm text-gray-500 font-mono">{maskToken(token.token_hash)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Creato: {new Date(token.created_at).toLocaleDateString("it-IT")}
                    {token.last_used_at && (
                      <> · Ultimo uso: {new Date(token.last_used_at).toLocaleDateString("it-IT")}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(token.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Elimina
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
