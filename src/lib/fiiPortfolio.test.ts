import { describe, expect, it } from "vitest";
import type { FiiData } from "../types";
import { calculateFiiPortfolio } from "./fiiPortfolio";
import syncedJson from "../../public/data/fiis.json";

const data: FiiData = {
  schemaVersion: 1,
  generatedAt: "2026-07-11T12:00:00.000Z",
  source: { spreadsheetId: "sheet", ranges: {}, currentQuotes: "Google Sheets" },
  exchangeRate: { brlPerUsd: 5, source: "'Dólar'!G5" },
  purchases: [
    { id: "fii-buy-1", type: "buy", date: "2025-01-01", ticker: "TEST11", quantity: 10, unitPrice: 100, total: 1_000 },
    { id: "fii-buy-2", type: "buy", date: "2025-02-01", ticker: "TEST11", quantity: 10, unitPrice: 120, total: 1_200 },
  ],
  sales: [
    { id: "fii-sell-1", type: "sell", date: "2025-03-01", ticker: "TEST11", quantity: 5, unitPrice: 130, total: 650 },
  ],
  assets: [{ ticker: "TEST11", name: "Fundo Teste", sector: "Logística", currentPrice: 125, exchange: "B3", annual: null }],
  integrity: { purchaseRows: 2, saleRows: 1, assetRows: 1, warnings: [] },
};

describe("calculateFiiPortfolio", () => {
  it("mantém o cálculo dos FIIs isolado e usa custo médio móvel", () => {
    const model = calculateFiiPortfolio(data);

    expect(model.positions).toHaveLength(1);
    expect(model.positions[0].quantity).toBe(15);
    expect(model.positions[0].averageCost).toBe(110);
    expect(model.metrics.realizedProfit).toBe(100);
    expect(model.metrics.marketValue).toBe(1_875);
    expect(model.metrics.unrealizedProfit).toBe(225);
  });

  it("processa integralmente o JSON sincronizado sem dados financeiros inválidos", () => {
    const syncedData = syncedJson as unknown as FiiData;
    const model = calculateFiiPortfolio(syncedData);

    expect(syncedData.integrity.warnings.every((warning) => warning.trim().length > 0)).toBe(true);
    expect(model.warnings).toEqual(expect.arrayContaining(syncedData.integrity.warnings));
    expect([...syncedData.purchases, ...syncedData.sales].every((item) =>
      Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.total) && item.total >= 0,
    )).toBe(true);
    const positionsWithoutQuote = model.positions.filter((position) => position.currentPrice <= 0);
    expect(positionsWithoutQuote.every((position) =>
      model.warnings.includes(`Cotação não encontrada para a posição ${position.ticker}.`),
    )).toBe(true);
    expect(Object.values(model.metrics).every(Number.isFinite)).toBe(true);
  });
});
