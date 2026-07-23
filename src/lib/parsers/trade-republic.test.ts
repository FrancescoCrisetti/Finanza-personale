import { describe, it, expect } from "vitest";
import { parseTradeRepublicTransactions } from "./trade-republic";

function buildRow(overrides: Record<string, string> = {}): string {
  const base = {
    datetime: "2026-07-01T09:00:00",
    date: "2026-07-01",
    account_type: "securities",
    category: "Trading",
    type: "BUY",
    asset_class: "etf",
    name: "iShares MSCI World",
    symbol: "IWDA",
    shares: "0.5",
    price: "80",
    amount: "-40",
    fee: "0",
    tax: "0",
    currency: "EUR",
    original_amount: "",
    original_currency: "",
    fx_rate: "",
    description: "PAC ETF",
    transaction_id: "tx1",
    counterparty_name: "",
    counterparty_iban: "",
    payment_reference: "",
    mcc_code: "",
  };
  const row = { ...base, ...overrides };
  return Object.values(row).join(",");
}

const header =
  "datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code";

describe("parseTradeRepublicTransactions", () => {
  it("mappa un BUY con prezzo, quantita e importo corretti", () => {
    const csv = [header, buildRow()].join("\n");

    const result = parseTradeRepublicTransactions(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: "2026-07-01",
      type: "BUY",
      asset: "IWDA",
      quantity: 0.5,
      unit_price_eur: 80,
      amount_eur: 40,
      category: "PAC ETF",
      source_id: "tx1",
    });
  });

  it("riconosce un BUY come Saveback se c'e' un BENEFITS_SAVEBACK corrispondente", () => {
    const csv = [
      header,
      buildRow({
        type: "BENEFITS_SAVEBACK",
        transaction_id: "tx-saveback",
        amount: "1.5",
        symbol: "IWDA",
      }),
      buildRow({ amount: "-1.5", symbol: "IWDA" }),
    ].join("\n");

    const result = parseTradeRepublicTransactions(csv);

    const buy = result.find((t) => t.type === "BUY");
    expect(buy?.category).toBe("Saveback");
  });

  it("calcola l'interesse netto detraendo la tassa", () => {
    const csv = [
      header,
      buildRow({
        type: "INTEREST_PAYMENT",
        amount: "10",
        tax: "-2.6",
        transaction_id: "tx-interest",
      }),
    ].join("\n");

    const result = parseTradeRepublicTransactions(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "INCOME",
      amount_eur: 7.4,
      category: "Interessi",
    });
  });
});
