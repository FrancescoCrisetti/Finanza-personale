import { describe, it, expect } from "vitest";
import { parseBCCTransactions } from "./bcc";

describe("parseBCCTransactions", () => {
  it("parses stipendio (credito) e pagamento POS (debito), converte date e importi italiani", () => {
    const csv = [
      "Data;Valuta;Dare;Avere;Causale;Descrizione",
      "23/07/2026;23/07/2026;;1.500,00;;ACCREDITO STIPENDI LUGLIO",
      "24/07/2026;24/07/2026;50,00;;;PAGAMENTO TRAMITE POS BAR ROSSI",
    ].join("\n");

    const result = parseBCCTransactions(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: "2026-07-23",
      type: "INCOME",
      category: "Stipendio",
      amount_eur: 1500,
    });
    expect(result[1]).toMatchObject({
      date: "2026-07-24",
      type: "EXPENSE",
      category: "POS",
      amount_eur: 50,
    });
  });

  it("scarta righe 'prenotata' e righe di saldo", () => {
    const csv = [
      "Data;Valuta;Dare;Avere;Causale;Descrizione",
      "25/07/2026;prenotata;20,00;;;PRELIEVO ATM",
      "26/07/2026;26/07/2026;;;;Saldo contabile 1000,00",
    ].join("\n");

    const result = parseBCCTransactions(csv);

    expect(result).toHaveLength(0);
  });
});
