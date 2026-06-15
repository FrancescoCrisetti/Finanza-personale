export interface ParsedTransaction {
  date: string;
  type: "INCOME" | "EXPENSE" | "DEPOSIT" | "WITHDRAW" | "TRANSFER_IN" | "TRANSFER_OUT" | "FEE";
  amount_eur: number;
  description: string;
  category: string | null;
  source_id: string;
}

function parseItalianDate(dateStr: string): string {
  // DD/MM/YYYY → YYYY-MM-DD
  const [dd, mm, yyyy] = dateStr.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function parseItalianAmount(amountStr: string): number {
  // "1.000,00" → 1000.00
  if (!amountStr || amountStr.trim() === "") return 0;
  return parseFloat(amountStr.replace(/\./g, "").replace(",", "."));
}

function categorizeTransaction(
  description: string,
  isCredit: boolean
): { type: ParsedTransaction["type"]; category: string | null } {
  const desc = description.toUpperCase();

  // --- CREDITS (AVERE) ---
  if (isCredit) {
    if (desc.includes("ACCREDITO STIPENDI") || desc.includes("STIPENDIO")) {
      return { type: "INCOME", category: "Stipendio" };
    }
    if (desc.includes("VERS.CONT.DA ATM")) {
      return { type: "DEPOSIT", category: "Versamento contanti" };
    }
    if (desc.includes("INVIATO DA REVOLUT")) {
      return { type: "TRANSFER_IN", category: "Da Revolut" };
    }
    if (desc.includes("PARTECIPAZIONE ALLA RATA MUTUO")) {
      return { type: "INCOME", category: "Rimborso mutuo papà" };
    }
    if (desc.includes("STORNO")) {
      return { type: "INCOME", category: "Storno" };
    }
    if (desc.includes("FONDO DI ASSISTENZA SANITARIA")) {
      return { type: "INCOME", category: "Rimborso sanitario" };
    }
    if (desc.includes("AUTOSTRADE") && desc.includes("RIMBORSO")) {
      return { type: "INCOME", category: "Rimborso autostrade" };
    }
    return { type: "INCOME", category: null };
  }

  // --- DEBITS (DARE) ---
  if (desc.includes("PAGAMENTO RATA MUTUO")) {
    return { type: "EXPENSE", category: "Mutuo" };
  }
  if (desc.includes("BOLLETTA TELEFONO")) {
    return { type: "EXPENSE", category: "Telefono" };
  }
  if (
    desc.includes("RID/SDD") &&
    (desc.includes("YADA ENERGIA") || desc.includes("ENERGIA"))
  ) {
    return { type: "EXPENSE", category: "Bollette energia" };
  }
  if (desc.includes("TELEPASS")) {
    return { type: "EXPENSE", category: "Telepass" };
  }
  if (desc.includes("PREL.ATM") || desc.includes("PRELIEVO")) {
    return { type: "WITHDRAW", category: "Prelievo ATM" };
  }
  if (desc.includes("INTERESSI E/O COMP.A DEBITO")) {
    return { type: "FEE", category: "Commissioni banca" };
  }
  // Transfers to own accounts
  if (
    desc.includes("IT41H0367401600000752412311") || // Trade Republic IBAN
    (desc.includes("CRISETTI") &&
      desc.includes("RICARICA CONTO MIO")) ||
    desc.includes("TRASFERIMENTO AL MIO CONTO") ||
    (desc.includes("A FAV: FRANCESCO CRISETTI") &&
      !desc.includes("REVOLUT"))
  ) {
    return { type: "TRANSFER_OUT", category: "A Trade Republic" };
  }
  if (desc.includes("REVOLUT**8317")) {
    return { type: "TRANSFER_OUT", category: "A Revolut" };
  }
  if (desc.includes("PAGAMENTO TRAMITE POS")) {
    return { type: "EXPENSE", category: "POS" };
  }
  if (desc.includes("ADDEBITO BONIFICI") || desc.includes("DISPOSIZ. BONIFICO")) {
    return { type: "EXPENSE", category: "Bonifico" };
  }
  if (desc.includes("UTILIZZO CARTE CRED")) {
    return { type: "EXPENSE", category: "Carta di credito" };
  }
  if (desc.includes("RID/SDD")) {
    return { type: "EXPENSE", category: "RID/SDD" };
  }
  if (desc.includes("PREL.EURCHEQUE ESTERO")) {
    return { type: "WITHDRAW", category: "Prelievo estero" };
  }

  return { type: "EXPENSE", category: null };
}

export function parseBCCTransactions(csvText: string): ParsedTransaction[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(";");
    if (parts.length < 6) continue;

    const [data, valuta, dare, avere, , descrizione] = parts;

    // Skip summary rows and pending transactions
    if (!data || data.trim() === "") continue;
    if (valuta?.trim() === "prenotata") continue;
    if (
      descrizione?.includes("Saldo contabile") ||
      descrizione?.includes("Saldo liquido") ||
      descrizione?.includes("Disponibilità al")
    ) {
      continue;
    }

    const dateStr = parseItalianDate(data.trim());
    const dareAmount = parseItalianAmount(dare);
    const avereAmount = parseItalianAmount(avere);

    if (dareAmount === 0 && avereAmount === 0) continue;

    const isCredit = avereAmount > 0;
    const amount = isCredit ? avereAmount : dareAmount;
    const desc = descrizione?.trim() || "";

    const { type, category } = categorizeTransaction(desc, isCredit);

    const sourceId = `bcc_${dateStr}_${type}_${amount}_${i}`;

    transactions.push({
      date: dateStr,
      type,
      amount_eur: amount,
      description: desc,
      category,
      source_id: sourceId,
    });
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}
