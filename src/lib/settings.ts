import type { StrategySettings } from "../types";

const STORAGE_KEY = "controle-acoes:strategy-settings";

export const DEFAULT_STRATEGY_SETTINGS: StrategySettings = {
  sellDistanceFromHighPercent: 5,
  initialSellPercent: 80,
  breakoutSellPercent: 20,
  minimumSaleAmount: 10,
  buyZoneUpperPercent: 35,
  buyZoneMiddlePercent: 20,
  buyZoneLowerPercent: 10,
  moderateBuyAmount: 10,
  strongBuyAmount: 25,
  breakdownBuyAmount: 15,
  minimumPositionValue: 65,
  maximumPositionValue: 115,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const numberOr = (value: number, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeStrategySettings(settings: StrategySettings): StrategySettings {
  const minimumPositionValue = clamp(numberOr(settings.minimumPositionValue, DEFAULT_STRATEGY_SETTINGS.minimumPositionValue), 1, 10_000);
  const maximumPositionValue = clamp(numberOr(settings.maximumPositionValue, DEFAULT_STRATEGY_SETTINGS.maximumPositionValue), minimumPositionValue, 20_000);
  const buyZoneUpperPercent = clamp(numberOr(settings.buyZoneUpperPercent, DEFAULT_STRATEGY_SETTINGS.buyZoneUpperPercent), 1, 100);
  const buyZoneMiddlePercent = clamp(numberOr(settings.buyZoneMiddlePercent, DEFAULT_STRATEGY_SETTINGS.buyZoneMiddlePercent), 0, buyZoneUpperPercent);
  const buyZoneLowerPercent = clamp(numberOr(settings.buyZoneLowerPercent, DEFAULT_STRATEGY_SETTINGS.buyZoneLowerPercent), 0, buyZoneMiddlePercent);

  return {
    sellDistanceFromHighPercent: clamp(numberOr(settings.sellDistanceFromHighPercent, DEFAULT_STRATEGY_SETTINGS.sellDistanceFromHighPercent), 0.5, 25),
    initialSellPercent: clamp(numberOr(settings.initialSellPercent, DEFAULT_STRATEGY_SETTINGS.initialSellPercent), 0, 100),
    breakoutSellPercent: clamp(numberOr(settings.breakoutSellPercent, DEFAULT_STRATEGY_SETTINGS.breakoutSellPercent), 0, 100),
    minimumSaleAmount: clamp(numberOr(settings.minimumSaleAmount, DEFAULT_STRATEGY_SETTINGS.minimumSaleAmount), 0, 10_000),
    buyZoneUpperPercent,
    buyZoneMiddlePercent,
    buyZoneLowerPercent,
    moderateBuyAmount: clamp(numberOr(settings.moderateBuyAmount, DEFAULT_STRATEGY_SETTINGS.moderateBuyAmount), 0, 10_000),
    strongBuyAmount: clamp(numberOr(settings.strongBuyAmount, DEFAULT_STRATEGY_SETTINGS.strongBuyAmount), 0, 10_000),
    breakdownBuyAmount: clamp(numberOr(settings.breakdownBuyAmount, DEFAULT_STRATEGY_SETTINGS.breakdownBuyAmount), 0, 10_000),
    minimumPositionValue,
    maximumPositionValue,
  };
}

export function loadStrategySettings(): StrategySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STRATEGY_SETTINGS;
    return normalizeStrategySettings({ ...DEFAULT_STRATEGY_SETTINGS, ...JSON.parse(stored) });
  } catch {
    return DEFAULT_STRATEGY_SETTINGS;
  }
}

export function saveStrategySettings(settings: StrategySettings): StrategySettings {
  const normalized = normalizeStrategySettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
