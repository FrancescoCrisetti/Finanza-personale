interface BinanceRow {
  userId: string;
  time: string;
  account: string;
  operation: string;
  coin: string;
  amount: number;
  comment: string;
}

interface ParsedBinanceTime {
  dateIso: string;
  minuteKey: string;
}

export interface ParsedTransaction {
  date: string; // ISO date YYYY-MM-DD
  type: "BUY" | "DEPOSIT" | "FEE" | "INCOME";
  asset: string | null; // ticker (null for EUR deposits)
  quantity: number | null;
  amount_eur: number;
  unit_price_eur: number | null;
  fee_amount: number | null;
  fee_coin: string | null;
  source_id: string; // for deduplication
  notes: string | null;
}

function parseBinanceTime(raw: string): ParsedBinanceTime {
  const [datePart = "", timePart = ""] = raw.trim().split(/\s+/);
  const [a = "", b = "", c = ""] = datePart.split("-");
  const [hh = "00", mi = "00"] = timePart.split(":");

  let year = "";
  let month = "";
  let day = "";

  // Binance exports have been seen in both YY-MM-DD and YYYY-MM-DD.
  if (a.length === 4) {
    year = a;
    month = b;
    day = c;
  } else {
    year = `20${a}`;
    month = b;
    day = c;
  }

  const dateIso = `${year}-${month}-${day}`;
  const minuteKey = `${year}${month}${day}${hh}${mi}`;

  return { dateIso, minuteKey };
}

function parseBinanceCSV(csvText: string): BinanceRow[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    // Handle commas within fields (Binance CSV uses simple commas)
    const parts = line.split(",");
    return {
      userId: parts[0]?.trim() || "",
      time: parts[1]?.trim() || "",
      account: parts[2]?.trim() || "",
      operation: parts[3]?.trim() || "",
      coin: parts[4]?.trim() || "",
      amount: parseFloat(parts[5]?.trim() || "0"),
      comment: parts[6]?.trim() || "",
    };
  });
}

