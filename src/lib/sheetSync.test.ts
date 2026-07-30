import { describe, expect, it } from "vitest";
import type { PortfolioData } from "../types";
import { buildSpreadsheetData, isGoogleSheetsAuthorizationError } from "./sheetSync";

const previousPortfolio: PortfolioData = {
  schemaVersion: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  source: {
    spreadsheetId: "test",
    ranges: {},
    currentQuotes: "test",
    annualHistory: "test",
  },
  purchases: [],
  sales: [],
  assets: [],
  integrity: {
    purchaseRows: 0,
    saleRows: 0,
    assetRows: 0,
    annualRows: 0,
    warnings: [],
  },
};

describe("buildSpreadsheetData", () => {
  it("constrói todas as bases com o mesmo horário da atualização direta", () => {
    const generatedAt = "2026-07-23T21:30:00.000Z";
    const result = buildSpreadsheetData([
      { values: [[45_292.5, "AAA", 2, 20, 10]] },
      { values: [[45_293, "AAA", 1, 12]] },
      { values: [["AAA", "Empresa", "", "Tecnologia", "", 11, 8, 10, 15, "NYSE"]] },
      { values: [[45_292, "FII11", 2, 100]] },
      { values: [[45_293, "FII11", 1, 110, 110]] },
      { values: [["FII11", "Fundo", "", "", "Papel", "", 105]] },
      { values: [[5]] },
      { values: [["COMPRA", 45_292, "", "", "BTC", 0.1, 50_000]] },
      { values: [["BITCOIN", 60_000], ["ETHEREUM", 3_000], ["BNB", 500]] },
      { values: [[1, "CDB", "Banco", "", "SIM", 0.12, 46_000, null, 24, 1_000, 45_292, 1_200, 30, 0.15, 1_170, 170]] },
      { values: [[5]] },
    ], previousPortfolio, generatedAt);

    expect(result.portfolio.generatedAt).toBe(generatedAt);
    expect(result.fiis.generatedAt).toBe(generatedAt);
    expect(result.crypto.generatedAt).toBe(generatedAt);
    expect(result.fixedIncome.generatedAt).toBe(generatedAt);
    expect(result.portfolio.purchases).toHaveLength(1);
    expect(result.portfolio.purchases[0]).toMatchObject({ date: "2024-01-01", time: "12:00:00" });
    expect(result.portfolio.sales).toHaveLength(1);
    expect(result.portfolio.assets[0].annual).toMatchObject({ min: 8, average: 10, max: 15 });
    expect(result.fiis.assets).toHaveLength(1);
    expect(result.crypto.assets).toHaveLength(3);
    expect(result.crypto.purchases[0].sourceOrder).toBe(1);
    expect(result.fixedIncome.investments).toHaveLength(1);
  });

  it("lê as cotações de Bitcoin, Ethereum e BNB em toda a faixa Cripto Base D2:E13", () => {
    const valueRanges = Array.from(
      { length: 11 },
      (): { values: Array<Array<string | number | boolean | null>> } => ({ values: [] }),
    );
    valueRanges[6].values = [[5]];
    valueRanges[8].values = [
      ["BITCOIN", 60_000],
      ["OUTRA MOEDA", 10],
      [],
      ["ETHEREUM", 3_000],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      ["BNB", 500],
    ];
    valueRanges[10].values = [[5]];

    const result = buildSpreadsheetData(valueRanges, null, "2026-07-30T12:00:00.000Z");

    expect(result.crypto.source.ranges).toEqual({
      transactions: "'Cripto'!A1:L1000",
      assets: "'Cripto Base'!D2:E13",
    });
    expect(result.crypto.assets).toEqual([
      expect.objectContaining({ ticker: "BTC", name: "Bitcoin", currentPrice: 60_000 }),
      expect.objectContaining({ ticker: "ETH", name: "Ethereum", currentPrice: 3_000 }),
      expect.objectContaining({ ticker: "BNB", name: "BNB", currentPrice: 500 }),
    ]);
  });

  it("recusa uma resposta parcial da planilha", () => {
    expect(() => buildSpreadsheetData([], previousPortfolio)).toThrow("A resposta da planilha está incompleta.");
  });

  it("valida o contrato também na atualização direta da planilha", () => {
    const completeEmptyResponse = Array.from({ length: 11 }, () => ({ values: [] }));
    expect(() => buildSpreadsheetData(completeEmptyResponse, null, "data-inválida"))
      .toThrow("valores inconsistentes");
  });

  it("mantém a renda fixa quando somente bruto e imposto estão inconsistentes", () => {
    const valueRanges = Array.from(
      { length: 11 },
      (): { values: Array<Array<string | number | boolean | null>> } => ({ values: [] }),
    );
    valueRanges[6].values = [[5]];
    valueRanges[9].values = [[
      1, "CDB", "Banco", "", "SIM", 0.12, 46_000, null, 24, 1_000, 45_292, 900, 30, 0.15, 1_170, 170,
    ]];
    valueRanges[10].values = [[5]];

    const result = buildSpreadsheetData(valueRanges, null, "2026-07-28T12:00:00.000Z");

    expect(result.fixedIncome.investments[0]).toMatchObject({
      grossAmount: null,
      taxAmount: null,
      taxRate: null,
      netAmount: 1_170,
    });
    expect(result.fixedIncome.integrity.warnings[0]).toContain("campos complementares foram ignorados");
  });

  it("inicia a sessão privada sem depender de um JSON publicado anteriormente", () => {
    const result = buildSpreadsheetData([
      { values: [] },
      { values: [] },
      { values: [["AAA", "Empresa", "", "Tecnologia", "", 11, null, null, null, "NYSE"]] },
      { values: [] },
      { values: [] },
      { values: [] },
      { values: [[5]] },
      { values: [] },
      { values: [] },
      { values: [] },
      { values: [[5]] },
    ], null, "2026-07-27T12:00:00.000Z");

    expect(result.portfolio.assets[0].annual).toBeNull();
    expect(result.portfolio.integrity.warnings[0]).toContain("Preços anuais inválidos");
  });

  it("preserva a origem do último histórico anual válido e o marca como contingência", () => {
    const previousWithAnnual: PortfolioData = {
      ...previousPortfolio,
      generatedAt: "2026-07-01T10:00:00.000Z",
      assets: [{
        ticker: "AAA",
        name: "Empresa",
        sector: "Tecnologia",
        currentPrice: 10,
        exchange: "NYSE",
        annual: { min: 8, average: 10, max: 15, observations: 365, currency: "USD" },
      }],
    };
    const result = buildSpreadsheetData([
      { values: [] },
      { values: [] },
      { values: [["AAA", "Empresa", "", "Tecnologia", "", 11, null, null, null, "NYSE"]] },
      { values: [] },
      { values: [] },
      { values: [] },
      { values: [[5]] },
      { values: [] },
      { values: [] },
      { values: [] },
      { values: [[5]] },
    ], previousWithAnnual, "2026-07-27T12:00:00.000Z");

    expect(result.portfolio.assets[0].annual).toMatchObject({
      asOf: "2026-07-01T10:00:00.000Z",
      isFallback: true,
    });
  });
});

describe("isGoogleSheetsAuthorizationError", () => {
  it("identifica somente respostas que exigem nova autorização", () => {
    expect(isGoogleSheetsAuthorizationError(Object.assign(new Error("expirado"), { status: 401 }))).toBe(true);
    expect(isGoogleSheetsAuthorizationError(Object.assign(new Error("sem acesso"), { status: 403 }))).toBe(true);
    expect(isGoogleSheetsAuthorizationError(Object.assign(new Error("limite"), { status: 429 }))).toBe(false);
    expect(isGoogleSheetsAuthorizationError(new Error("falha de rede"))).toBe(false);
  });
});
