import { describe, expect, it } from "vitest";
import { filterEvolutionTooltipEntries } from "./evolutionTooltip";

const entries = [
  { dataKey: "stocks", name: "Ações", value: 100 },
  { dataKey: "fiis", name: "FIIs", value: 200 },
  { dataKey: "crypto", name: "Cripto", value: 300 },
  { dataKey: "fixedIncome", name: "Renda fixa", value: 400 },
  { dataKey: "total", name: "Patrimônio", value: 1_000 },
];

describe("filterEvolutionTooltipEntries", () => {
  it("mantém todos os itens quando o cursor está fora das faixas coloridas", () => {
    expect(filterEvolutionTooltipEntries(entries, null)).toEqual(entries);
  });

  it("mantém somente a classe correspondente à faixa em hover", () => {
    expect(filterEvolutionTooltipEntries(entries, "crypto")).toEqual([
      { dataKey: "crypto", name: "Cripto", value: 300 },
    ]);
  });
});
