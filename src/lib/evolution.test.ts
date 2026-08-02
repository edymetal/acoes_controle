import { describe, expect, it } from "vitest";
import type { CryptoData, FiiData, FixedIncomeData, PortfolioData } from "../types";
import {
  buildEvolutionCalendar,
  calculateEvolution,
  filterEvolutionPeriod,
  getEvolutionCalendarYears,
  getEvolutionMonthContributions,
} from "./evolution";
import { buildEvolutionHistoryData } from "./evolutionHistory";

const stocks: PortfolioData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test", annualHistory: "test" },
  purchases: [{ id: "stock-buy", type: "buy", date: "2026-01-01", ticker: "AAA", quantity: 10, unitPrice: 10, total: 100 }],
  sales: [],
  assets: [{ ticker: "AAA", name: "AAA", sector: "Teste", exchange: "NYSE", currentPrice: 15, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, annualRows: 0, warnings: [] },
};

const fiis: FiiData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test" },
  exchangeRate: { brlPerUsd: 5, source: "test" },
  purchases: [{ id: "fii-buy", type: "buy", date: "2026-01-01", ticker: "FII11", quantity: 2, unitPrice: 100, total: 200 }],
  sales: [],
  assets: [{ ticker: "FII11", name: "FII", sector: "Teste", exchange: "B3", currentPrice: 110, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};

const crypto: CryptoData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test" },
  purchases: [{ id: "crypto-buy", type: "buy", date: "2026-01-01", ticker: "BTC", quantity: 0.1, unitPrice: 50_000, total: 5_000 }],
  sales: [],
  assets: [{ ticker: "BTC", name: "Bitcoin", sector: "Cripto", exchange: "Cripto", currentPrice: 60_000, annual: null }],
  integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, warnings: [] },
};

const fixedIncome: FixedIncomeData = {
  schemaVersion: 1,
  generatedAt: "2026-01-03T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {} },
  exchangeRate: { brlPerUsd: 5, source: "test" },
  investments: [{
    id: "fixed-1",
    risk: 1,
    type: "CDB",
    name: "Banco",
    fgcGuarantee: true,
    yield: 0.1,
    maturityDate: "2026-12-31",
    lockupDate: null,
    periodMonths: 12,
    investedAmount: 1_000,
    purchaseDate: "2026-01-01",
    grossAmount: 1_120,
    taxAmount: 20,
    taxRate: 0.15,
    netAmount: 1_100,
    profit: 100,
  }],
  integrity: { investmentRows: 1, warnings: [] },
};

describe("calculateEvolution", () => {
  it("reconstrói o patrimônio histórico e mantém paridade com o consolidado atual", () => {
    const history = buildEvolutionHistoryData([
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "stocks", "AAA", "USD", 12, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "fiis", "FII11", "BRL", 105, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "crypto", "BTC", "USD", 55_000, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "fx", "", "USD-BRL", "BRL", 5, "valid"],
    ], "2026-01-03T12:00:00.000Z");

    const points = calculateEvolution({ history, stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 });

    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({
      date: "2026-01-01",
      stocksUsd: 100,
      fiisBrl: 200,
      cryptoUsd: 5_000,
      fixedIncomeBrl: 1_000,
      totalUsd: 5_340,
      complete: false,
      isLive: false,
      reconstructed: true,
    });
    expect(points[0].missing).toEqual(expect.arrayContaining([
      "preços das movimentações",
      "câmbio atual estimado",
    ]));
    expect(points[1]).toMatchObject({
      date: "2026-01-02",
      stocksUsd: 120,
      fiisBrl: 210,
      cryptoUsd: 5_500,
      fixedIncomeBrl: 1_000,
      totalUsd: 5_862,
      complete: true,
      isLive: false,
      reconstructed: false,
    });
    expect(points[2]).toMatchObject({
      date: "2026-01-03",
      totalUsd: 6_394,
      totalBrl: 31_970,
      complete: true,
      isLive: true,
      reconstructed: false,
    });
  });

  it("usa o câmbio atual como estimativa quando o câmbio histórico está ausente", () => {
    const history = buildEvolutionHistoryData([
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "stocks", "AAA", "USD", 12, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "fiis", "FII11", "BRL", 105, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "crypto", "BTC", "USD", 55_000, "valid"],
    ], "2026-01-03T12:00:00.000Z");

    const point = calculateEvolution({ history, stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 })
      .find((item) => item.date === "2026-01-02")!;
    expect(point.complete).toBe(false);
    expect(point.missing).toContain("câmbio atual estimado");
    expect(point.totalUsd).toBe(5_862);
  });

  it("cria a série inicial somente com as movimentações já existentes", () => {
    const history = buildEvolutionHistoryData([], "2026-01-03T12:00:00.000Z");

    const points = calculateEvolution({ history, stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 });

    expect(points.map((point) => point.date)).toEqual(["2026-01-01", "2026-01-03"]);
    expect(points[0]).toMatchObject({
      totalUsd: 5_340,
      reconstructed: true,
      isLive: false,
    });
    expect(points[1]).toMatchObject({
      totalUsd: 6_394,
      reconstructed: false,
      isLive: true,
    });
  });

  it("prefere o fechamento capturado ao preço da movimentação na mesma data", () => {
    const history = buildEvolutionHistoryData([
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "quote", "stocks", "AAA", "USD", 12, "valid"],
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "quote", "fiis", "FII11", "BRL", 105, "valid"],
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "quote", "crypto", "BTC", "USD", 55_000, "valid"],
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "fx", "", "USD-BRL", "BRL", 5, "valid"],
    ], "2026-01-03T12:00:00.000Z");

    const point = calculateEvolution({ history, stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 })[0];

    expect(point).toMatchObject({
      date: "2026-01-01",
      stocksUsd: 120,
      fiisBrl: 210,
      cryptoUsd: 5_500,
      totalUsd: 5_862,
      complete: true,
      reconstructed: false,
    });
  });

  it("prefere uma movimentação nova a um fechamento anterior reaproveitado", () => {
    const stocksWithSecondPurchase: PortfolioData = {
      ...stocks,
      purchases: [
        ...stocks.purchases,
        {
          id: "stock-buy-2",
          type: "buy",
          date: "2026-01-02",
          ticker: "AAA",
          quantity: 1,
          unitPrice: 20,
          total: 20,
        },
      ],
      integrity: { ...stocks.integrity, purchaseRows: 2 },
    };
    const history = buildEvolutionHistoryData([
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "quote", "stocks", "AAA", "USD", 12, "valid"],
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "quote", "fiis", "FII11", "BRL", 105, "valid"],
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "quote", "crypto", "BTC", "USD", 55_000, "valid"],
      ["2026-01-01", "2026-01-01T23:00:00.000Z", "fx", "", "USD-BRL", "BRL", 5, "valid"],
    ], "2026-01-03T12:00:00.000Z");

    const point = calculateEvolution({
      history,
      stocks: stocksWithSecondPurchase,
      fiis,
      crypto,
      fixedIncome,
      brlPerUsd: 5,
    }).find((item) => item.date === "2026-01-02")!;

    expect(point.stocksUsd).toBe(220);
    expect(point.reconstructed).toBe(true);
    expect(point.missing).toContain("preços das movimentações");
  });
});

