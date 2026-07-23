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
      breakdownBuyPositionValue: 115,
      strongBuyPositionValue: 140,
      moderateBuyPositionValue: 150,
      initialSellAmount: 60,
      breakoutSellAmount: 20,
    });
  });

  it("soma as parcelas ao valor mínimo e limita a posição acumulada ao máximo", () => {
    expect(getStrategyLevelValues(DEFAULT_STRATEGY_SETTINGS)).toMatchObject({
      breakdownBuyPositionValue: 80,
      strongBuyPositionValue: 105,
      moderateBuyPositionValue: 115,
    });
  });
});
