"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  parseBinanceTransactions,
  type ParsedTransaction as BinanceTx,
} from "@/lib/parsers/binance";
import {
  parseBCCTransactions,
  type ParsedTransaction as BCCTx,
} from "@/lib/parsers/bcc";
import {
  parseTradeRepublicTransactions,
  type ParsedTransaction as TRTx,
} from "@/lib/parsers/trade-republic";
import {
  parseRevolutTransactions,
  type ParsedTransaction as RevTx,
} from "@/lib/parsers/revolut";

type ImportMode = "binance" | "bcc" | "trade-republic" | "revolut" | "generic";

interface UnifiedTx {
  date: string;
  type: string;
  asset: string | null;
  quantity: number | null;
  unit_price_eur: number | null;
  amount_eur: number;
  description: string | null;
  category: string | null;
  source: string;
  source_id: string;
  raw_json: any;
}

export default function ImportCSVPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>("binance");
  const [transactions, setTransactions] = useState<UnifiedTx[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState("");
  const [fileName, setFileName] = useState("");

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;

      if (mode === "binance") {
        const parsed = parseBinanceTransactions(text);
        setTransactions(
          parsed.map((tx) => ({
            date: tx.date,
            type: tx.type,
            asset: tx.asset,
            quantity: tx.quantity,
            unit_price_eur: tx.unit_price_eur,
            amount_eur: tx.amount_eur,
            description: tx.notes,
            category: null,
            source: "BINANCE_CSV",
            source_id: tx.source_id,
            raw_json: tx.fee_amount
              ? { fee_amount: tx.fee_amount, fee_coin: tx.fee_coin }
              : null,
          }))
        );
      } else if (mode === "bcc") {
        const parsed = parseBCCTransactions(text);
        setTransactions(
          parsed.map((tx) => ({
            date: tx.date,
            type: tx.type,
            asset: null,
            quantity: null,
            unit_price_eur: null,
            amount_eur: tx.amount_eur,
            description: tx.description,
            category: tx.category,
            source: "BCC_CSV",
            source_id: tx.source_id,
            raw_json: null,
          }))
        );
      } else if (mode === "trade-republic") {
        const parsed = parseTradeRepublicTransactions(text);
        setTransactions(
          parsed.map((tx) => ({
            date: tx.date,
            type: tx.type,
            asset: tx.asset,
            quantity: tx.quantity,
            unit_price_eur: tx.unit_price_eur,
            amount_eur: tx.amount_eur,
            description: tx.description,
            category: tx.category,
            source: "TRADE_REPUBLIC_CSV",
            source_id: tx.source_id,
            raw_json: tx.raw_json,
          }))
        );
      } else if (mode === "revolut") {
        const parsed = parseRevolutTransactions(text);
        setTransactions(
          parsed.map((tx) => ({
            date: tx.date,
            type: tx.type,
            asset: null,
            quantity: null,
            unit_price_eur: null,
            amount_eur: tx.amount_eur,
            description: tx.description,
            category: tx.category,
            source: "REVOLUT_CSV",
            source_id: tx.source_id,
            raw_json: null,
          }))
        );
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (transactions.length === 0) return;

    setImporting(true);
    setResult("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setResult("Errore: Non autenticato");
      setImporting(false);
      return;
    }

    const { data: accounts } = await supabase.from("accounts").select("id, name");
    const { data: assets } = await supabase.from("assets").select("id, ticker, isin");

    const accountName = mode === "binance" ? "binance" : mode === "trade-republic" ? "trade republic" : mode === "revolut" ? "revolut" : "bcc";
    const account = accounts?.find(
      (a) => a.name.toLowerCase() === accountName
    );
    if (!account) {
      setResult(`Errore: Crea prima il conto "${accountName.charAt(0).toUpperCase() + accountName.slice(1)}" nella sezione Conti`);
      setImporting(false);
      return;
    }

    const toInsert = transactions
      .filter((tx) => tx.amount_eur > 0)
      .map((tx) => {
        const matchedAsset = tx.asset
          ? assets?.find(
              (a) =>
                a.ticker.toUpperCase() === tx.asset!.toUpperCase() ||
                (a.isin && a.isin.toUpperCase() === tx.asset!.toUpperCase())
            )
          : null;

        return {
          user_id: user.id,
          date: tx.date,
          account_id: account.id,
          asset_id: matchedAsset?.id || null,
          type: tx.type,
          quantity: tx.quantity,
          unit_price_eur: tx.unit_price_eur,
          amount_eur: tx.amount_eur,
          description: tx.description,
          category: tx.category,
          source: tx.source,
          external_id: tx.source_id,
          raw_json: tx.raw_json,
        };
      });

    let inserted = 0;
    let skipped = 0;
    const batchSize = 50;

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("transactions")
        .upsert(batch, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
        .select("id");
      if (error) {
        console.error("Batch error:", error.message);
      } else {
        inserted += data?.length || 0;
        skipped += batch.length - (data?.length || 0);
      }
    }

    const parts = [`${inserted} nuove transazioni importate`];
    if (skipped > 0) parts.push(`${skipped} già presenti (saltate)`);
    setResult(parts.join(". ") + ".");
    if (inserted > 0) {
      setTimeout(() => router.push("/dashboard/transactions"), 2000);
    }
    setImporting(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Importa CSV</h1>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Mode selector */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Formato</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode("binance"); setTransactions([]); setFileName(""); }}
              className={`px-3 py-1.5 rounded text-sm ${
                mode === "binance"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Binance
            </button>
            <button
              onClick={() => { setMode("bcc"); setTransactions([]); setFileName(""); }}
              className={`px-3 py-1.5 rounded text-sm ${
                mode === "bcc"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              BCC
            </button>
            <button
              onClick={() => { setMode("trade-republic"); setTransactions([]); setFileName(""); }}
              className={`px-3 py-1.5 rounded text-sm ${
                mode === "trade-republic"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Trade Republic
            </button>
            <button
              onClick={() => { setMode("revolut"); setTransactions([]); setFileName(""); }}
              className={`px-3 py-1.5 rounded text-sm ${
                mode === "revolut"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Revolut
            </button>
            <button
              onClick={() => { setMode("generic"); setTransactions([]); setFileName(""); }}
              className={`px-3 py-1.5 rounded text-sm ${
                mode === "generic"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Generico
            </button>
          </div>
        </div>

        {/* File upload */}
        {mode !== "generic" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">File CSV</label>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="text-sm" />
            {fileName && <span className="text-xs text-gray-400 ml-2">{fileName}</span>}
          </div>
        )}

        {transactions.length > 0 && (
          <>
            <div className="text-sm font-medium">
              {transactions.length} transazioni trovate
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {["INCOME", "EXPENSE", "TRANSFER_IN", "TRANSFER_OUT", "DEPOSIT", "WITHDRAW", "BUY", "SAVEBACK", "FEE"].map((type) => {
                const count = transactions.filter((t) => t.type === type).length;
                if (count === 0) return null;
                const colors: Record<string, string> = {
                  INCOME: "bg-green-50 text-green-600",
                  EXPENSE: "bg-red-50 text-red-600",
                  TRANSFER_IN: "bg-teal-50 text-teal-600",
                  TRANSFER_OUT: "bg-orange-50 text-orange-600",
                  DEPOSIT: "bg-emerald-50 text-emerald-600",
                  WITHDRAW: "bg-amber-50 text-amber-600",
                  BUY: "bg-blue-50 text-blue-600",
                  SAVEBACK: "bg-indigo-50 text-indigo-600",
                  FEE: "bg-yellow-50 text-yellow-600",
                };
                return (
                  <div key={type} className={`p-2 rounded ${colors[type]?.split(" ")[0] || "bg-gray-50"}`}>
                    <div className={`text-xs ${colors[type]?.split(" ")[1] || "text-gray-600"}`}>{type}</div>
                    <div className="font-medium">{count}</div>
                  </div>
                );
              })}
            </div>

            {/* Preview table */}
            <div className="overflow-auto max-h-80 border rounded">
              <table className="text-xs w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Data</th>
                    <th className="px-2 py-1 text-left">Tipo</th>
                    {(mode === "binance" || mode === "trade-republic") && <th className="px-2 py-1 text-left">Asset</th>}
                    {(mode === "bcc" || mode === "revolut") && <th className="px-2 py-1 text-left">Categoria</th>}
                    <th className="px-2 py-1 text-right">€</th>
                    <th className="px-2 py-1 text-left">Descrizione</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{tx.date}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1.5 py-0.5 rounded ${
                          tx.type === "BUY" ? "bg-blue-100 text-blue-700" :
                          tx.type === "INCOME" ? "bg-green-100 text-green-700" :
                          tx.type === "EXPENSE" ? "bg-red-100 text-red-700" :
                          tx.type === "DEPOSIT" ? "bg-emerald-100 text-emerald-700" :
                          tx.type === "WITHDRAW" ? "bg-amber-100 text-amber-700" :
                          tx.type === "TRANSFER_OUT" ? "bg-orange-100 text-orange-700" :
                          tx.type === "FEE" ? "bg-yellow-100 text-yellow-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>{tx.type}</span>
                      </td>
                      {(mode === "binance" || mode === "trade-republic") && (
                        <td className="px-2 py-1 font-mono">{tx.asset || "EUR"}</td>
                      )}
                      {(mode === "bcc" || mode === "revolut") && (
                        <td className="px-2 py-1 text-gray-500">{tx.category || "-"}</td>
                      )}
                      <td className="px-2 py-1 text-right font-mono">
                        €{tx.amount_eur.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-gray-500 max-w-[200px] truncate">
                        {tx.description || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {importing ? "Importazione..." : `Importa ${transactions.length} transazioni`}
            </button>
          </>
        )}

        {mode === "generic" && (
          <p className="text-sm text-gray-500">
            Import generico — coming soon.
          </p>
        )}

        {result && (
          <div className={`text-sm p-2 rounded ${
            result.startsWith("Errore")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}>{result}</div>
        )}
      </div>
    </div>
  );
}
