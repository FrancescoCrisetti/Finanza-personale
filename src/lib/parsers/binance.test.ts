import { describe, it, expect } from "vitest";
import { parseBinanceTransactions } from "./binance";

describe("parseBinanceTransactions", () => {
  it("mappa un deposito EUR su Spot", () => {
    const csv = [
      "User_Id,UTC_Time,Account,Operation,Coin,Change,Remark",
      "12345,2026-07-01 10:00:00,Spot,Deposit,EUR,100,",
    ].join("\n");

    const result = parseBinanceTransactions(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: "2026-07-01",
      type: "DEPOSIT",
      amount_eur: 100,
    });
  });

  it("raggruppa Transaction Spend/Buy/Fee entro lo stesso minuto in un BUY", () => {
    const csv = [
      "User_Id,UTC_Time,Account,Operation,Coin,Change,Remark",
      "12345,2026-07-02 09:15:00,Spot,Transaction Spend,EUR,-100,",
      "12345,2026-07-02 09:15:01,Spot,Transaction Buy,BTC,0.002,",
      "12345,2026-07-02 09:15:01,Spot,Transaction Fee,BTC,-0.000002,",
    ].join("\n");

    const result = parseBinanceTransactions(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: "2026-07-02",
      type: "BUY",
      asset: "BTC",
      quantity: 0.002,
      amount_eur: 100,
      fee_coin: "BTC",
    });
    expect(result[0].unit_price_eur).toBeCloseTo(50000, 5);
    expect(result[0].fee_amount).toBeCloseTo(0.000002, 8);
  });

  it("ignora righe non Spot", () => {
    const csv = [
      "User_Id,UTC_Time,Account,Operation,Coin,Change,Remark",
      "12345,2026-07-01 10:00:00,Funding,Deposit,EUR,100,",
    ].join("\n");

    const result = parseBinanceTransactions(csv);

    expect(result).toHaveLength(0);
  });
});
