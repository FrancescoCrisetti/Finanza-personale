"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type ConversationRow = { id: string; title: string | null; updated_at: string };

const SUGGESTIONS = [
  "Com'è composto il mio portafoglio?",
  "Qual è il mio patrimonio netto?",
  "Come sta andando la performance? (XIRR)",
  "Analizza la mia allocazione e i rischi",
  "Qual è la mia situazione fiscale?",
];

const TOOL_LABELS: Record<string, string> = {
  getPortfolioSummary: "Riepilogo portafoglio",
  getHoldings: "Posizioni",
  getAllocation: "Allocazione",
  getNetWorth: "Patrimonio netto",
  getCashflow: "Flussi di cassa",
  getPerformance: "Performance",
  getTax: "Fiscalità",
  getTransactions: "Transazioni",
  getProfile: "Profilo",
};

export default function ChatPage() {
  const supabase = useMemo(() => createClient(), []);
  const conversationIdRef = useRef<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const setConvId = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setConversationId(id);
  }, []);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    setConversations((data as ConversationRow[]) || []);
  }, [supabase]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: conversationIdRef.current }),
      }),
    []
  );

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    onFinish: () => loadConversations(),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function newConversation() {
    setConvId(null);
    setMessages([]);
    setInput("");
  }

  async function selectConversation(id: string) {
    if (id === conversationId) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("messages")
      .eq("id", id)
      .single();
    setConvId(id);
    setMessages(((data?.messages as UIMessage[]) || []) as UIMessage[]);
  }

  async function deleteConversation(id: string) {
    await supabase.from("chat_conversations").delete().eq("id", id);
    if (id === conversationId) newConversation();
    loadConversations();
  }

  function submit(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    if (!conversationIdRef.current) setConvId(crypto.randomUUID());
    sendMessage({ text: t });
    setInput("");
  }

  return (
    <div className="h-full flex">
      {/* Conversation list */}
      <aside className="w-64 shrink-0 border-r bg-white flex flex-col">
        <div className="p-3 border-b">
          <button
            onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-sm hover:bg-gray-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuova conversazione
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 px-2 py-3">Nessuna conversazione salvata.</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg text-sm ${
                c.id === conversationId ? "bg-gray-100" : "hover:bg-gray-50"
              }`}
            >
              <button
                onClick={() => selectConversation(c.id)}
                className="flex-1 text-left px-2.5 py-2 truncate text-gray-700"
                title={c.title || "Conversazione"}
              >
                {c.title || "Conversazione"}
              </button>
              <button
                onClick={() => deleteConversation(c.id)}
                className="opacity-0 group-hover:opacity-100 px-2 text-gray-400 hover:text-red-600"
                title="Elimina"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 flex items-center gap-2 px-4 border-b bg-white">
          <span className="font-semibold text-sm">🤖 Consulente AI</span>
          <span className="text-xs text-gray-400">Gemini</span>
        </header>

      {/* Messages */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-12 space-y-4">
              <p className="text-lg">Chiedi qualcosa sui tuoi dati finanziari</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="px-3 py-1.5 rounded-full border bg-white text-sm text-gray-700 hover:border-gray-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-black text-white"
                    : "bg-white border text-gray-800"
                }`}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return <span key={i}>{part.text}</span>;
                  }
                  if (part.type.startsWith("tool-")) {
                    const name = part.type.replace("tool-", "");
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 mr-1"
                      >
                        🔧 {TOOL_LABELS[name] || name}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 bg-white border text-sm text-gray-400">
                Sto analizzando i tuoi dati…
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-red-600">
              Si è verificato un errore. Verifica la configurazione della chiave API.
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="max-w-3xl mx-auto px-4 py-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi una domanda sui tuoi investimenti…"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="px-4 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-40"
          >
            Invia
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
