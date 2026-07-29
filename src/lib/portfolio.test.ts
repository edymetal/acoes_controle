import { describe, expect, it } from "vitest";
import { calculatePortfolio, getAnnualRealizedProfit, getStrategySignal } from "./portfolio";
import type { Asset, PortfolioData } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "./settings";

const data: PortfolioData = {
  schemaVersion: 1,
  generatedAt: "2026-01-01T12:00:00.000Z",
  source: {
    spreadsheetId: "test",
    ranges: {},
    currentQuotes: "test",
    annualHistory: "test",
  },
  purchases: [
    { id: "buy-1", type: "buy", date: "2025-01-01", ticker: "AAA", quantity: 10, total: 100, unitPrice: 10 },
    { id: "buy-2", type: "buy", date: "2025-02-01", ticker: "AAA", quantity: 10, total: 200, unitPrice: 20 },
  ],
  sales: [
    { id: "sell-1", type: "sell", date: "2025-03-01", ticker: "AAA", quantity: 5, total: 100, unitPrice: 20 },
  ],
  assets: [
    { ticker: "AAA", name: "A", sector: "Tech", exchange: "NYSE", currentPrice: 25, annual: { min: 8, average: 18, max: 30, observations: 250, currency: "USD" } },
  ],
  integrity: { purchaseRows: 2, saleRows: 1, assetRows: 1, annualRows: 1, warnings: [] },
};

