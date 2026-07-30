import { describe, expect, it } from "vitest";
import type { CryptoData, FiiData, FixedIncomeData, PortfolioData } from "../types";
import { calculateEvolution, filterEvolutionPeriod } from "./evolution";
import { buildEvolutionHistoryData } from "./evolutionHistory";

const stocks: PortfolioData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test", annualHistory: "test" },
  purchases: [{ id: "stock-buy", type: "buy", date: "2026-01-01", ticker: "AAA", quantity: 10, unitPrice: 10, total: 100 }],
  sales: [],
  assets: [{ ticker: "AAA", name: "AAA", sector: "Teste", exchange: "NYSE", currentPrice: 15, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, annualRows: 0, warnings: [] },
};

const fiis: FiiData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test" },
  exchangeRate: { brlPerUsd: 5, source: "test" },
  purchases: [{ id: "fii-buy", type: "buy", date: "2026-01-01", ticker: "FII11", quantity: 2, unitPrice: 100, total: 200 }],
  sales: [],
  assets: [{ ticker: "FII11", name: "FII", sector: "Teste", exchange: "B3", currentPrice: 110, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};

const crypto: CryptoData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test" },
  purchases: [{ id: "crypto-buy", type: "buy", date: "2026-01-01", ticker: "BTC", quantity: 0.1, unitPrice: 50_000, total: 5_000 }],
  sales: [],
  assets: [{ ticker: "BTC", name: "Bitcoin", sector: "Cripto", exchange: "Cripto", currentPrice: 60_000, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};

const fixedIncome: FixedIncomeData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {} },
  exchangeRate: { brlPerUsd: 5, source: "test" },
  investments: [{
    id: "fixed-1",
    risk: 1,
    type: "CDB",
    name: "Banco",
    fgcGuarantee: true,
    yield: 0.1,
    maturityDate: "2026-12-31",
    lockupDate: null,
    periodMonths: 12,
    investedAmount: 1_000,
    purchaseDate: "2026-01-01",
    grossAmount: 1_120,
    taxAmount: 20,
    taxRate: 0.15,
    netAmount: 1_100,
    profit: 100,
  }],
  integrity: { investmentRows: 1, warnings: [] },
};

describe("calculateEvolution", () => {
  it("reconstrói o patrimônio histórico e mantém paridade com o consolidado atual", () => {
    const history = buildEvolutionHistoryData([
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "stocks", "AAA", "USD", 12, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "fiis", "FII11", "BRL", 105, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "crypto", "BTC", "USD", 55_000, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "fx", "", "USD-BRL", "BRL", 5, "valid"],
    ], "2026-01-03T12:00:00.000Z");

    const points = calculateEvolution({ history, stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 });

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      date: "2026-01-02",
      stocksUsd: 120,
      fiisBrl: 210,
      cryptoUsd: 5_500,
      fixedIncomeBrl: 1_000,
      totalUsd: 5_862,
      complete: true,
      isLive: false,
    });
    expect(points[1]).toMatchObject({
      date: "2026-01-03",
      totalUsd: 6_394,
      totalBrl: 31_970,
      complete: true,
      isLive: true,
    });
  });

  it("marca o ponto como parcial quando o câmbio histórico está ausente", () => {
    const history = buildEvolutionHistoryData([
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "stocks", "AAA", "USD", 12, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "fiis", "FII11", "BRL", 105, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "crypto", "BTC", "USD", 55_000, "valid"],
    ], "2026-01-03T12:00:00.000Z");

    const point = calculateEvolution({ history, stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 })[0];
    expect(point.complete).toBe(false);
    expect(point.missing).toContain("câmbio");
    expect(point.totalUsd).toBe(5_620);
  });
});

describe("filterEvolutionPeriod", () => {
  it("mantém somente os últimos trinta dias", () => {
    const points = [
      { date: "2026-01-01" },
      { date: "2026-02-01" },
      { date: "2026-03-01" },
    ] as ReturnType<typeof calculateEvolution>;
    expect(filterEvolutionPeriod(points, "30d").map((point) => point.date)).toEqual(["2026-02-01", "2026-03-01"]);
  });
});
