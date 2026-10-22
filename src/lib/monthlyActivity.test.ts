import { describe, expect, it } from "vitest";
import type { PortfolioData, ProcessedTransaction } from "../types";
import { getMonthlyActivity } from "./monthlyActivity";
import { calculatePortfolio } from "./portfolio";

const purchase: ProcessedTransaction = {
  id: "buy", type: "buy", date: "2025-12-31", ticker: "AAA", quantity: 10, total: 100, unitPrice: 10, costBasis: 100, realizedProfit: null,
};
const sale: ProcessedTransaction = {
  id: "sell", type: "sell", date: "2026-01-01", ticker: "AAA", quantity: 2, total: 30, unitPrice: 15, costBasis: 20, realizedProfit: 10,
};

describe("getMonthlyActivity", () => {
  it("mostra os 12 meses e separa o ano das compras e das vendas", () => {
    const months = getMonthlyActivity([purchase, sale], 2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: 1, purchases: 0, sales: 30, realizedProfit: 10, transactionCount: 1 });
    expect(months[11]).toEqual({ month: 12, purchases: 0, sales: 0, realizedProfit: 0, transactionCount: 0 });
    expect(getMonthlyActivity([purchase, sale], 2025)[11].purchases).toBe(100);
  });

  it("usa o custo médio de compras anteriores e soma operações e prejuízos no mês da venda", () => {
    const data: PortfolioData = {
      schemaVersion: 1, generatedAt: "2026-03-01T12:00:00Z",
      source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test", annualHistory: "test" },
      purchases: [purchase, { ...purchase, id: "buy-2", date: "2026-01-05", quantity: 10, total: 200, unitPrice: 20 }],
      sales: [
        { ...sale, date: "2026-02-01", quantity: 5, total: 100, unitPrice: 20 },
        { ...sale, id: "loss", date: "2026-02-28", quantity: 2, total: 10, unitPrice: 5 },
      ],
      assets: [], integrity: { purchaseRows: 2, saleRows: 2, assetRows: 0, annualRows: 0, warnings: [] },
    };
    const model = calculatePortfolio(data);
    const months = getMonthlyActivity(model.transactions, 2026);
    expect(months[0].purchases).toBe(200);
    expect(months[1]).toMatchObject({ sales: 110, realizedProfit: 5, transactionCount: 2 });
    expect(months.reduce((sum, month) => sum + month.purchases, 0)).toBe(model.metrics.historicalPurchases - 100);
    expect(months.reduce((sum, month) => sum + (month.realizedProfit ?? 0), 0)).toBe(model.metrics.realizedProfit);
    expect(getMonthlyActivity([{ ...sale, realizedProfit: -20 }], 2026)[0].realizedProfit).toBe(-20);
  });

  it("mantém lucro desconhecido indisponível ao somar outras vendas no mesmo mês", () => {
    for (const transactions of [[sale, { ...sale, realizedProfit: null }], [{ ...sale, realizedProfit: null }, sale]]) {
      expect(getMonthlyActivity(transactions, 2026)[0]).toMatchObject({ sales: 60, realizedProfit: null });
    }
  });

  it("preserva os volumes quando a contabilidade não é confiável", () => {
    const months = getMonthlyActivity([sale], 2026, false);
    expect(months.every((month) => month.realizedProfit === null)).toBe(true);
    expect(months[0].sales).toBe(30);
  });

  it("retorna meses zerados sem dados e ignora datas sem mês válido", () => {
    const empty = getMonthlyActivity([], 2026);
    expect(empty.every((month) => month.purchases === 0 && month.sales === 0 && month.realizedProfit === 0 && month.transactionCount === 0)).toBe(true);
    expect(getMonthlyActivity(["2026-00-01", "2026-13-01", "invalid"].map((date) => ({ ...sale, date })), 2026)).toEqual(empty);
  });
});
