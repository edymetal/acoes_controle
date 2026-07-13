import { describe, expect, it } from "vitest";
import type { CryptoData } from "../types";
import { calculateCryptoPortfolio } from "./cryptoPortfolio";

const data: CryptoData = {
  schemaVersion: 1,
  generatedAt: "2026-07-12T00:00:00.000Z",
  source: { spreadsheetId: "sheet", ranges: {}, currentQuotes: "Google Sheets" },
  purchases: [
    { id: "btc-buy", type: "buy", date: "2022-02-21", ticker: "BTC", quantity: 0.01, unitPrice: 40_000, total: 400 },
    { id: "eth-buy", type: "buy", date: "2022-02-22", ticker: "ETH", quantity: 0.1, unitPrice: 2_500, total: 250 },
    { id: "bnb-buy", type: "buy", date: "2022-02-23", ticker: "BNB", quantity: 1, unitPrice: 300, total: 300 },
  ],
  sales: [
    { id: "btc-sell", type: "sell", date: "2023-01-01", ticker: "BTC", quantity: 0.002, unitPrice: 50_000, total: 100 },
  ],
  assets: [
    { ticker: "BTC", name: "Bitcoin", sector: "Criptomoeda", currentPrice: 60_000, exchange: "Mercado cripto", annual: null },
    { ticker: "ETH", name: "Ethereum", sector: "Criptomoeda", currentPrice: 2_000, exchange: "Mercado cripto", annual: null },
    { ticker: "BNB", name: "BNB", sector: "Criptomoeda", currentPrice: 400, exchange: "Mercado cripto", annual: null },
  ],
  integrity: { purchaseRows: 3, saleRows: 1, assetRows: 3, warnings: [] },
};

describe("calculateCryptoPortfolio", () => {
  it("mantém o cálculo de cripto isolado e usa custo médio móvel em USD", () => {
    const model = calculateCryptoPortfolio(data);

    expect(model.positions.map((position) => position.ticker).sort()).toEqual(["BNB", "BTC", "ETH"]);
    expect(model.metrics.historicalPurchases).toBe(950);
    expect(model.metrics.historicalSales).toBe(100);
    expect(model.metrics.realizedProfit).toBeCloseTo(20);
    expect(model.metrics.openCost).toBeCloseTo(870);
    expect(model.metrics.marketValue).toBeCloseTo(1080);
  });
});
