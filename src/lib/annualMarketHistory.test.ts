import { describe, expect, it } from "vitest";
import { mapAnnualMarketHistory } from "./annualMarketHistory";

const now = "2026-10-11T18:00:00.000Z";
const row = ["AAA", 8, 10, 15, 250, "2025-10-11", "2026-10-09", now, "massive", "USD"];

describe("histórico anual da aba auxiliar", () => {
  it("lê números reais com origem e período e mantém os dados do fim de semana válidos", () => {
    const warnings: string[] = [];
    expect(mapAnnualMarketHistory([[], row], now, warnings).get("AAA")).toMatchObject({ min: 8, average: 10, max: 15, observations: 250, source: "massive", isFallback: false });
    expect(warnings).toEqual([]);
  });

  it("marca dados antigos ou com pregão muito antigo como contingência", () => {
    const oldSync = [...row]; oldSync[7] = "2026-10-01T18:00:00.000Z"; oldSync[6] = "2026-09-30";
    const oldTrade = [...row]; oldTrade[6] = "2026-09-30";
    expect(mapAnnualMarketHistory([oldSync], now, []).get("AAA")?.isFallback).toBe(true);
    expect(mapAnnualMarketHistory([oldTrade], now, []).get("AAA")?.isFallback).toBe(true);
  });

  it("recusa erros da fórmula, período parcial, data impossível, fonte desconhecida e atualização futura", () => {
    for (const [index, value] of [[1, "#N/A"], [2, 20], [4, 20], [5, "2026-02-30"], [5, "2026-08-01"], [7, "2026-10-12T18:00:00.000Z"], [8, "other"]] as const) {
      const invalid = [...row]; invalid[index] = value;
      expect(mapAnnualMarketHistory([invalid], now, []).size).toBe(0);
    }
  });

  it("ignora todos os registros de tickers duplicados", () => {
    expect(mapAnnualMarketHistory([row, row, row], now, []).size).toBe(0);
  });
});
