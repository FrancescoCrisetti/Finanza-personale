import { describe, it, expect } from "vitest";
import { parseRevolutTransactions } from "./revolut";

describe("parseRevolutTransactions", () => {
  it("mappa un pagamento con carta come EXPENSE, sommando l'eventuale fee", () => {
    const csv = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State",
      "Pagamento con carta,Current,2026-07-01 10:00:00,2026-07-01 10:00:01,Bar Roma,-15.5,0,EUR,COMPLETED",
    ].join("\n");

    const result = parseRevolutTransactions(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: "2026-07-01",
      type: "EXPENSE",
      category: "Carta Revolut",
      amount_eur: 15.5,
    });
  });

  it("scarta le operazioni annullate", () => {
    const csv = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State",
      "Pagamento con carta,Current,2026-07-01 10:00:00,2026-07-01 10:00:01,Bar Roma,-15.5,0,EUR,OPERAZIONE ANNULLATA",
    ].join("\n");

    const result = parseRevolutTransactions(csv);

    expect(result).toHaveLength(0);
  });

  it("distingue un top-up (Ricarica) come TRANSFER_IN", () => {
    const csv = [
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State",
      "Ricarica,Current,2026-07-02 09:00:00,2026-07-02 09:00:01,Top-up,50,0,EUR,COMPLETED",
    ].join("\n");

    const result = parseRevolutTransactions(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "TRANSFER_IN",
      category: "Da BCC (carta)",
      amount_eur: 50,
    });
  });
});
