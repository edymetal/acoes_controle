import { describe, expect, it } from "vitest";
import { calculatePortfolio, getStrategySignal } from "./portfolio";
import type { Asset, PortfolioData } from "../types";

const data: PortfolioData = {
  schemaVersion: 1,
  generatedAt: "2026-01-01T12:00:00.000Z",
  source: {
    spreadsheetId: "test",
    ranges: {},
    currentQuotes: "test",
    annualHistory: "test",
  },
  purchases: [
    { id: "buy-1", type: "buy", date: "2025-01-01", ticker: "AAA", quantity: 10, total: 100, unitPrice: 10 },
    { id: "buy-2", type: "buy", date: "2025-02-01", ticker: "AAA", quantity: 10, total: 200, unitPrice: 20 },
  ],
  sales: [
    { id: "sell-1", type: "sell", date: "2025-03-01", ticker: "AAA", quantity: 5, total: 100, unitPrice: 20 },
  ],
  assets: [
    { ticker: "AAA", name: "A", sector: "Tech", exchange: "NYSE", currentPrice: 25, annual: { min: 8, average: 18, max: 30, observations: 250, currency: "USD" } },
  ],
  integrity: { purchaseRows: 2, saleRows: 1, assetRows: 1, annualRows: 1, warnings: [] },
};

describe("calculatePortfolio", () => {
  it("calcula custo médio móvel, lucro realizado e posição em aberto", () => {
    const model = calculatePortfolio(data);
    const position = model.positions[0];
    expect(position.quantity).toBe(15);
    expect(position.averageCost).toBeCloseTo(15);
    expect(position.costBasis).toBeCloseTo(225);
    expect(position.marketValue).toBeCloseTo(375);
    expect(model.metrics.realizedProfit).toBeCloseTo(25);
    expect(model.metrics.unrealizedProfit).toBeCloseTo(150);
    expect(model.metrics.totalProfit).toBeCloseTo(175);
  });
});

describe("getStrategySignal", () => {
  const base: Asset = {
    ticker: "AAA",
    name: "A",
    sector: "Tech",
    exchange: "NYSE",
    currentPrice: 10,
    annual: { min: 8, average: 18, max: 30, observations: 250, currency: "USD" },
  };

  it("fortalece compra ao se aproximar da mínima", () => {
    expect(getStrategySignal(base).kind).toBe("buy");
    expect(getStrategySignal(base).strength).toBeCloseTo(0.8);
  });

  it("identifica proximidade da máxima", () => {
    expect(getStrategySignal({ ...base, currentPrice: 29 }).kind).toBe("near-high");
  });

  it("identifica rompimento da máxima", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 33 });
    expect(signal.kind).toBe("breakout");
    expect(signal.strength).toBe(1);
  });
});

