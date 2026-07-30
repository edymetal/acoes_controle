import { describe, expect, it } from "vitest";
import { buildEvolutionHistoryData } from "./evolutionHistory";

describe("buildEvolutionHistoryData", () => {
  it("normaliza registros e mantém a captura mais recente quando há duplicidade", () => {
    const result = buildEvolutionHistoryData([
      ["2026-07-29", "2026-07-29T22:00:00.000Z", "quote", "stocks", "aapl", "usd", 210, "valid"],
      ["2026-07-29", "2026-07-29T23:00:00.000Z", "quote", "stocks", "AAPL", "USD", 212, "valid"],
      ["2026-07-29", "2026-07-29T23:00:00.000Z", "fx", "", "usd-brl", "BRL", 5.5, "valid"],
    ], "2026-07-30T12:00:00.000Z");

    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      symbol: "USD-BRL",
      value: 5.5,
      assetClass: null,
    });
    expect(result.records[1]).toMatchObject({
      symbol: "AAPL",
      value: 212,
      assetClass: "stocks",
    });
    expect(result.integrity.warnings[0]).toContain("duplicado");
  });

  it("ignora linhas inválidas sem comprometer os registros válidos", () => {
    const result = buildEvolutionHistoryData([
      ["data inválida", "", "quote", "stocks", "AAPL", "USD", 210, "valid"],
      ["2026-07-29", "2026-07-29T23:00:00.000Z", "fx", "", "USD-BRL", "BRL", 5.5, "valid"],
    ], "2026-07-30T12:00:00.000Z");

    expect(result.records).toHaveLength(1);
    expect(result.integrity.warnings[0]).toContain("linha 2");
  });
});
