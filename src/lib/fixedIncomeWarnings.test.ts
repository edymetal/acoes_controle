import { describe, expect, it } from "vitest";
import { parseFixedIncomeSupplementalWarning } from "./fixedIncomeWarnings";

describe("parseFixedIncomeSupplementalWarning", () => {
  it("identifica a linha e o motivo detalhado da inconsistência", () => {
    expect(parseFixedIncomeSupplementalWarning(
      "Valores bruto e de imposto inconsistentes em fixed-income-40: o valor líquido não corresponde ao valor bruto menos o imposto; os campos complementares foram ignorados.",
    )).toEqual({
      original: "Valores bruto e de imposto inconsistentes em fixed-income-40: o valor líquido não corresponde ao valor bruto menos o imposto; os campos complementares foram ignorados.",
      row: 40,
      reason: "o valor líquido não corresponde ao valor bruto menos o imposto",
    });
  });

  it("mantém compatibilidade com avisos gerados pela versão anterior", () => {
    expect(parseFixedIncomeSupplementalWarning(
      "Valores bruto e de imposto inconsistentes em fixed-income-40; os campos complementares foram ignorados.",
    )).toMatchObject({
      row: 40,
      reason: "os valores bruto, de imposto e líquido não fecham entre si",
    });
  });

  it("não transforma outros avisos de renda fixa", () => {
    expect(parseFixedIncomeSupplementalWarning(
      "Ativo de renda fixa inválido na linha 40 da aba Fixa Hist.",
    )).toBeNull();
  });
});
