import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, jsonError } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllTransactions, computeHoldingsAndRealized, computeTax, round } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return jsonError(auth.error, auth.status);

  const supabase = createServiceClient();
  const currentYear = new Date().getFullYear();

  const [transactions, { data: losses }] = await Promise.all([
    fetchAllTransactions(supabase, auth.userId),
    supabase.from("tax_capital_losses").select("*").eq("user_id", auth.userId).order("year", { ascending: true }),
  ]);

  const { realized } = computeHoldingsAndRealized(transactions);
  const byYear = computeTax(realized, transactions);

  // Zainetto fiscale: minusvalenze a credito non ancora scadute (anno corrente <= expires_year).
  const activeLosses = (losses || []).filter((l) => Number(l.expires_year) >= currentYear);
  const taxShield = activeLosses.reduce((s, l) => s + Number(l.amount_eur), 0);

  return NextResponse.json({
    by_year: byYear,
    tax_shield: {
      total_available: round(taxShield),
      entries: (losses || []).map((l) => ({
        year: l.year,
        amount_eur: round(Number(l.amount_eur)),
        expires_year: l.expires_year,
        expired: Number(l.expires_year) < currentYear,
        notes: l.notes,
      })),
    },
    note: "Plus/minus realizzate calcolate col metodo del costo medio dalle vendite. Lo zainetto fiscale (minusvalenze compensabili, scadenza 4 anni) è inserito manualmente. Valori indicativi, non consulenza fiscale.",
  });
}
