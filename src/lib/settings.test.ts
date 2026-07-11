import { describe, expect, it } from "vitest";
import { normalizeStrategySettings } from "./settings";

describe("normalizeStrategySettings", () => {
  it("mantem os limites dentro dos intervalos permitidos", () => {
    expect(normalizeStrategySettings({
      sellDistanceFromHighPercent: 50,
      buyDistanceBelowAveragePercent: -2,
      strongBreakoutAboveHighPercent: 0,
    })).toEqual({
      sellDistanceFromHighPercent: 25,
      buyDistanceBelowAveragePercent: 0,
      strongBreakoutAboveHighPercent: 0.5,
    });
  });
});
