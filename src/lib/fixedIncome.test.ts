import { describe, expect, it } from "vitest";
import type { FixedIncomeData } from "../types";
import { calculateFixedIncome } from "./fixedIncome";

const data: FixedIncomeData = {
  schemaVersion: 1,
  generatedAt: "2026-07-12T12:00:00.000Z",
  source: { spreadsheetId: "sheet", ranges: {} },
  exchangeRate: { brlPerUsd: 5, source: "'Dólar'!G5" },
  investments: [
    { id: "one", risk: 2, type: "CDB", name: "Banco A", fgcGuarantee: true, yield: 0.15, maturityDate: "2027-01-15", lockupDate: "2027-01-15", periodMonths: 12, investedAmount: 1000, purchaseDate: "2026-01-15", grossAmount: 1170, taxAmount: 30, taxRate: 0.175, netAmount: 1140, profit: 140 },
    { id: "two", risk: 3, type: "CDB", name: "Banco B", fgcGuarantee: true, yield: "IPCA + 9,4%", maturityDate: "2028-01-20", lockupDate: null, periodMonths: 24, investedAmount: 2000, purchaseDate: "2026-01-20", grossAmount: 2300, taxAmount: 50, taxRate: 0.15, netAmount: 2250, profit: 250 },
    { id: "three", risk: 4, type: "LCI", name: "Banco C", fgcGuarantee: true, yield: 0.12, maturityDate: "2027-03-10", lockupDate: null, periodMonths: 10, investedAmount: 500, purchaseDate: "2026-05-10", grossAmount: 560, taxAmount: 0, taxRate: 0, netAmount: 560, profit: 60 },
  ],
  integrity: { investmentRows: 3, warnings: [] },
};

describe("calculateFixedIncome", () => {
  it("consolida valores e retorno previstos", () => {
    const model = calculateFixedIncome(data);
    expect(model.metrics.investedAmount).toBe(3500);
    expect(model.metrics.netAmount).toBe(3950);
    expect(model.metrics.profit).toBe(450);
    expect(model.metrics.returnRate).toBeCloseTo(450 / 3500);
  });

  it("agrupa vencimentos nos 12 meses e identifica lacunas", () => {
    const model = calculateFixedIncome(data);
    expect(model.months).toHaveLength(12);
    expect(model.months[0].investments).toHaveLength(2);
    expect(model.months[0].amountToReceive).toBe(3390);
    expect(model.months[2].covered).toBe(true);
    expect(model.metrics.coveredMonths).toBe(2);
    expect(model.metrics.missingMonths).toBe(10);
  });

  it("exclui aplicações vencidas dos totais atuais", () => {
    const expired = { ...data.investments[0], id: "expired", maturityDate: "2025-12-31", netAmount: 5000 };
    const model = calculateFixedIncome({ ...data, investments: [...data.investments, expired] });
    expect(model.metrics.assetCount).toBe(3);
    expect(model.metrics.netAmount).toBe(3950);
    expect(model.warnings).toContain("1 aplicação vencida foi excluída dos totais atuais.");
  });
});
