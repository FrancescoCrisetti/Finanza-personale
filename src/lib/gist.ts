import { createServiceClient } from "@/lib/supabase/service";

const PROFILE = {
  owner: {
    name: "Fra",
    birth_year: 1990,
    location: "San Giovanni Rotondo",
    occupation: "Sviluppatore software remoto",
  },
  accounts: [
    { name: "BCC", type: "bank", role: "Conto operativo: stipendio + RID + bollette" },
    { name: "Trade Republic", type: "broker", role: "PAC ETF mensile + liquidità remunerata 2% + carta cashback 1% (reinvestito in EIMI)" },
    { name: "Revolut", type: "bank", role: "Carta secondaria per acquisti online e viaggi" },
    { name: "Binance", type: "exchange", role: "Acquisto e custodia crypto" },
  ],
  strategy: {
    pillars: [
      { id: "P1", name: "Liquidità operativa", status: "active", description: "Cash su BCC e TR per pagamenti quotidiani. Uso POS Trade Republic per cashback 1%." },
      { id: "P2", name: "Fondo emergenza", status: "active", description: "Liquidità su Trade Republic remunerata al 2%. Target: €10.000." },
      { id: "P3", name: "Obbligazioni", status: "not_active", description: "Bond ladder a scadenze scalari (3, 4, 5 anni) per flussi annuali ricorrenti. Si attiva quando P2 è completato." },
      { id: "P4", name: "Investimenti lungo termine", status: "active", description: "PAC mensile su ETF (Trade Republic, metà mese). Crypto con strategia timing sui ribassi." },
    ],
  },
  philosophy: {
    etf: "Accumulo lungo termine 10+ anni.",
    crypto: "Orizzonte minimo 4 anni legato al ciclo halving BTC.",
    em_overweight: "Mercati emergenti sovrappesati: tesi EM > US nel lunghissimo periodo.",
  },
};

export async function buildProfileText(userId: string): Promise<string> {
  const supabase = createServiceClient();

  const PAGE_SIZE = 1000;
  let allTransactions: Array<Record<string, unknown>> = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("transactions")
      .select("*, accounts(name), assets(ticker, type)")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    allTransactions = allTransactions.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const cash: Record<string, number> = {};
  const holdings: Record<string, { ticker: string; type: string; quantity: number; totalCost: number }> = {};

  for (const tx of allTransactions) {
    const accountName = (tx.accounts as { name: string })?.name || "Unknown";
    if (!cash[accountName]) cash[accountName] = 0;

    const amount = tx.amount_eur as number;
    const type = tx.type as string;

    if (["DEPOSIT", "INCOME", "TRANSFER_IN", "SAVEBACK", "DIVIDEND"].includes(type)) {
      cash[accountName] += amount;
    } else if (["WITHDRAW", "EXPENSE", "TRANSFER_OUT", "BUY", "FEE"].includes(type)) {
      cash[accountName] -= amount;
    } else if (type === "SELL") {
      cash[accountName] += amount;
    }

    const asset = tx.assets as { ticker: string; type: string } | null;
    if (asset && tx.quantity) {
      const key = asset.ticker;
      if (!holdings[key]) holdings[key] = { ticker: asset.ticker, type: asset.type, quantity: 0, totalCost: 0 };
      if (type === "BUY") {
        holdings[key].quantity += tx.quantity as number;
        holdings[key].totalCost += amount;
      } else if (type === "SELL") {
        holdings[key].quantity -= tx.quantity as number;
        holdings[key].totalCost -= amount;
      }
    }
  }

  const activeHoldings = Object.values(holdings).filter((h) => h.quantity > 0);

  const lines: string[] = [];
  lines.push("=== PROFILO FINANZIARIO PERSONALE ===");
  lines.push(`Data aggiornamento: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`Nome: ${PROFILE.owner.name}`);
  lines.push(`Anno nascita: ${PROFILE.owner.birth_year}`);
  lines.push(`Località: ${PROFILE.owner.location}`);
  lines.push(`Occupazione: ${PROFILE.owner.occupation}`);
  lines.push("");

  lines.push("--- CONTI ---");
  for (const acc of PROFILE.accounts) {
    lines.push(`• ${acc.name} (${acc.type}): ${acc.role}`);
  }
  lines.push("");

  lines.push("--- STRATEGIA (4 Pilastri - Paolo Coletti) ---");
  for (const p of PROFILE.strategy.pillars) {
    lines.push(`${p.id} ${p.name} [${p.status}]: ${p.description}`);
  }
  lines.push("");

  lines.push("--- FILOSOFIA ---");
  lines.push(`ETF: ${PROFILE.philosophy.etf}`);
  lines.push(`Crypto: ${PROFILE.philosophy.crypto}`);
  lines.push(`EM overweight: ${PROFILE.philosophy.em_overweight}`);
  lines.push("");

  lines.push("--- SALDI CASH PER CONTO ---");
  for (const [name, amount] of Object.entries(cash)) {
    lines.push(`• ${name}: €${(amount as number).toFixed(2)}`);
  }
  lines.push("");

  lines.push(`--- POSIZIONI APERTE (${activeHoldings.length}) ---`);
  for (const h of activeHoldings) {
    const avgPrice = h.quantity > 0 ? (h.totalCost / h.quantity).toFixed(2) : "0";
    lines.push(`• ${h.ticker} (${h.type}): ${h.quantity} unità, costo medio €${avgPrice}, costo totale €${h.totalCost.toFixed(2)}`);
  }
  lines.push("");

  lines.push(`Totale transazioni elaborate: ${allTransactions.length}`);
  lines.push("");
  lines.push("NOTA: Sono un privato. Analizza dati e pro/contro senza dare raccomandazioni da professionista regolamentato.");

  return lines.join("\n");
}

export async function updateGist(content: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const gistId = process.env.GITHUB_GIST_ID;

  if (!token || !gistId) {
    return { success: false, error: "GITHUB_TOKEN o GITHUB_GIST_ID non configurati" };
  }

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "profilo-finanziario.txt": { content },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, error: `GitHub API ${res.status}: ${body}` };
  }

  const data = await res.json();
  const rawUrl = data.files?.["profilo-finanziario.txt"]?.raw_url;

  return { success: true, url: rawUrl };
}
