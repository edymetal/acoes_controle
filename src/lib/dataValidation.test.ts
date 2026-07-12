import { describe, expect, it } from "vitest";
import portfolio from "../../public/data/portfolio.json";
import fiis from "../../public/data/fiis.json";
import crypto from "../../public/data/crypto.json";
import fixedIncome from "../../public/data/fixed-income.json";
import { parseCryptoData, parseFiiData, parseFixedIncomeData, parsePortfolioData } from "./dataValidation";

describe("validação dos dados publicados", () => {
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
});
