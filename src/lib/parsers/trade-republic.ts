export interface ParsedTransaction {
  date: string;
  type:
    | "BUY"
    | "INCOME"
    | "EXPENSE"
    | "DEPOSIT"
    | "WITHDRAW"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "FEE";
  asset: string | null;
  quantity: number | null;
  unit_price_eur: number | null;
  amount_eur: number;
  description: string | null;
  category: string | null;
  source_id: string;
  raw_json: Record<string, unknown> | null;
}

interface CsvRow {
  datetime: string;
  date: string;
  account_type: string;
  category: string;
  type: string;
  asset_class: string;
  name: string;
  symbol: string;
  shares: string;
  price: string;
  amount: string;
  fee: string;
  tax: string;
  currency: string;
  original_amount: string;
  original_currency: string;
  fx_rate: string;
  description: string;
  transaction_id: string;
  counterparty_name: string;
  counterparty_iban: string;
  payment_reference: string;
  mcc_code: string;
}

// IBANs dei propri conti per riconoscere i transfer tra conti propri
const OWN_IBANS = [
  "IT56T0881078590000010045074", // BCC
  "LT243250084473005835", // Revolut
];

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

function parseRow(fields: string[]): CsvRow {
  return {
    datetime: fields[0] || "",
    date: fields[1] || "",
    account_type: fields[2] || "",
    category: fields[3] || "",
    type: fields[4] || "",
    asset_class: fields[5] || "",
    name: fields[6] || "",
    symbol: fields[7] || "",
    shares: fields[8] || "",
    price: fields[9] || "",
    amount: fields[10] || "",
    fee: fields[11] || "",
    tax: fields[12] || "",
    currency: fields[13] || "",
    original_amount: fields[14] || "",
    original_currency: fields[15] || "",
    fx_rate: fields[16] || "",
    description: fields[17] || "",
    transaction_id: fields[18] || "",
    counterparty_name: fields[19] || "",
    counterparty_iban: fields[20] || "",
    payment_reference: fields[21] || "",
    mcc_code: fields[22] || "",
  };
}

function num(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

export function parseTradeRepublicTransactions(
  csvText: string
): ParsedTransaction[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // First pass: collect saveback amounts to tag corresponding BUYs
  const savebackAmounts = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 19) continue;
    const row = parseRow(fields);
    if (row.type === "BENEFITS_SAVEBACK") {
      // Key: date + symbol + amount to match with the BUY
      const amt = Math.abs(num(row.amount));
      savebackAmounts.add(`${row.symbol}_${amt.toFixed(2)}`);
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 19) continue;

    const row = parseRow(fields);
    const tx = mapRow(row, savebackAmounts);
    if (tx) transactions.push(tx);
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}

