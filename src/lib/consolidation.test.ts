import { describe, expect, it } from "vitest";
import type { FixedIncomeModel, PortfolioModel } from "../types";
import { calculateConsolidation } from "./consolidation";

function portfolio(marketValue: number, totalProfit: number): PortfolioModel {
  return {
    positions: [],
    transactions: [],
    metrics: {
      historicalPurchases: 0,
      historicalSales: 0,
      openCost: 0,
      marketValue,
      realizedProfit: 0,
      unrealizedProfit: 0,
      totalProfit,
      openReturn: 0,
      totalReturnOnPurchases: 0,
      openPositions: 0,
      assetCount: 0,
    },
    health: {
      valuation: "complete",
      accounting: "complete",
      ambiguousTransactionKeys: [],
      ambiguousTransactionTickers: [],
      missingQuoteTickers: [],
      staleAnnualTickers: [],
      staleAnnualAsOf: null,
    },
    warnings: [],
  };
}

const fixedIncome: FixedIncomeModel = {
  referenceYear: 2026,
  investments: [],
  years: [],
  metrics: {
    currentPrincipal: 5_000,
    projectedGrossAmount: 6_200,
    projectedNetAmount: 6_000,
    projectedProfit: 1_000,
    projectedReturnRate: 0.2,
    assetCount: 1,
    coveredMonths: 1,
    missingMonths: 11,
  },
  warnings: [],
};

describe("calculateConsolidation", () => {
  it("usa o principal da renda fixa no patrimônio atual e exclui o lucro projetado", () => {
    const result = calculateConsolidation(
      portfolio(1_000, 100),
      portfolio(5_000, 500),
      portfolio(500, 50),
      fixedIncome,
      5,
    );

    expect(result.currentValueUsd).toBe(3_500);
    expect(result.currentResultUsd).toBe(250);
    expect(result.classes.find((item) => item.key === "fixedIncome")).toMatchObject({
      currentValue: 5_000,
      currentResult: 0,
    });
    expect(result.complete).toBe(true);
  });

  it("mantém o patrimônio conhecido, mas bloqueia o resultado quando uma base está incompleta", () => {
    const incompleteFiis = portfolio(5_000, 500);
    incompleteFiis.health.accounting = "ambiguous";

    const result = calculateConsolidation(
      portfolio(1_000, 100),
      incompleteFiis,
      portfolio(500, 50),
      fixedIncome,
      5,
    );

    expect(result.currentValueUsd).toBe(3_500);
    expect(result.currentResultUsd).toBeNull();
    expect(result.complete).toBe(false);
  });

  it("não converte classes em reais sem câmbio válido", () => {
    const result = calculateConsolidation(
      portfolio(1_000, 100),
      portfolio(5_000, 500),
      portfolio(500, 50),
      fixedIncome,
      null,
    );

    expect(result.includedClassKeys).toEqual(["stocks", "crypto"]);
    expect(result.currentValueUsd).toBe(1_500);
    expect(result.currentResultUsd).toBeNull();
  });
});
