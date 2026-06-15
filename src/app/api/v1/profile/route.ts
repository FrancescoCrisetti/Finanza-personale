import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  return NextResponse.json({
    owner: {
      name: "Fra",
      birth_year: 1990,
      location: "San Giovanni Rotondo",
      occupation: "Sviluppatore software remoto",
    },
    accounts: [
      {
        name: "BCC",
        type: "bank",
        role: "Conto operativo: stipendio + RID + bollette",
      },
      {
        name: "Trade Republic",
        type: "broker",
        role: "PAC ETF mensile + liquidità remunerata 2% + carta cashback 1% (reinvestito in EIMI)",
      },
      {
        name: "Revolut",
        type: "bank",
        role: "Carta secondaria per acquisti online e viaggi",
      },
      {
        name: "Binance",
        type: "exchange",
        role: "Acquisto e custodia crypto",
      },
    ],
    strategy: {
      inspiration: "Paolo Coletti — 4 Pilastri",
      pillars: [
        {
          id: "P1",
          name: "Liquidità operativa",
          description: "Cash su BCC e TR per pagamenti quotidiani. Uso POS Trade Republic per cashback 1%.",
          status: "active",
        },
        {
          id: "P2",
          name: "Fondo emergenza",
          description: "Liquidità su Trade Republic remunerata al 2%. Target: €10.000.",
          target_eur: 10000,
          status: "active",
        },
        {
          id: "P3",
          name: "Obbligazioni",
          description: "Bond ladder a scadenze scalari (3, 4, 5 anni) per flussi annuali ricorrenti. Si attiva quando P2 è completato e c'è surplus.",
          status: "not_active",
        },
        {
          id: "P4",
          name: "Investimenti lungo termine",
          description: "PAC mensile su ETF (Trade Republic, metà mese). Crypto con strategia timing sui ribassi: accumulo liquidità ~4 mesi poi investo tutto insieme.",
          status: "active",
        },
      ],
    },
    philosophy: {
      etf: "Accumulo lungo termine 10+ anni. Deaccumulo parziale eventuale dopo 10 anni.",
      crypto: "Orizzonte minimo 4 anni legato al ciclo halving BTC (aprile 2024). Valutare deaccumulo parziale dopo il ciclo.",
      em_overweight: "Mercati emergenti intenzionalmente sovrappesati. Tesi: storicamente EM > US nel lunghissimo periodo.",
      pillar3_trigger: "P3 si attiva quando P2 raggiunge il target (€10k). Il surplus va in bond ladder.",
    },
    pac_schedule: {
      frequency: "monthly",
      timing: "metà mese",
      platform: "Trade Republic",
      assets: ["EIMI", "MEUD", "MWRD", "CSUK", "CSPXJ"],
    },
    notes: "Sono un privato che vuole investire e far crescere il suo patrimonio. Analizza i dati, ragiona sulle decisioni, mostra pro/contro senza dare raccomandazioni da professionista regolamentato.",
  });
}
