import type { FixedIncomeModel, PortfolioModel } from "../types";

export type ConsolidationClassKey = "stocks" | "fiis" | "crypto" | "fixedIncome";

export interface ConsolidatedClass {
  key: ConsolidationClassKey;
  currency: "USD" | "BRL";
  ready: boolean;
  complete: boolean;
  currentValue: number;
  currentResult: number;
}

export interface ConsolidationResult {
  classes: ConsolidatedClass[];
  includedClassKeys: ConsolidationClassKey[];
  currentValueUsd: number;
  currentResultUsd: number | null;
  complete: boolean;
}

export function calculateConsolidation(
  stocks: PortfolioModel,
  fiis: PortfolioModel | null,
  crypto: PortfolioModel | null,
  fixedIncome: FixedIncomeModel | null,
  brlPerUsd: number | null,
): ConsolidationResult {
  const classes: ConsolidatedClass[] = [
    {
      key: "stocks",
      currency: "USD",
      ready: true,
      complete: stocks.health.valuation === "complete" && stocks.health.accounting === "complete",
      currentValue: stocks.metrics.marketValue,
      currentResult: stocks.metrics.totalProfit,
    },
    {
      key: "fiis",
      currency: "BRL",
      ready: Boolean(fiis),
      complete: Boolean(fiis && fiis.health.valuation === "complete" && fiis.health.accounting === "complete"),
      currentValue: fiis?.metrics.marketValue ?? 0,
      currentResult: fiis?.metrics.totalProfit ?? 0,
    },
    {
      key: "crypto",
      currency: "USD",
      ready: Boolean(crypto),
      complete: Boolean(crypto && crypto.health.valuation === "complete" && crypto.health.accounting === "complete"),
      currentValue: crypto?.metrics.marketValue ?? 0,
      currentResult: crypto?.metrics.totalProfit ?? 0,
    },
    {
      key: "fixedIncome",
      currency: "BRL",
      ready: Boolean(fixedIncome),
      complete: Boolean(fixedIncome),
      currentValue: fixedIncome?.metrics.currentPrincipal ?? 0,
      currentResult: 0,
    },
  ];
  const validRate = brlPerUsd !== null && Number.isFinite(brlPerUsd) && brlPerUsd > 0
    ? brlPerUsd
    : null;
  const canConvert = (item: ConsolidatedClass) => item.currency === "USD" || validRate !== null;
  const toUsd = (item: ConsolidatedClass, value: number) =>
    item.currency === "USD" ? value : value / validRate!;
  const includedClasses = classes.filter((item) => item.ready && canConvert(item));
  const complete = classes.every((item) => item.ready && item.complete && canConvert(item));

  return {
    classes,
    includedClassKeys: includedClasses.map((item) => item.key),
    currentValueUsd: includedClasses.reduce((sum, item) => sum + toUsd(item, item.currentValue), 0),
    currentResultUsd: complete
      ? includedClasses.reduce((sum, item) => sum + toUsd(item, item.currentResult), 0)
      : null,
    complete,
  };
}
