import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createAdvisorTools } from "@/lib/advisor-tools";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sei un consulente finanziario personale integrato in una web app di gestione del patrimonio.
Hai accesso ai dati reali dell'utente tramite gli strumenti (tools) disponibili.

Regole:
- Usa SEMPRE i tools per ottenere i dati: non inventare mai numeri, percentuali o nomi di asset.
- Scegli i tools più adatti alla domanda e combinane più di uno se serve.
- Tutti gli importi sono in EUR.
- Rispondi in italiano, in modo chiaro e conciso, con tabelle o elenchi puntati per i numeri.
- Quando rilevi criticità (prezzi mancanti, asset non classificati, concentrazione eccessiva, liquidità elevata, minusvalenze in scadenza) segnalale.
- Per analisi complesse fornisci: sintesi iniziale, metriche chiave, rischi e osservazioni operative.
- Non dare consigli come obblighi: sei di supporto alle decisioni, non un promotore finanziario.
- Se un dato non è disponibile, dillo esplicitamente invece di stimarlo.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    messages,
    conversationId,
  }: { messages: UIMessage[]; conversationId?: string } = await req.json();

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: createAdvisorTools(user.id),
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: finalMessages }) => {
      if (!conversationId) return;
      const service = createServiceClient();
      await service.from("chat_conversations").upsert({
        id: conversationId,
        user_id: user.id,
        title: deriveTitle(finalMessages),
        messages: finalMessages,
        updated_at: new Date().toISOString(),
      });
    },
  });
}

function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "Nuova conversazione";
  const text = firstUser.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  return text.length > 80 ? text.slice(0, 80) + "…" : text || "Nuova conversazione";
}
