import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const base = `${request.nextUrl.origin}/api/v1`;
  const token = request.nextUrl.searchParams.get("token") || "<TOKEN>";

  return NextResponse.json({
    name: "Finanza Personale API",
    version: "1.0",
    authentication: `Aggiungi ?token=<TOKEN> a qualsiasi URL oppure usa header Authorization: Bearer <TOKEN>`,
    endpoints: [
      {
        path: "/api/v1/profile",
        method: "GET",
        description: "Profilo utente, conti, strategia di investimento (4 pilastri), filosofia, configurazione PAC. Chiamalo per primo per capire chi è l'utente e i suoi obiettivi.",
        url: `${base}/profile?token=${token}`,
      },
      {
        path: "/api/v1/summary",
        method: "GET",
        description: "Snapshot del portafoglio: saldo cash per ogni conto, posizioni (ticker, tipo, quantità, costo totale), numero transazioni.",
        url: `${base}/summary?token=${token}`,
      },
      {
        path: "/api/v1/transactions",
        method: "GET",
        description: "Lista transazioni paginata (dal più recente). Filtrabile per tipo e conto.",
        url: `${base}/transactions?token=${token}`,
        parameters: [
          { name: "limit", default: 100, description: "Risultati per pagina (max 1000)" },
          { name: "offset", default: 0, description: "Offset per paginazione" },
          { name: "type", description: "Filtra per tipo: BUY, SELL, DEPOSIT, WITHDRAW, EXPENSE, INCOME, TRANSFER_IN, TRANSFER_OUT, FEE, DIVIDEND" },
          { name: "account", description: "Filtra per nome conto (es. Trade Republic, BCC, Revolut, Binance)" },
          { name: "account_id", description: "Filtra per id (UUID) del conto. Alternativa più precisa al nome" },
          { name: "from", description: "Data minima inclusa (YYYY-MM-DD). Usabile da sola o con 'to'" },
          { name: "to", description: "Data massima inclusa (YYYY-MM-DD). Usabile da sola o con 'from'" },
        ],
      },
      {
        path: "/api/v1/holdings",
        method: "GET",
        description: "Posizioni con valore di mercato attuale, costo medio, P&L (guadagno/perdita) e peso %. Prezzi da CoinGecko (crypto) e Yahoo Finance (ETF). Aggiungi ?refresh=1 per forzare l'aggiornamento prezzi.",
        url: `${base}/holdings?token=${token}`,
      },
      {
        path: "/api/v1/allocation",
        method: "GET",
        description: "Asset allocation: ripartizione per classe, per singola posizione e (se taggati) per area geografica e settore. Include il cash.",
        url: `${base}/allocation?token=${token}`,
      },
      {
        path: "/api/v1/networth",
        method: "GET",
        description: "Patrimonio netto: valore di mercato investito + cash + asset esterni (immobili, TFR, pensione) - passività/debiti.",
        url: `${base}/networth?token=${token}`,
      },
      {
        path: "/api/v1/cashflow",
        method: "GET",
        description: "Flussi di cassa mensili (entrate, uscite, netto, investito) e tasso di risparmio. Parametro 'months' per limitare agli ultimi N mesi.",
        url: `${base}/cashflow?token=${token}`,
        parameters: [{ name: "months", description: "Limita agli ultimi N mesi" }],
      },
      {
        path: "/api/v1/performance",
        method: "GET",
        description: "Performance: XIRR (rendimento annualizzato ponderato per i flussi) complessivo e per asset, P&L e dividendi totali.",
        url: `${base}/performance?token=${token}`,
      },
      {
        path: "/api/v1/tax",
        method: "GET",
        description: "Fiscalità: plus/minusvalenze realizzate per anno (metodo costo medio), dividendi e zainetto fiscale (minusvalenze compensabili). Valori indicativi.",
        url: `${base}/tax?token=${token}`,
      },
      {
        path: "/api/v1/strategy",
        method: "GET",
        description: "Configurazione della strategia di investimento attiva.",
        url: `${base}/strategy?token=${token}`,
      },
    ],
    transaction_types: {
      "BUY": "+asset, -cash — Acquisto ETF/crypto",
      "SELL": "-asset, +cash — Vendita ETF/crypto",
      "DEPOSIT": "+cash — Denaro in ingresso dall'esterno",
      "WITHDRAW": "-cash — Denaro in uscita verso l'esterno",
      "INCOME": "+cash — Interessi, cashback, rimborsi",
      "EXPENSE": "-cash — Pagamenti carta, abbonamenti",
      "TRANSFER_IN": "+cash — Trasferimento da altro conto proprio",
      "TRANSFER_OUT": "-cash — Trasferimento verso altro conto proprio",
      "FEE": "-cash — Commissioni, tasse",
      "DIVIDEND": "+cash — Dividendi",
    },
    notes: "Tutti gli importi sono in EUR. Le posizioni con quantity > 0 sono attive. Il cash è calcolato dalla somma algebrica di tutte le transazioni per conto.",
  });
}
