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
  source: { spreadsheetId: "test", ranges: { test: "A1" }, currentQuotes: "test", annualHistory: "test" },
  purchases: [transaction],
  sales: [],
  assets: [asset],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, annualRows: 1, warnings: [] },
};
const fiis: FiiData = {
  schemaVersion: 1,
  generatedAt: portfolio.generatedAt,
  source: { spreadsheetId: "test", ranges: { test: "A1" }, currentQuotes: "test" },
  exchangeRate: { brlPerUsd: 5, source: "test" },
  purchases: [transaction],
  sales: [],
  assets: [{ ...asset, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};
const crypto: CryptoData = {
  schemaVersion: 1,
  generatedAt: portfolio.generatedAt,
  source: { spreadsheetId: "test", ranges: { test: "A1" }, currentQuotes: "test" },
  purchases: [transaction],
  sales: [],
  assets: [{ ...asset, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};
const fixedIncome: FixedIncomeData = {
  schemaVersion: 1,
  generatedAt: portfolio.generatedAt,
  source: { spreadsheetId: "test", ranges: { test: "A1" } },
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

  it("rejeita horário sintaticamente válido, mas impossível", () => {
    const invalid = structuredClone(portfolio);
    invalid.purchases[0].time = "25:61:00";
    expect(() => parsePortfolioData(invalid)).toThrow("valores inconsistentes");
  });

  it("rejeita versão de contrato e instante de geração inválidos", () => {
    const invalidVersion = structuredClone(portfolio);
    invalidVersion.schemaVersion = 2;
    expect(() => parsePortfolioData(invalidVersion)).toThrow("valores inconsistentes");

    const invalidTimestamp = structuredClone(portfolio);
    invalidTimestamp.generatedAt = "2026-02-30T12:00:00.000Z";
    expect(() => parsePortfolioData(invalidTimestamp)).toThrow("valores inconsistentes");
  });

  it("rejeita identificadores e ordens de transação duplicados", () => {
    const duplicateId = structuredClone(portfolio);
    duplicateId.sales.push({ ...duplicateId.purchases[0], type: "sell" });
    duplicateId.integrity.saleRows = 1;
    expect(() => parsePortfolioData(duplicateId)).toThrow("identificadores de transação duplicados");

    const duplicateOrder = structuredClone(portfolio);
    duplicateOrder.purchases[0].sourceOrder = 1;
    duplicateOrder.sales.push({
      ...duplicateOrder.purchases[0],
      id: "sell-1",
      type: "sell",
      sourceOrder: 1,
    });
    duplicateOrder.integrity.saleRows = 1;
    expect(() => parsePortfolioData(duplicateOrder)).toThrow("ordens de origem duplicadas");
  });

  it("rejeita transação no grupo errado", () => {
    const invalid = structuredClone(portfolio) as unknown as Record<string, unknown>;
    const purchases = invalid.purchases as Array<Record<string, unknown>>;
    purchases[0].type = "sell";
    expect(() => parsePortfolioData(invalid)).toThrow("lista de compras contém uma venda");
  });

  it("rejeita ticker duplicado e contagens divergentes", () => {
    const duplicateTicker = structuredClone(portfolio);
    duplicateTicker.assets.push({ ...duplicateTicker.assets[0] });
    duplicateTicker.integrity.assetRows = 2;
    duplicateTicker.integrity.annualRows = 2;
    expect(() => parsePortfolioData(duplicateTicker)).toThrow("tickers de ativos duplicados");

    const invalidCount = structuredClone(portfolio);
    invalidCount.integrity.purchaseRows = 2;
    expect(() => parsePortfolioData(invalidCount)).toThrow("contagem de compras não corresponde");
  });

  it("rejeita metadados de origem e avisos vazios", () => {
    const emptyRanges = structuredClone(portfolio);
    emptyRanges.source.ranges = {};
    expect(() => parsePortfolioData(emptyRanges)).toThrow("valores inconsistentes");

    const emptyWarning = structuredClone(portfolio);
    emptyWarning.integrity.warnings = ["   "];
    expect(() => parsePortfolioData(emptyWarning)).toThrow("valores inconsistentes");
  });

  it("rejeita cotação cambial nula ou negativa quando informada", () => {
    const zeroRate = structuredClone(fiis);
    zeroRate.exchangeRate.brlPerUsd = 0;
    expect(() => parseFiiData(zeroRate)).toThrow("valores inconsistentes");

    const negativeRate = structuredClone(fixedIncome);
    negativeRate.exchangeRate.brlPerUsd = -1;
    expect(() => parseFixedIncomeData(negativeRate)).toThrow("valores inconsistentes");
  });

  it("rejeita data de vencimento inválida", () => {
    const invalid = structuredClone(fixedIncome) as unknown as Record<string, unknown>;
    const investments = invalid.investments as Array<Record<string, unknown>>;
    investments[0].maturityDate = "data-inválida";
    expect(() => parseFixedIncomeData(invalid)).toThrow("valores inconsistentes");
  });

  it("rejeita relações cronológicas inválidas em renda fixa", () => {
    const purchaseAfterMaturity = structuredClone(fixedIncome);
    purchaseAfterMaturity.investments[0].purchaseDate = "2028-01-01";
    expect(() => parseFixedIncomeData(purchaseAfterMaturity)).toThrow("ocorre após o vencimento");

    const lockupBeforePurchase = structuredClone(fixedIncome);
    lockupBeforePurchase.investments[0].lockupDate = "2025-12-31";
    expect(() => parseFixedIncomeData(lockupBeforePurchase)).toThrow("carência");
  });

  it("rejeita relações financeiras inválidas em renda fixa", () => {
    const invalidNet = structuredClone(fixedIncome);
    invalidNet.investments[0].netAmount = 1_080;
    expect(() => parseFixedIncomeData(invalidNet)).toThrow("principal mais o resultado");

    const invalidTaxRate = structuredClone(fixedIncome);
    invalidTaxRate.investments[0].taxRate = 1.01;
    expect(() => parseFixedIncomeData(invalidTaxRate)).toThrow("valores inconsistentes");
  });

  it("isola campos bruto e de imposto inconsistentes sem perder o investimento", () => {
    const inconsistent = structuredClone(fixedIncome);
    inconsistent.investments[0].grossAmount = 900;

    const parsed = parseFixedIncomeData(inconsistent);

    expect(parsed.investments).toHaveLength(1);
    expect(parsed.investments[0]).toMatchObject({
      netAmount: 1_070,
      profit: 70,
      grossAmount: null,
      taxAmount: null,
      taxRate: null,
    });
    expect(parsed.integrity.warnings).toContain(
      "Valores bruto e de imposto inconsistentes em fixed-1; os campos complementares foram ignorados.",
    );
    expect(inconsistent.investments[0].grossAmount).toBe(900);
  });

  it("rejeita identificadores e contagem divergentes em renda fixa", () => {
    const duplicateId = structuredClone(fixedIncome);
    duplicateId.investments.push({ ...duplicateId.investments[0] });
    duplicateId.integrity.investmentRows = 2;
    expect(() => parseFixedIncomeData(duplicateId)).toThrow("identificadores de investimentos duplicados");

    const invalidCount = structuredClone(fixedIncome);
    invalidCount.integrity.investmentRows = 2;
    expect(() => parseFixedIncomeData(invalidCount)).toThrow("contagem de investimentos não corresponde");
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
