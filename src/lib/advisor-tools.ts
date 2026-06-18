import { tool } from "ai";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchAllTransactions,
  computeHoldingsAndRealized,
  enrichHoldingsWithPrices,
  computeCashByAccount,
  computeCashflow,
  computePortfolioXirr,
  computeTax,
  computeAllocation,
  xirr,
  type Holding,
} from "@/lib/analytics";

const r = (n: number | null | undefined) =>
  n == null ? null : Math.round(n * 100) / 100;

async function buildSnapshot(userId: string) {
  const supabase = createServiceClient();
  const transactions = await fetchAllTransactions(supabase, userId);
  const { holdings, realized } = computeHoldingsAndRealized(transactions);
  const { holdings: enriched, totalMarketValue } = await enrichHoldingsWithPrices(
    supabase,
    userId,
    holdings
  );
  const cashByAccount = computeCashByAccount(transactions);
  const totalCash = Object.values(cashByAccount).reduce((s, v) => s + v, 0);
  return { transactions, holdings: enriched, realized, totalMarketValue, cashByAccount, totalCash };
}

type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

export function createAdvisorTools(userId: string) {
  const supabase = createServiceClient();
  let snapPromise: Promise<Snapshot> | null = null;
  const snap = () => (snapPromise ??= buildSnapshot(userId));

  return {
    getPortfolioSummary: tool({
      description:
        "Riepilogo del portafoglio: valore di mercato investito, liquidità, valore totale, costo investito, P&L complessivo e rendimento annualizzato (XIRR).",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snap();
        const totalCost = s.holdings.reduce((a, h) => a + h.totalCost, 0);
        const totalPnl = s.holdings.reduce((a, h) => a + (h.pnl || 0), 0);
        const xirrVal = computePortfolioXirr(s.transactions, s.totalMarketValue);
        return {
          total_market_value: r(s.totalMarketValue),
          total_cash: r(s.totalCash),
          total_portfolio_value: r(s.totalMarketValue + s.totalCash),
          total_invested_cost: r(totalCost),
          total_pnl: r(totalPnl),
          total_pnl_pct: totalCost > 0 ? r((totalPnl / totalCost) * 100) : null,
          xirr_pct: xirrVal != null ? r(xirrVal * 100) : null,
          positions_count: s.holdings.length,
          transactions_count: s.transactions.length,
        };
      },
    }),

    getHoldings: tool({
      description:
        "Elenco delle posizioni attualmente detenute con quantità, costo medio, prezzo corrente, valore di mercato, P&L e peso percentuale.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snap();
        return {
          holdings: s.holdings.map((h) => ({
            ticker: h.ticker,
            name: h.name,
            type: h.type,
            asset_class: h.asset_class,
            quantity: r(h.quantity),
            avg_cost: r(h.avgCost),
            current_price: r(h.currentPrice),
            market_value: r(h.marketValue),
            pnl: r(h.pnl),
            pnl_pct: r(h.pnlPct),
            weight_pct: r(h.weightPct),
            priced: h.priced,
          })),
          unpriced: s.holdings.filter((h) => !h.priced).map((h) => h.ticker),
        };
      },
    }),

    getAllocation: tool({
      description:
        "Ripartizione del portafoglio per classe di attività, per singola posizione, per area geografica e per settore (inclusa la liquidità).",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snap();
        return computeAllocation(s.holdings, s.totalCash);
      },
    }),

    getNetWorth: tool({
      description:
        "Patrimonio netto: valore di mercato degli investimenti + liquidità + asset esterni (immobili, TFR, pensione, contante) - passività (mutui, prestiti).",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snap();
        const [{ data: liabilities }, { data: external }] = await Promise.all([
          supabase.from("liabilities").select("type, name, amount_eur").eq("user_id", userId),
          supabase.from("external_assets").select("type, name, value_eur").eq("user_id", userId),
        ]);
        const liabTotal = (liabilities || []).reduce((a, l) => a + Number(l.amount_eur), 0);
        const extTotal = (external || []).reduce((a, e) => a + Number(e.value_eur), 0);
        const portfolioValue = s.totalMarketValue + s.totalCash;
        return {
          net_worth: r(portfolioValue + extTotal - liabTotal),
          breakdown: {
            investments_market_value: r(s.totalMarketValue),
            cash: r(s.totalCash),
            external_assets: r(extTotal),
            liabilities: r(liabTotal),
          },
          cash_by_account: Object.fromEntries(
            Object.entries(s.cashByAccount).map(([k, v]) => [k, r(v)])
          ),
          external_assets: external || [],
          liabilities: liabilities || [],
        };
      },
    }),

    getCashflow: tool({
      description:
        "Flussi di cassa mensili (entrate, uscite, netto, investito, tasso di risparmio) con i totali. Opzionale: limita agli ultimi N mesi.",
      inputSchema: z.object({
        months: z.number().int().positive().optional().describe("Numero di ultimi mesi da includere"),
      }),
      execute: async ({ months }) => {
        const s = await snap();
        const cf = computeCashflow(s.transactions);
        const monthly = months ? cf.monthly.slice(-months) : cf.monthly;
        return { monthly, totals: cf.totals };
      },
    }),

    getPerformance: tool({
      description:
        "Performance del portafoglio: XIRR complessivo annualizzato e XIRR per singolo asset, oltre a P&L e dividendi totali.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snap();
        const portfolioXirr = computePortfolioXirr(s.transactions, s.totalMarketValue);
        const byAssetId = new Map<string, Holding>();
        for (const h of s.holdings) byAssetId.set(h.asset_id, h);

        const flowsByAsset = new Map<string, { date: Date; amount: number }[]>();
        for (const tx of s.transactions) {
          if (!tx.asset_id) continue;
          const amount = Number(tx.amount_eur) || 0;
          let f = flowsByAsset.get(tx.asset_id);
          if (!f) flowsByAsset.set(tx.asset_id, (f = []));
          if (tx.type === "BUY") f.push({ date: new Date(tx.date), amount: -amount });
          else if (tx.type === "SELL") f.push({ date: new Date(tx.date), amount });
          else if (tx.type === "DIVIDEND") f.push({ date: new Date(tx.date), amount });
        }

        const byAsset = [];
        for (const [assetId, flows] of flowsByAsset) {
          const h = byAssetId.get(assetId);
          const terminal = h?.marketValue || 0;
          const all = [...flows];
          if (h && h.quantity > 0) all.push({ date: new Date(), amount: terminal });
          all.sort((a, b) => a.date.getTime() - b.date.getTime());
          const x = xirr(all);
          byAsset.push({
            ticker: h?.ticker || assetId,
            xirr_pct: x != null ? r(x * 100) : null,
            pnl: r(h?.pnl ?? null),
            market_value: r(h?.marketValue ?? null),
          });
        }

        const dividends = s.transactions
          .filter((t) => t.type === "DIVIDEND")
          .reduce((a, t) => a + Number(t.amount_eur), 0);

        return {
          portfolio_xirr_pct: portfolioXirr != null ? r(portfolioXirr * 100) : null,
          dividends_total: r(dividends),
          by_asset: byAsset,
        };
      },
    }),

    getTax: tool({
      description:
        "Situazione fiscale: plusvalenze/minusvalenze realizzate per anno (metodo costo medio), dividendi e zainetto fiscale (minusvalenze a riporto con scadenza a 4 anni).",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snap();
        const byYear = computeTax(s.realized, s.transactions);
        const { data: losses } = await supabase
          .from("tax_capital_losses")
          .select("year, amount_eur, expires_year, notes")
          .eq("user_id", userId)
          .order("year");
        const currentYear = new Date().getFullYear();
        const available = (losses || []).filter((l) => l.expires_year >= currentYear);
        const taxShield = available.reduce((a, l) => a + Number(l.amount_eur), 0);
        return {
          by_year: byYear,
          tax_shield: {
            available_eur: r(taxShield),
            entries: losses || [],
          },
        };
      },
    }),

    getTransactions: tool({
      description:
        "Storico delle transazioni filtrabile per intervallo di date e tipo. Utile per analisi di dettaglio. Limita il numero di risultati restituiti.",
      inputSchema: z.object({
        from: z.string().optional().describe("Data inizio inclusa, formato YYYY-MM-DD"),
        to: z.string().optional().describe("Data fine inclusa, formato YYYY-MM-DD"),
        type: z
          .string()
          .optional()
          .describe("Tipo: BUY, SELL, DEPOSIT, WITHDRAW, EXPENSE, INCOME, TRANSFER_IN, TRANSFER_OUT, FEE, DIVIDEND"),
        limit: z.number().int().positive().max(200).optional().describe("Max risultati (default 50)"),
      }),
      execute: async ({ from, to, type, limit }) => {
        const s = await snap();
        let txs = s.transactions;
        if (from) txs = txs.filter((t) => t.date >= from);
        if (to) txs = txs.filter((t) => t.date <= to);
        if (type) txs = txs.filter((t) => t.type === type.toUpperCase());
        const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
        const sliced = sorted.slice(0, limit || 50);
        return {
          count: txs.length,
          returned: sliced.length,
          transactions: sliced.map((t) => ({
            date: t.date,
            type: t.type,
            account: t.accounts?.name || null,
            asset: t.assets?.ticker || null,
            quantity: r(t.quantity),
            amount_eur: r(t.amount_eur),
            description: t.description,
          })),
        };
      },
    }),

    getProfile: tool({
      description:
        "Profilo dell'investitore: anagrafica, profilo di rischio, filosofia di investimento, piano di accumulo (PAC), obiettivi finanziari e note.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: profile }, { data: goals }, { data: accounts }] = await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("goals").select("*").eq("user_id", userId).order("priority"),
          supabase.from("accounts").select("name, type").eq("user_id", userId),
        ]);
        return { profile: profile || null, goals: goals || [], accounts: accounts || [] };
      },
    }),
  };
}