describe("filterEvolutionPeriod", () => {
  it("mantém somente os últimos trinta dias", () => {
    const points = [
      { date: "2026-01-01" },
      { date: "2026-02-01" },
      { date: "2026-03-01" },
    ] as ReturnType<typeof calculateEvolution>;
    expect(filterEvolutionPeriod(points, "30d").map((point) => point.date)).toEqual(["2026-02-01", "2026-03-01"]);
  });
});

describe("calendário patrimonial", () => {
  it("consolida os aportes e o último patrimônio de cada mês na moeda escolhida", () => {
    const history = buildEvolutionHistoryData([
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "stocks", "AAA", "USD", 12, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "fiis", "FII11", "BRL", 105, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "quote", "crypto", "BTC", "USD", 55_000, "valid"],
      ["2026-01-02", "2026-01-02T23:00:00.000Z", "fx", "", "USD-BRL", "BRL", 5, "valid"],
    ], "2026-01-03T12:00:00.000Z");
    const inputs = { stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 };
    const points = calculateEvolution({ history, ...inputs });

    const usdCalendar = buildEvolutionCalendar(points, inputs, 2026, "USD");
    const brlCalendar = buildEvolutionCalendar(points, inputs, 2026, "BRL");

    expect(usdCalendar).toHaveLength(12);
    expect(usdCalendar[0]).toMatchObject({
      invested: 5_340,
      investmentCount: 4,
      patrimony: 6_394,
      closingDate: "2026-01-03",
      isCurrent: true,
      isFuture: false,
    });
    expect(brlCalendar[0]).toMatchObject({ invested: 26_700, patrimony: 31_970 });
    expect(usdCalendar[1]).toMatchObject({
      invested: 0,
      patrimony: null,
      isFuture: true,
    });
  });

  it("oferece todos os anos entre o primeiro registro e o período atual", () => {
    const inputs = { stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 };
    const points = [{ date: "2024-08-10" }, { date: "2026-01-03" }] as ReturnType<typeof calculateEvolution>;

    expect(getEvolutionCalendarYears(points, inputs)).toEqual([2024, 2025, 2026]);
  });

  it("detalha todos os aportes do mês com identificação e conversão de moeda", () => {
    const history = buildEvolutionHistoryData([], "2026-01-03T12:00:00.000Z");
    const inputs = { stocks, fiis, crypto, fixedIncome, brlPerUsd: 5 };
    const points = calculateEvolution({ history, ...inputs });

    const contributions = getEvolutionMonthContributions(points, inputs, 2026, 0, "USD");

    expect(contributions).toHaveLength(4);
    expect(contributions.find((item) => item.assetClass === "stocks")).toMatchObject({
      title: "AAA",
      subtitle: "AAA",
      quantity: 10,
      unitPrice: 10,
      nativeCurrency: "USD",
      nativeValue: 100,
      currency: "USD",
      value: 100,
    });
    expect(contributions.find((item) => item.assetClass === "fiis")).toMatchObject({
      title: "FII11",
      subtitle: "FII",
      nativeCurrency: "BRL",
      nativeValue: 200,
      value: 40,
    });
    expect(contributions.find((item) => item.assetClass === "fixedIncome")).toMatchObject({
      title: "Banco",
      subtitle: "CDB",
      quantity: null,
      nativeValue: 1_000,
      value: 200,
    });
    const contributionsBrl = getEvolutionMonthContributions(points, inputs, 2026, 0, "BRL");
    expect(contributionsBrl.find((item) => item.assetClass === "stocks")?.value).toBe(500);
    expect(contributionsBrl.find((item) => item.assetClass === "fiis")?.value).toBe(200);
    expect(getEvolutionMonthContributions(points, inputs, 2026, 1, "USD")).toEqual([]);
  });
});
