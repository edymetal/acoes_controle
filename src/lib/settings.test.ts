import { describe, expect, it } from "vitest";
import { DEFAULT_STRATEGY_SETTINGS, normalizeStrategySettings } from "./settings";

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
