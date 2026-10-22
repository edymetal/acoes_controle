import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STRATEGY_SETTINGS, getAssetStrategySettings, getPositionSizePercent, getStrategyLevelValues, loadStrategySettings, normalizeStrategySettings, saveStrategySettings } from "./settings";

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

describe("posição por ação", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ajusta todos os valores monetários preservando os gatilhos e as demais ações", () => {
    const settings = { ...DEFAULT_STRATEGY_SETTINGS, positionSizeByTicker: { AAA: 200, BBB: 50 } };
    const large = getAssetStrategySettings(settings, "AAA");
    expect(large).toMatchObject({ minimumPositionValue: 130, maximumPositionValue: 230, moderateBuyAmount: 20, strongBuyAmount: 50, breakdownBuyAmount: 30, minimumSaleAmount: 20 });
    expect(getStrategyLevelValues(large)).toMatchObject({ moderateBuyPositionValue: 150, strongBuyPositionValue: 200, breakdownBuyPositionValue: 230, initialSellAmount: 80, breakoutSellAmount: 20 });
    expect(getStrategyLevelValues(getAssetStrategySettings(settings, "BBB"))).toMatchObject({ moderateBuyPositionValue: 37.5, strongBuyPositionValue: 50, breakdownBuyPositionValue: 57.5, initialSellAmount: 20, breakoutSellAmount: 5 });
    for (const key of ["buyZoneUpperPercent", "buyZoneMiddlePercent", "buyZoneLowerPercent", "sellDistanceFromHighPercent", "initialSellPercent", "breakoutSellPercent"] as const) expect(large[key]).toBe(settings[key]);
    expect(getAssetStrategySettings(settings, "CCC")).toEqual(DEFAULT_STRATEGY_SETTINGS);
    expect(settings.positionSizeByTicker).toEqual({ AAA: 200, BBB: 50 });
    expect(getPositionSizePercent(settings, " aaa ")).toBe(200);
  });

  it("limita os pesos e descarta valores inválidos sem personalizar ações por engano", () => {
    expect(normalizeStrategySettings({ ...DEFAULT_STRATEGY_SETTINGS, positionSizeByTicker: { " aaa ": 1000, BBB: -1, CCC: 100, DDD: NaN, EEE: Infinity, "bad ticker": 200 } }).positionSizeByTicker).toEqual({ AAA: 500, BBB: 10 });
    for (const value of [null, [], "invalid", { AAA: "200" }]) {
      expect(normalizeStrategySettings({ ...DEFAULT_STRATEGY_SETTINGS, positionSizeByTicker: value as unknown as Record<string, number> }).positionSizeByTicker).toEqual({});
    }
  });

  it("lê configurações antigas e preserva as personalizações após salvar e recarregar", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
    stored.set("controle-acoes:strategy-settings", JSON.stringify({ minimumPositionValue: 80, maximumPositionValue: 140 }));
    const legacy = loadStrategySettings();
    expect(legacy.positionSizeByTicker).toEqual({});
    expect(getAssetStrategySettings(legacy, "AAA").maximumPositionValue).toBe(140);
    const saved = saveStrategySettings({ ...legacy, positionSizeByTicker: { AAA: 150, BBB: 50 } });
    expect(loadStrategySettings()).toEqual(saved);
    expect(getAssetStrategySettings(loadStrategySettings(), "AAA").minimumPositionValue).toBe(120);
    saveStrategySettings({ ...saved, minimumPositionValue: 100, maximumPositionValue: 180 });
    expect(getAssetStrategySettings(loadStrategySettings(), "AAA")).toMatchObject({ minimumPositionValue: 150, maximumPositionValue: 270 });
    saveStrategySettings(DEFAULT_STRATEGY_SETTINGS);
    expect(loadStrategySettings()).toEqual(DEFAULT_STRATEGY_SETTINGS);
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
