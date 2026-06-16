import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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
        ],
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
