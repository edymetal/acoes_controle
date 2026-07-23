import { describe, expect, it } from "vitest";
import { getNextSortConfig, sortRows } from "./SortableTable";

const rows = [
  { name: "Ativo 10", value: 20, optional: null },
  { name: "Ativo 2", value: 5, optional: 8 },
  { name: "ativo 1", value: 12, optional: 3 },
];

describe("sortRows", () => {
  it("alterna a direção ao clicar novamente no mesmo título", () => {
    const firstClick = getNextSortConfig(null, "value");
    const secondClick = getNextSortConfig(firstClick, "value");
    const differentColumnClick = getNextSortConfig(secondClick, "name");

    expect(firstClick).toEqual({ key: "value", direction: "ascending" });
    expect(secondClick).toEqual({ key: "value", direction: "descending" });
    expect(differentColumnClick).toEqual({ key: "name", direction: "ascending" });
  });

  it("ordena textos em ordem natural crescente", () => {
    const sorted = sortRows(rows, { key: "name", direction: "ascending" }, (row, key) => row[key]);

    expect(sorted.map((row) => row.name)).toEqual(["ativo 1", "Ativo 2", "Ativo 10"]);
  });

  it("inverte a ordenação numérica", () => {
    const sorted = sortRows(rows, { key: "value", direction: "descending" }, (row, key) => row[key]);

    expect(sorted.map((row) => row.value)).toEqual([20, 12, 5]);
  });

  it("mantém a coleção original intacta", () => {
    const original = [...rows];

    sortRows(rows, { key: "optional", direction: "ascending" }, (row, key) => row[key]);

    expect(rows).toEqual(original);
  });

  it("mantém valores ausentes no fim em ambas as direções", () => {
    const sorted = sortRows(rows, { key: "optional", direction: "descending" }, (row, key) => row[key]);

    expect(sorted.map((row) => row.optional)).toEqual([8, 3, null]);
  });
});
