import type { StrategySettings } from "../types";

const STORAGE_KEY = "controle-acoes:strategy-settings";

export const DEFAULT_STRATEGY_SETTINGS: StrategySettings = {
  sellDistanceFromHighPercent: 5,
  buyDistanceBelowAveragePercent: 0,
  strongBreakoutAboveHighPercent: 3,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeStrategySettings(settings: StrategySettings): StrategySettings {
  return {
    sellDistanceFromHighPercent: clamp(Number(settings.sellDistanceFromHighPercent) || 0, 0.5, 25),
    buyDistanceBelowAveragePercent: clamp(Number(settings.buyDistanceBelowAveragePercent) || 0, 0, 25),
    strongBreakoutAboveHighPercent: clamp(Number(settings.strongBreakoutAboveHighPercent) || 0, 0.5, 25),
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
