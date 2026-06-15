export interface ParsedTransaction {
  date: string;
  type:
    | "INCOME"
    | "EXPENSE"
    | "DEPOSIT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "FEE";
  amount_eur: number;
  description: string;
  category: string | null;
  source_id: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseRevolutTransactions(csvText: string): ParsedTransaction[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 9) continue;

    const [tipo, , dataInizio, dataCompletamento, descrizione, importoStr, costoStr, valuta, stato] = fields;

    // Skip cancelled transactions
    if (stato?.trim() === "OPERAZIONE ANNULLATA") continue;

    // Skip balance migrations (internal, net zero)
    if (descrizione?.includes("Balance migration")) continue;

    const importo = parseFloat(importoStr) || 0;
    const costo = parseFloat(costoStr) || 0;

    if (importo === 0 && costo === 0) continue;

    // Use completion date if available, otherwise start date
    const rawDate = (dataCompletamento || dataInizio || "").trim();
    const date = rawDate.substring(0, 10); // YYYY-MM-DD
    if (!date || date.length < 10) continue;

    const desc = (descrizione || "").trim();
    // For outflows (importo < 0): total spend = |importo| + |costo|
    // For inflows (importo >= 0): the fee reduces the effective amount
    // For Addebita with importo=0: the fee IS the charge
    const amount = Math.abs(importo) + Math.abs(costo);

    // Generate a deterministic source_id
    const sourceId = `revolut_${date}_${tipo?.trim()}_${amount}_${i}`;

    const tx = categorize(tipo?.trim(), desc, importo, amount, date, sourceId);
    if (tx) transactions.push(tx);
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}

function categorize(
  tipo: string,
  desc: string,
  importo: number,
  amount: number,
  date: string,
  sourceId: string
): ParsedTransaction | null {
  const descUpper = desc.toUpperCase();

  switch (tipo) {
    case "Ricarica": {
      // Top-ups from BCC card → transfer from BCC
      return {
        date,
        type: "TRANSFER_IN",
        amount_eur: amount,
        description: desc,
        category: "Da BCC (carta)",
        source_id: sourceId,
      };
    }

    case "Pagamento con carta": {
      // Card payments are expenses (amount is negative)
      return {
        date,
        type: "EXPENSE",
        amount_eur: amount,
        description: desc,
        category: "Carta Revolut",
        source_id: sourceId,
      };
    }

    case "Rimborso su carta": {
      // Card refunds → income (reduce net expenses)
      return {
        date,
        type: "INCOME",
        amount_eur: amount,
        description: `Rimborso: ${desc}`,
        category: "Rimborso",
        source_id: sourceId,
      };
    }

    case "Pagamento": {
      // Transfers: need to distinguish direction and recipient
      if (importo < 0) {
        // Outgoing
        if (
          descUpper.includes("TO FRANCESCO CRISETTI") ||
          descUpper.includes("TO  FRANCESCO CRISETTI")
        ) {
          // Transfer to own Trade Republic account
          return {
            date,
            type: "TRANSFER_OUT",
            amount_eur: amount,
            description: desc,
            category: "A Trade Republic",
            source_id: sourceId,
          };
        }
        // Payment to someone else
        return {
          date,
          type: "EXPENSE",
          amount_eur: amount,
          description: desc,
          category: "Bonifico uscita",
          source_id: sourceId,
        };
      } else {
        // Incoming payment from someone
        return {
          date,
          type: "DEPOSIT",
          amount_eur: amount,
          description: desc,
          category: "Bonifico entrata",
          source_id: sourceId,
        };
      }
    }

    case "Pagamento Revolut": {
      // Revolut Pay payments (e.g. Booking.com)
      return {
        date,
        type: "EXPENSE",
        amount_eur: amount,
        description: desc,
        category: "Revolut Pay",
        source_id: sourceId,
      };
    }

    case "Cambia valuta": {
      // Currency exchange (EUR → other) — treat as expense (money left EUR wallet)
      return {
        date,
        type: "EXPENSE",
        amount_eur: amount,
        description: desc,
        category: "Cambio valuta",
        source_id: sourceId,
      };
    }

    case "Rimborso": {
      // Generic refund (different from "Rimborso su carta")
      return {
        date,
        type: "INCOME",
        amount_eur: amount,
        description: desc,
        category: "Rimborso",
        source_id: sourceId,
      };
    }

    case "Addebita": {
      // Fees/subscriptions (e.g. Premium plan)
      if (amount === 0) return null; // Skip zero-amount rows
      return {
        date,
        type: "FEE",
        amount_eur: amount,
        description: desc,
        category: "Commissioni Revolut",
        source_id: sourceId,
      };
    }

    default:
      return null;
  }
}
