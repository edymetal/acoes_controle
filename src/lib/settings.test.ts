import { describe, expect, it } from "vitest";
import { DEFAULT_STRATEGY_SETTINGS, getStrategyLevelValues, normalizeStrategySettings } from "./settings";

describe("normalizeStrategySettings", () => {
  it("mantém valores e percentuais dentro dos limites permitidos", () => {
    expect(normalizeStrategySettings({
      ...DEFAULT_STRATEGY_SETTINGS,
      sellDistanceFromHighPercent: 50,
      initialSellPercent: 120,
      minimumSaleAmount: -5,
      buyZoneUpperPercent: 35,
      buyZoneMiddlePercent: 50,
      buyZoneLowerPercent: 40,
      minimumPositionValue: 65,
      maximumPositionValue: 50,
    })).toEqual({
      ...DEFAULT_STRATEGY_SETTINGS,
      sellDistanceFromHighPercent: 25,
      initialSellPercent: 100,
      minimumSaleAmount: 0,
      buyZoneUpperPercent: 35,
      buyZoneMiddlePercent: 35,
      buyZoneLowerPercent: 35,
      minimumPositionValue: 65,
      maximumPositionValue: 65,
    });
  });
});

describe("getStrategyLevelValues", () => {
  it("recalcula os valores de venda quando a faixa ou os percentuais mudam", () => {
    expect(getStrategyLevelValues({
      ...DEFAULT_STRATEGY_SETTINGS,
      minimumPositionValue: 100,
      maximumPositionValue: 180,
      initialSellPercent: 75,
      breakoutSellPercent: 25,
    })).toEqual({
      positionRange: 80,
      breakdownBuyPositionValue: 150,
      strongBuyPositionValue: 135,
      moderateBuyPositionValue: 110,
      initialSellAmount: 60,
      breakoutSellAmount: 20,
    });
  });

  it("aumenta o alvo acumulado conforme a cotação entra nas faixas mais baixas", () => {
    expect(getStrategyLevelValues(DEFAULT_STRATEGY_SETTINGS)).toMatchObject({
      moderateBuyPositionValue: 75,
      strongBuyPositionValue: 100,
      breakdownBuyPositionValue: 115,
    });
  });

  it("limita os alvos ao máximo mesmo quando as parcelas excedem a faixa negociável", () => {
    expect(getStrategyLevelValues({
      ...DEFAULT_STRATEGY_SETTINGS,
      maximumPositionValue: 90,
    })).toMatchObject({
      moderateBuyPositionValue: 75,
      strongBuyPositionValue: 90,
      breakdownBuyPositionValue: 90,
    });
  });
});
