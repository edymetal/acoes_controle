import { describe, expect, it } from "vitest";
import type { CryptoData, FiiData, FixedIncomeData, PortfolioData } from "../types";
import { parseCryptoData, parseFiiData, parseFixedIncomeData, parsePortfolioData } from "./dataValidation";

const transaction = {
  id: "buy-1",
  type: "buy" as const,
  date: "2026-01-01",
  ticker: "AAA",
  quantity: 1,
  total: 10,
  unitPrice: 10,
};
const asset = {
  ticker: "AAA",
  name: "Ativo",
  sector: "Teste",
  currentPrice: 11,
  exchange: "NYSE",
  annual: {
    min: 8,
    average: 10,
    max: 12,
    observations: 365,
    currency: "USD",
    asOf: "2026-07-27T12:00:00.000Z",
    isFallback: false,
  },
};
const portfolio: PortfolioData = {
  schemaVersion: 1,
  generatedAt: "2026-07-27T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test", annualHistory: "test" },
  purchases: [transaction],
  sales: [],
  assets: [asset],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, annualRows: 1, warnings: [] },
};
const fiis: FiiData = {
  schemaVersion: 1,
  generatedAt: portfolio.generatedAt,
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test" },
  exchangeRate: { brlPerUsd: 5, source: "test" },
  purchases: [transaction],
  sales: [],
  assets: [{ ...asset, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};
const crypto: CryptoData = {
  schemaVersion: 1,
  generatedAt: portfolio.generatedAt,
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test" },
  purchases: [transaction],
  sales: [],
  assets: [{ ...asset, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};
const fixedIncome: FixedIncomeData = {
  schemaVersion: 1,
  generatedAt: portfolio.generatedAt,
  source: { spreadsheetId: "test", ranges: {} },
  exchangeRate: { brlPerUsd: 5, source: "test" },
  investments: [{
    id: "fixed-1",
    risk: 1,
    type: "CDB",
    name: "Banco",
    fgcGuarantee: true,
    yield: 0.12,
    maturityDate: "2027-01-01",
    lockupDate: null,
    periodMonths: 12,
    investedAmount: 1_000,
    purchaseDate: "2026-01-01",
    grossAmount: 1_100,
    taxAmount: 30,
    taxRate: 0.15,
    netAmount: 1_070,
    profit: 70,
  }],
  integrity: { investmentRows: 1, warnings: [] },
};

describe("validação dos dados privados", () => {
  it("aceita os quatro datasets sincronizados", () => {
    expect(parsePortfolioData(portfolio).assets.length).toBeGreaterThan(0);
    expect(parseFiiData(fiis).assets.length).toBeGreaterThan(0);
    expect(parseCryptoData(crypto).assets.length).toBeGreaterThan(0);
    expect(parseFixedIncomeData(fixedIncome).investments.length).toBeGreaterThan(0);
  });

  it("rejeita uma transação com número inválido", () => {
    const invalid = structuredClone(portfolio) as unknown as Record<string, unknown>;
    const purchases = invalid.purchases as Array<Record<string, unknown>>;
    purchases[0].quantity = Number.NaN;
    expect(() => parsePortfolioData(invalid)).toThrow("valores inconsistentes");
  });

  it("aceita horário e ordem de origem válidos e rejeita horário malformado", () => {
    const enriched = structuredClone(portfolio);
    enriched.purchases[0].time = "09:30:00";
    enriched.purchases[0].sourceOrder = 2;
    expect(parsePortfolioData(enriched).purchases[0]).toMatchObject({ time: "09:30:00", sourceOrder: 2 });

    const invalid = structuredClone(enriched) as unknown as Record<string, unknown>;
    const purchases = invalid.purchases as Array<Record<string, unknown>>;
    purchases[0].time = "9h30";
    expect(() => parsePortfolioData(invalid)).toThrow("valores inconsistentes");
  });

  it("rejeita data de vencimento inválida", () => {
    const invalid = structuredClone(fixedIncome) as unknown as Record<string, unknown>;
    const investments = invalid.investments as Array<Record<string, unknown>>;
    investments[0].maturityDate = "data-inválida";
    expect(() => parseFixedIncomeData(invalid)).toThrow("valores inconsistentes");
  });

  it("rejeita uma data inexistente no calendário", () => {
    const invalid = structuredClone(fixedIncome) as unknown as Record<string, unknown>;
    const investments = invalid.investments as Array<Record<string, unknown>>;
    investments[0].maturityDate = "2027-02-30";
    expect(() => parseFixedIncomeData(invalid)).toThrow("valores inconsistentes");
  });

  it("aceita metadados de atualização no histórico anual", () => {
    const enriched = structuredClone(portfolio) as unknown as Record<string, unknown>;
    const assets = enriched.assets as Array<Record<string, unknown>>;
    const annual = assets[0].annual as Record<string, unknown>;
    annual.asOf = "2026-07-27T12:00:00.000Z";
    annual.isFallback = false;

    expect(parsePortfolioData(enriched).assets[0].annual?.isFallback).toBe(false);
  });

  it("rejeita histórico de contingência sem data de origem", () => {
    const invalid = structuredClone(portfolio) as unknown as Record<string, unknown>;
    const assets = invalid.assets as Array<Record<string, unknown>>;
    const annual = assets[0].annual as Record<string, unknown>;
    delete annual.asOf;
    annual.isFallback = true;

    expect(() => parsePortfolioData(invalid)).toThrow("valores inconsistentes");
  });
});