export function parseBinanceTransactions(csvText: string): ParsedTransaction[] {
  const rows = parseBinanceCSV(csvText);

  // Filter only Spot account
  const spotRows = rows.filter((r) => r.account === "Spot");

  // Group by timestamp truncated to minute (Binance splits paired rows by 1s)
  const groups = new Map<string, BinanceRow[]>();
  for (const row of spotRows) {
    const { minuteKey } = parseBinanceTime(row.time);
    const key = minuteKey;
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }

  const transactions: ParsedTransaction[] = [];

  for (const [minuteKey, group] of groups) {
    const { dateIso } = parseBinanceTime(group[0]?.time || "");
    const date = dateIso;
    const sourcePrefix = `binance_${minuteKey}`;

    // --- DEPOSITS ---
    const deposits = group.filter(
      (r) => r.operation === "Deposit" && r.coin === "EUR"
    );
    for (const dep of deposits) {
      transactions.push({
        date,
        type: "DEPOSIT",
        asset: null,
        quantity: null,
        amount_eur: dep.amount,
        unit_price_eur: null,
        fee_amount: null,
        fee_coin: null,
        source_id: `${sourcePrefix}_deposit_${dep.amount}`,
        notes: "Deposito Binance",
      });
    }

    // --- TAX PAYMENTS ---
    const taxes = group.filter((r) => r.operation === "Tax Payment");
    for (const tax of taxes) {
      transactions.push({
        date,
        type: "FEE",
        asset: null,
        quantity: null,
        amount_eur: Math.abs(tax.amount),
        unit_price_eur: null,
        fee_amount: null,
        fee_coin: null,
        source_id: `${sourcePrefix}_tax_${Math.abs(tax.amount)}`,
        notes: "Tassa Binance",
      });
    }

    // --- CASHBACK ---
    const cashbacks = group.filter((r) => r.operation === "Cashback Voucher");
    for (const cb of cashbacks) {
      transactions.push({
        date,
        type: "INCOME",
        asset: cb.coin,
        quantity: cb.amount,
        amount_eur: 0,
        unit_price_eur: null,
        fee_amount: null,
        fee_coin: null,
        source_id: `${sourcePrefix}_cashback_${cb.coin}_${cb.amount}`,
        notes: `Cashback ${cb.coin}`,
      });
    }

    // --- TRANSACTION BUY/SPEND/FEE pattern ---
    const txBuys = group.filter(
      (r) => r.operation === "Transaction Buy" && r.coin !== "EUR"
    );
    const txSpends = group.filter(
      (r) => r.operation === "Transaction Spend" && r.coin === "EUR"
    );
    const txFees = group.filter(
      (r) => r.operation === "Transaction Fee" && r.coin !== "EUR"
    );

    if (txBuys.length > 0 && txSpends.length > 0) {
      // Group buys by coin
      const buysByCoin = new Map<string, number>();
      const feesByCoin = new Map<string, number>();

      for (const buy of txBuys) {
        buysByCoin.set(buy.coin, (buysByCoin.get(buy.coin) || 0) + buy.amount);
      }
      for (const fee of txFees) {
        feesByCoin.set(
          fee.coin,
          (feesByCoin.get(fee.coin) || 0) + Math.abs(fee.amount)
        );
      }

      const totalEurSpent = txSpends.reduce(
        (sum, s) => sum + Math.abs(s.amount),
        0
      );
      const coins = Array.from(buysByCoin.keys());

      if (coins.length === 1) {
        // Simple case: one coin
        const coin = coins[0];
        const qty = buysByCoin.get(coin)!;
        transactions.push({
          date,
          type: "BUY",
          asset: coin,
          quantity: qty,
          amount_eur: totalEurSpent,
          unit_price_eur: totalEurSpent / qty,
          fee_amount: feesByCoin.get(coin) || null,
          fee_coin: feesByCoin.has(coin) ? coin : null,
          source_id: `${sourcePrefix}_buy_${coin}_${qty}`,
          notes: null,
        });
      } else {
        // Multiple coins at same timestamp: distribute EUR by matching spend/buy order
        // Strategy: assign each spend to the corresponding buy in order
        const spendAmounts = txSpends.map((s) => Math.abs(s.amount));
        const buyEntries = txBuys.map((b) => ({
          coin: b.coin,
          qty: b.amount,
        }));

        // Aggregate by coin with proportional EUR distribution
        const eurByCoin = new Map<string, number>();
        const qtyByCoin = new Map<string, number>();

        if (spendAmounts.length === buyEntries.length) {
          // 1:1 match by order
          for (let i = 0; i < buyEntries.length; i++) {
            const coin = buyEntries[i].coin;
            eurByCoin.set(coin, (eurByCoin.get(coin) || 0) + spendAmounts[i]);
            qtyByCoin.set(
              coin,
              (qtyByCoin.get(coin) || 0) + buyEntries[i].qty
            );
          }
        } else {
          // Proportional distribution based on quantity ratios
          // Estimate: distribute EUR equally per buy entry then sum by coin
          const eurPerEntry = totalEurSpent / buyEntries.length;
          for (const entry of buyEntries) {
            eurByCoin.set(
              entry.coin,
              (eurByCoin.get(entry.coin) || 0) + eurPerEntry
            );
            qtyByCoin.set(
              entry.coin,
              (qtyByCoin.get(entry.coin) || 0) + entry.qty
            );
          }
        }

        for (const coin of eurByCoin.keys()) {
          const qty = qtyByCoin.get(coin)!;
          const eur = eurByCoin.get(coin)!;
          transactions.push({
            date,
            type: "BUY",
            asset: coin,
            quantity: qty,
            amount_eur: eur,
            unit_price_eur: eur / qty,
            fee_amount: feesByCoin.get(coin) || null,
            fee_coin: feesByCoin.has(coin) ? coin : null,
            source_id: `${sourcePrefix}_buy_${coin}_${qty}`,
            notes: null,
          });
        }
      }
    }

    // --- BINANCE CONVERT pattern ---
    const convertBuys = group.filter(
      (r) => r.operation === "Binance Convert" && r.coin !== "EUR" && r.amount > 0
    );
    const convertSpends = group.filter(
      (r) => r.operation === "Binance Convert" && r.coin === "EUR" && r.amount < 0
    );

    if (convertBuys.length > 0 && convertSpends.length > 0) {
      const totalEur = convertSpends.reduce(
        (sum, s) => sum + Math.abs(s.amount),
        0
      );

      if (convertBuys.length === 1) {
        const buy = convertBuys[0];
        transactions.push({
          date,
          type: "BUY",
          asset: buy.coin,
          quantity: buy.amount,
          amount_eur: totalEur,
          unit_price_eur: totalEur / buy.amount,
          fee_amount: null,
          fee_coin: null,
          source_id: `${sourcePrefix}_convert_${buy.coin}_${buy.amount}`,
          notes: "Binance Convert",
        });
      } else {
        // Multiple converts at same time - distribute EUR by order
        const eurPerBuy = totalEur / convertBuys.length;
        for (const buy of convertBuys) {
          transactions.push({
            date,
            type: "BUY",
            asset: buy.coin,
            quantity: buy.amount,
            amount_eur: eurPerBuy,
            unit_price_eur: eurPerBuy / buy.amount,
            fee_amount: null,
            fee_coin: null,
            source_id: `${sourcePrefix}_convert_${buy.coin}_${buy.amount}`,
            notes: "Binance Convert",
          });
        }
      }
    }

    // --- BUY CRYPTO WITH FIAT pattern ---
    const fiatBuys = group.filter(
      (r) =>
        r.operation === "Buy Crypto With Fiat" && r.coin !== "EUR" && r.amount > 0
    );
    const fiatSpends = group.filter(
      (r) =>
        r.operation === "Buy Crypto With Fiat" && r.coin === "EUR" && r.amount < 0
    );

    if (fiatBuys.length > 0 && fiatSpends.length > 0) {
      // These are usually 1:1 (one crypto + one EUR at same second)
      for (let i = 0; i < fiatBuys.length; i++) {
        const buy = fiatBuys[i];
        const eurSpent =
          i < fiatSpends.length
            ? Math.abs(fiatSpends[i].amount)
            : Math.abs(fiatSpends[0].amount) / fiatBuys.length;

        transactions.push({
          date,
          type: "BUY",
          asset: buy.coin,
          quantity: buy.amount,
          amount_eur: eurSpent,
          unit_price_eur: eurSpent / buy.amount,
          fee_amount: null,
          fee_coin: null,
          source_id: `${sourcePrefix}_fiat_${buy.coin}_${buy.amount}`,
          notes: "Buy Crypto With Fiat",
        });
      }
    }
  }

  // Sort by date
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return transactions;
}
