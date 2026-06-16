"use client";

import { useState } from "react";

export function SyncGistButton() {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");

  async function handleSync() {
    setState("syncing");
    try {
      const res = await fetch("/api/sync-gist", { method: "POST" });
      if (!res.ok) throw new Error();
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === "syncing"}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
        state === "done"
          ? "bg-green-50 border-green-200 text-green-700"
          : state === "error"
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
      }`}
    >
      <svg
        className={`w-4 h-4 ${state === "syncing" ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
        />
      </svg>
      {state === "syncing"
        ? "Sincronizzazione..."
        : state === "done"
        ? "Aggiornato ✓"
        : state === "error"
        ? "Errore sync"
        : "Aggiorna Gist"}
    </button>
  );
}