describe("calculatePortfolio", () => {
  it("calcula custo médio móvel, lucro realizado e posição em aberto", () => {
    const model = calculatePortfolio(data);
    const position = model.positions[0];
    expect(position.quantity).toBe(15);
    expect(position.averageCost).toBeCloseTo(15);
    expect(position.costBasis).toBeCloseTo(225);
    expect(position.marketValue).toBeCloseTo(375);
    expect(model.metrics.realizedProfit).toBeCloseTo(25);
    expect(model.metrics.unrealizedProfit).toBeCloseTo(150);
    expect(model.metrics.totalProfit).toBeCloseTo(175);
    const sale = model.transactions.find((transaction) => transaction.id === "sell-1");
    expect(sale?.costBasis).toBeCloseTo(75);
    expect(sale?.realizedProfit).toBeCloseTo(25);
  });

  it("considera a data suficiente quando há compra e venda no mesmo dia sem horário", () => {
    const sameDayData: PortfolioData = {
      ...data,
      sales: [{ id: "sell-same-day", type: "sell", date: "2025-02-01", ticker: "AAA", quantity: 1, total: 20, unitPrice: 20 }],
      integrity: { ...data.integrity, saleRows: 1 },
    };
    const model = calculatePortfolio(sameDayData);
    expect(model.health.accounting).toBe("complete");
    expect(model.health.ambiguousTransactionTickers).toEqual([]);
    expect(model.positions[0].accountingReliable).toBe(true);
    expect(model.positions[0].quantity).toBe(19);
    expect(model.positions[0].averageCost).toBeCloseTo(15);
    expect(model.metrics.marketValue).toBeCloseTo(475);
    expect(model.transactions.find((transaction) => transaction.type === "sell")?.realizedProfit).toBeCloseTo(5);
    expect(model.warnings).not.toContain(expect.stringContaining("horários ou sequências"));
  });

  it("preserva o horário e processa venda antes da compra no mesmo dia", () => {
    const timedData: PortfolioData = {
      ...data,
      purchases: data.purchases.map((transaction) =>
        transaction.id === "buy-2" ? { ...transaction, time: "10:00:00" } : transaction,
      ),
      sales: [{
        id: "sell-same-day",
        type: "sell",
        date: "2025-02-01",
        time: "09:00:00",
        ticker: "AAA",
        quantity: 1,
        total: 20,
        unitPrice: 20,
      }],
      integrity: { ...data.integrity, saleRows: 1 },
    };
    const model = calculatePortfolio(timedData);

    expect(model.health.accounting).toBe("complete");
    expect(model.transactions.map((transaction) => transaction.id)).toEqual([
      "buy-2",
      "sell-same-day",
      "buy-1",
    ]);
    expect(model.transactions.find((transaction) => transaction.id === "sell-same-day")?.realizedProfit).toBeCloseTo(10);
    expect(model.positions[0].averageCost).toBeCloseTo(290 / 19);
  });

  it("usa a sequência da fonte quando compra e venda pertencem ao mesmo registro cronológico", () => {
    const sequencedData: PortfolioData = {
      ...data,
      purchases: data.purchases.map((transaction) =>
        transaction.id === "buy-2" ? { ...transaction, sourceOrder: 3 } : transaction,
      ),
      sales: [{
        id: "sell-same-day",
        type: "sell",
        date: "2025-02-01",
        sourceOrder: 2,
        ticker: "AAA",
        quantity: 1,
        total: 20,
        unitPrice: 20,
      }],
      integrity: { ...data.integrity, saleRows: 1 },
    };
    const model = calculatePortfolio(sequencedData);

    expect(model.health.accounting).toBe("complete");
    expect(model.transactions.find((transaction) => transaction.id === "sell-same-day")?.realizedProfit).toBeCloseTo(10);
  });

  it("mantém a venda sem posição sem inventar custo ou lucro", () => {
    const model = calculatePortfolio({
      ...data,
      purchases: [],
      sales: [{ id: "sell-only", type: "sell", date: "2025-03-01", ticker: "AAA", quantity: 2, total: 40, unitPrice: 20 }],
      integrity: { ...data.integrity, purchaseRows: 0, saleRows: 1 },
    });

    expect(model.metrics.realizedProfit).toBe(0);
    expect(model.transactions[0]).toMatchObject({ costBasis: null, realizedProfit: null });
    expect(model.warnings).toContain("Venda de AAA em 2025-03-01 excede a posição disponível.");
  });

  it("calcula somente a parcela coberta quando a venda excede a posição", () => {
    const model = calculatePortfolio({
      ...data,
      purchases: [{ id: "buy-small", type: "buy", date: "2025-01-01", ticker: "AAA", quantity: 2, total: 20, unitPrice: 10 }],
      sales: [{ id: "sell-large", type: "sell", date: "2025-03-01", ticker: "AAA", quantity: 3, total: 60, unitPrice: 20 }],
      integrity: { ...data.integrity, purchaseRows: 1, saleRows: 1 },
    });

    expect(model.metrics.realizedProfit).toBeCloseTo(20);
    expect(model.transactions[0]).toMatchObject({ costBasis: 20, realizedProfit: 20 });
    expect(model.warnings).toContain("Venda de AAA em 2025-03-01 excede a posição disponível.");
  });

  it("marca a avaliação como parcial sem transformar cotação ausente em prejuízo", () => {
    const model = calculatePortfolio({ ...data, assets: [] });
    const position = model.positions[0];

    expect(model.health.valuation).toBe("partial");
    expect(model.health.missingQuoteTickers).toEqual(["AAA"]);
    expect(position.quoteAvailable).toBe(false);
    expect(position.marketValue).toBe(0);
    expect(position.unrealized).toBe(0);
    expect(model.metrics.unrealizedProfit).toBe(0);
  });

  it("expõe a data de origem das estatísticas anuais reaproveitadas", () => {
    const model = calculatePortfolio({
      ...data,
      assets: data.assets.map((asset) => ({
        ...asset,
        annual: {
          ...asset.annual!,
          asOf: "2026-01-01T00:00:00.000Z",
          isFallback: true,
        },
      })),
    });

    expect(model.health.staleAnnualTickers).toEqual(["AAA"]);
    expect(model.health.staleAnnualAsOf).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("getAnnualRealizedProfit", () => {
  it("soma o lucro realizado por ano e preserva anos sem vendas", () => {
    const model = calculatePortfolio(data);
    const sale = model.transactions.find((transaction) => transaction.id === "sell-1")!;
    const purchase = model.transactions.find((transaction) => transaction.id === "buy-1")!;

    expect(getAnnualRealizedProfit([
      ...model.transactions,
      { ...sale, id: "sell-2024", date: "2024-03-01", realizedProfit: -5 },
      { ...purchase, id: "buy-2023", date: "2023-01-01" },
    ])).toEqual([
      { year: "2023", value: 0 },
      { year: "2024", value: -5 },
      { year: "2025", value: 25 },
    ]);
  });
});

describe("getStrategySignal", () => {
  const base: Asset = {
    ticker: "AAA",
    name: "A",
    sector: "Tech",
    exchange: "NYSE",
    currentPrice: 10,
    annual: { min: 8, average: 18, max: 30, observations: 250, currency: "USD" },
  };

  it("completa o alvo de US$ 115 entre 20% e 35% do intervalo anual", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 14 });
    expect(signal.kind).toBe("buy");
    expect(signal.targetPositionValue).toBe(115);
    expect(signal.actionAmount).toBe(115);
  });

  it("completa o alvo de US$ 105 entre 10% e 20% do intervalo anual", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 11 });
    expect(signal.kind).toBe("buy");
    expect(signal.targetPositionValue).toBe(105);
    expect(signal.actionAmount).toBe(105);
  });

  it("completa o alvo de US$ 80 quando rompe a mínima", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 7 });
    expect(signal.kind).toBe("buy");
    expect(signal.targetPositionValue).toBe(80);
    expect(signal.actionAmount).toBe(80);
    expect(signal.remainingToTarget).toBe(80);
    expect(signal.remainingToMaximum).toBe(115);
  });

  it("subtrai o valor comprado do alvo acumulado do nível", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 11 }, DEFAULT_STRATEGY_SETTINGS, 41.52, 40.37);
    expect(signal.kind).toBe("buy");
    expect(signal.targetPositionValue).toBe(105);
    expect(signal.positionCost).toBeCloseTo(40.37);
    expect(signal.actionAmount).toBeCloseTo(64.63);
    expect(signal.remainingToTarget).toBeCloseTo(64.63);
  });

  it("não recomenda nova compra quando o valor comprado já atingiu o alvo do nível", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 7 }, DEFAULT_STRATEGY_SETTINGS, 82.17, 82.17);
    expect(signal.kind).toBe("neutral");
    expect(signal.targetPositionValue).toBe(80);
    expect(signal.actionAmount).toBe(0);
    expect(signal.remainingToTarget).toBe(0);
  });

  it("compra somente o valor exato que falta para o alvo máximo", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 14 }, DEFAULT_STRATEGY_SETTINGS, 97.17, 111.22);
    expect(signal.kind).toBe("buy");
    expect(signal.actionAmount).toBeCloseTo(3.78);
    expect(signal.remainingToTarget).toBeCloseTo(3.78);
    expect(signal.remainingToMaximum).toBeCloseTo(3.78);
  });

  it("indica a primeira venda de 80% da faixa negociável", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 29 }, DEFAULT_STRATEGY_SETTINGS, 115);
    expect(signal.kind).toBe("sell");
    expect(signal.actionAmount).toBe(40);
    expect(signal.actionPercent).toBe(80);
  });

  it("indica a parcela final de US$ 10 no rompimento", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 31 }, DEFAULT_STRATEGY_SETTINGS, 75);
    expect(signal.kind).toBe("breakout");
    expect(signal.actionAmount).toBe(10);
    expect(signal.actionPercent).toBe(20);
  });

  it("preserva o piso de US$ 65 e exige venda mínima de US$ 10", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 29 }, DEFAULT_STRATEGY_SETTINGS, 70);
    expect(signal.kind).toBe("sell");
    expect(signal.actionAmount).toBe(0);
  });

  it("vende novo excesso acima do teto quando a ação continua subindo", () => {
    const signal = getStrategySignal({ ...base, currentPrice: 33 }, DEFAULT_STRATEGY_SETTINGS, 135);
    expect(signal.kind).toBe("breakout");
    expect(signal.actionAmount).toBe(20);
  });

  it("suspende o sinal quando as estatísticas anuais são de contingência", () => {
    const signal = getStrategySignal({
      ...base,
      annual: {
        ...base.annual!,
        asOf: "2026-01-01T00:00:00.000Z",
        isFallback: true,
      },
    });

    expect(signal.kind).toBe("unavailable");
    expect(signal.label).toBe("Dados desatualizados");
    expect(signal.actionAmount).toBe(0);
  });

  it("suspende o sinal quando o custo da posição depende de uma ordem ambígua", () => {
    const signal = getStrategySignal(base, DEFAULT_STRATEGY_SETTINGS, 90, 80, false);

    expect(signal.kind).toBe("unavailable");
    expect(signal.label).toBe("Ordem ambígua");
    expect(signal.actionAmount).toBe(0);
  });
});