function mapRow(row: CsvRow, savebackAmounts: Set<string>): ParsedTransaction | null {
  const amount = num(row.amount);
  const fee = num(row.fee);
  const tax = num(row.tax);
  const shares = num(row.shares);
  const price = num(row.price);

  switch (row.type) {
    // --- TRADING ---
    case "BUY": {
      const amt = Math.abs(amount);
      const savebackKey = `${row.symbol}_${amt.toFixed(2)}`;
      const isSaveback = savebackAmounts.has(savebackKey);
      if (isSaveback) savebackAmounts.delete(savebackKey);

      return {
        date: row.date,
        type: "BUY",
        asset: row.symbol || null,
        quantity: shares,
        unit_price_eur: price,
        amount_eur: amt,
        description: row.name,
        category: isSaveback ? "Saveback" : "PAC ETF",
        source_id: row.transaction_id,
        raw_json: isSaveback
          ? { saveback: true }
          : row.description.includes("Savings plan")
            ? { savings_plan: true }
            : null,
      };
    }

    // --- INTEREST (net of tax) ---
    case "INTEREST_PAYMENT": {
      const net = amount + tax; // tax is negative, net is what's actually credited
      return {
        date: row.date,
        type: "INCOME",
        asset: null,
        quantity: null,
        unit_price_eur: null,
        amount_eur: net,
        description: "Interessi sulla liquidità",
        category: "Interessi",
        source_id: row.transaction_id,
        raw_json: tax ? { gross: amount, tax: Math.abs(tax), net } : null,
      };
    }

    // --- SAVEBACK (cash credited, then spent by the corresponding BUY) ---
    case "BENEFITS_SAVEBACK": {
      return {
        date: row.date,
        type: "INCOME",
        asset: row.symbol || null,
        quantity: null,
        unit_price_eur: null,
        amount_eur: amount,
        description: "Saveback",
        category: "Saveback",
        source_id: row.transaction_id,
        raw_json: null,
      };
    }

    // --- TAX OPTIMIZATION ---
    case "TAX_OPTIMIZATION": {
      if (tax === 0) return null;
      // tax < 0 = tax payment (money out), tax > 0 = tax refund (money in)
      return {
        date: row.date,
        type: tax > 0 ? "INCOME" : "FEE",
        asset: null,
        quantity: null,
        unit_price_eur: null,
        amount_eur: Math.abs(tax),
        description: tax > 0 ? "Rimborso tasse" : "Ottimizzazione fiscale",
        category: "Tasse",
        source_id: row.transaction_id,
        raw_json: null,
      };
    }

    // --- CARD SPENDING ---
    case "CARD_TRANSACTION": {
      // Positive amount = card refund
      if (amount > 0) {
        return {
          date: row.date,
          type: "INCOME",
          asset: null,
          quantity: null,
          unit_price_eur: null,
          amount_eur: amount,
          description: row.name.trim() || "Rimborso carta",
          category: "Rimborso carta",
          source_id: row.transaction_id,
          raw_json: row.mcc_code ? { mcc_code: row.mcc_code } : null,
        };
      }
      // Card payments to Revolut are transfers, not expenses
      if (row.name.includes("Revolut")) {
        return {
          date: row.date,
          type: "TRANSFER_OUT",
          asset: null,
          quantity: null,
          unit_price_eur: null,
          amount_eur: Math.abs(amount),
          description: `Ricarica Revolut via carta`,
          category: "A Revolut",
          source_id: row.transaction_id,
          raw_json: null,
        };
      }
      return {
        date: row.date,
        type: "EXPENSE",
        asset: null,
        quantity: null,
        unit_price_eur: null,
        amount_eur: Math.abs(amount),
        description: row.name.trim(),
        category: "Carta TR",
        source_id: row.transaction_id,
        raw_json: row.mcc_code ? { mcc_code: row.mcc_code } : null,
      };
    }

    // --- CARD FEE ---
    case "CARD_ORDERING_FEE": {
      return {
        date: row.date,
        type: "FEE",
        asset: null,
        quantity: null,
        unit_price_eur: null,
        amount_eur: Math.abs(fee),
        description: "Costo carta Trade Republic",
        category: "Commissioni",
        source_id: row.transaction_id,
        raw_json: null,
      };
    }

    // --- DEPOSITS ---
    case "CUSTOMER_INPAYMENT":
    case "CUSTOMER_INBOUND":
    case "TRANSFER_INBOUND":
    case "TRANSFER_INSTANT_INBOUND": {
      const isOwnAccount = OWN_IBANS.includes(row.counterparty_iban);
      const isFromRevolut =
        row.counterparty_iban === "LT243250084473005835" ||
        row.description.toLowerCase().includes("revolut");

      if (isOwnAccount) {
        const fromLabel = isFromRevolut ? "Da Revolut" : "Da BCC";
        return {
          date: row.date,
          type: "TRANSFER_IN",
          asset: null,
          quantity: null,
          unit_price_eur: null,
          amount_eur: amount,
          description: row.description || `Trasferimento ${fromLabel}`,
          category: fromLabel,
          source_id: row.transaction_id,
          raw_json: row.counterparty_iban
            ? { counterparty_iban: row.counterparty_iban }
            : null,
        };
      }

      // External deposits (e.g. Mangopay, other people)
      return {
        date: row.date,
        type: "DEPOSIT",
        asset: null,
        quantity: null,
        unit_price_eur: null,
        amount_eur: amount,
        description: row.description || row.counterparty_name || "Deposito",
        category: row.counterparty_name || null,
        source_id: row.transaction_id,
        raw_json: row.counterparty_name
          ? { counterparty: row.counterparty_name }
          : null,
      };
    }

    // --- CORPORATE ACTIONS (MERGER) ---
    case "MERGER": {
      // Merger: shares of one ISIN converted to another
      // Track as raw data, not a financial transaction
      // Skip: these are pairs that net to zero
      return null;
    }

    // --- MIGRATIONS ---
    case "MIGRATION": {
      // Internal platform migration, pairs that cancel out
      return null;
    }

    default:
      return null;
  }
}
