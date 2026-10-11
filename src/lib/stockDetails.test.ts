import { describe, expect, it } from "vitest";
import { calculatePortfolio } from "./portfolio";
import { getStockActivity, getStockDetailsAsset, getStockMarketLinks } from "./stockDetails";
import type { Asset, PortfolioData } from "../types";

const asset: Asset = { ticker: "T", name: "AT&T", sector: "Telecom", exchange: "NYSE", currentPrice: 25, annual: null };
const data: PortfolioData = {
  schemaVersion: 1,
  generatedAt: "2026-10-10T12:00:00.000Z",
  source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test", annualHistory: "test" },
  purchases: [{ id: "buy", type: "buy", ticker: "T", date: "2025-01-01", quantity: 10, unitPrice: 10, total: 100 }],
  sales: [{ id: "sell", type: "sell", ticker: "T", date: "2026-01-02", quantity: 4, unitPrice: 20, total: 80 }],
  assets: [asset],
  integrity: { purchaseRows: 1, saleRows: 1, assetRows: 1, annualRows: 0, warnings: [] },
};

describe("getStockDetailsAsset", () => {
  it("preserva nome, bolsa e cotação da planilha para posições encerradas", () => {
    const model = calculatePortfolio({ ...data, sales: [{ ...data.sales[0], quantity: 10, total: 200 }] });
    expect(model.positions).toEqual([]);
    const details = getStockDetailsAsset(data, model, "T");
    expect(details).toEqual(asset);
    expect(getStockMarketLinks(details!).chartUrl).not.toBeNull();
  });

  it("mantém os detalhes de uma posição quando o cadastro do ativo está ausente", () => {
    const details = getStockDetailsAsset({ assets: [] }, calculatePortfolio(data), "T");
    expect(details).toMatchObject({ ticker: "T", name: "AT&T", exchange: "NYSE", currentPrice: 25 });
  });

  it("permite consultar operações antigas sem inventar uma cotação ou bolsa", () => {
    const missingAsset = { ...data, assets: [], sales: [{ ...data.sales[0], quantity: 10, total: 200 }] };
    const details = getStockDetailsAsset(missingAsset, calculatePortfolio(missingAsset), "T");
    expect(details).toMatchObject({ ticker: "T", currentPrice: 0, exchange: "Não informada", annual: null });
    expect(getStockMarketLinks(details!).chartUrl).toBeNull();
    expect(getStockActivity(calculatePortfolio(missingAsset), details!.ticker).realizedProfit).toBe(100);
    expect(getStockDetailsAsset(data, calculatePortfolio(data), null)).toBeNull();
  });
});

describe("getStockMarketLinks", () => {
  it("abre o ativo na bolsa correta com o período inicial de um ano", () => {
    const links = getStockMarketLinks(asset);
    const chartUrl = new URL(links.chartUrl!);
    const config = JSON.parse(decodeURIComponent(chartUrl.hash.slice(1)));
    expect(chartUrl.origin).toBe("https://s.tradingview.com");
    expect(config.symbols).toEqual([["NYSE:T|1D"]]);
    expect(config.dateRanges).toEqual(["12m|1D"]);
    expect(config.chartType).toBe("area");
    expect(config.locale).toBe("br");
    expect(links.googleFinanceUrl).toBe("https://www.google.com/finance/quote/T%3ANYSE?window=1Y");
    expect(config).not.toHaveProperty("currentPrice");
    expect(config).not.toHaveProperty("name");
  });

  it("altera o período do gráfico e da consulta no Google Finance juntos", () => {
    const monthly = getStockMarketLinks(asset, "pt-BR", "1m");
    const monthlyConfig = JSON.parse(decodeURIComponent(new URL(monthly.chartUrl!).hash.slice(1)));
    expect(monthlyConfig.dateRanges).toEqual(["1m|30"]);
    expect(monthly.googleFinanceUrl).toContain("window=1M");
    const fiveYears = getStockMarketLinks(asset, "pt-BR", "5y");
    expect(JSON.parse(decodeURIComponent(new URL(fiveYears.chartUrl!).hash.slice(1))).dateRanges).toEqual(["60m|1W"]);
    expect(fiveYears.googleFinanceUrl).toContain("window=5Y");
  });

  it("normaliza bolsas e preserva códigos de classes de ações", () => {
    const links = getStockMarketLinks({ ...asset, ticker: " brk.b ", exchange: " nyse " }, "it-IT");
    expect(JSON.parse(decodeURIComponent(new URL(links.chartUrl!).hash.slice(1)))).toMatchObject({ symbols: [["NYSE:BRK.B|1D"]], locale: "it" });
    const etfLinks = getStockMarketLinks({ ...asset, ticker: "SPY", exchange: "NYSEARCA" });
    expect(etfLinks.googleFinanceUrl).toContain("SPY%3ANYSEARCA");
    expect(JSON.parse(decodeURIComponent(new URL(etfLinks.chartUrl!).hash.slice(1))).symbols).toEqual([["AMEX:SPY|1D"]]);
  });

  it("não adivinha a bolsa nem cria um gráfico para códigos inválidos", () => {
    for (const invalid of [{ ...asset, exchange: "Não informada" }, { ...asset, ticker: "</script>" }]) {
      const links = getStockMarketLinks(invalid);
      expect(links.chartUrl).toBeNull();
      expect(links.tradingViewUrl).toBeNull();
      expect(new URL(links.googleFinanceUrl).origin).toBe("https://www.google.com");
    }
  });
});

describe("getStockActivity", () => {
  it("separa as operações do ativo e mantém o custo médio e o lucro calculados", () => {
    const model = calculatePortfolio({ ...data, purchases: [...data.purchases, { ...data.purchases[0], id: "other", ticker: "OTHER" }] });
    const originalOrder = model.transactions.map((item) => item.id);
    const activity = getStockActivity(model, "T");
    expect(activity.transactions.map((item) => item.id)).toEqual(["sell", "buy"]);
    expect(model.transactions.map((item) => item.id)).toEqual(originalOrder);
    expect(activity).toMatchObject({ purchaseTotal: 100, saleTotal: 80, purchaseCount: 1, saleCount: 1, realizedProfit: 40, accountingReliable: true });
    expect(activity.position).toMatchObject({ quantity: 6, costBasis: 60, marketValue: 150, unrealized: 90 });
  });

  it("mantém o lucro realizado quando a posição foi encerrada ou está sem cotação", () => {
    const closed = getStockActivity(calculatePortfolio({ ...data, sales: [{ ...data.sales[0], quantity: 10, total: 200 }] }), "T");
    expect(closed.position).toBeUndefined();
    expect(closed.realizedProfit).toBe(100);
    const missingQuote = getStockActivity(calculatePortfolio({ ...data, assets: [{ ...asset, currentPrice: 0 }] }), "T");
    expect(missingQuote.position?.quoteAvailable).toBe(false);
    expect(missingQuote.realizedProfit).toBe(40);
  });

  it("não apresenta lucros como confiáveis quando há ambiguidade nas operações", () => {
    const model = calculatePortfolio(data);
    model.health.ambiguousTransactionTickers.push("T");
    const activity = getStockActivity(model, "T");
    expect(activity.accountingReliable).toBe(false);
    expect(activity.realizedProfit).toBeNull();
    expect(activity.purchaseTotal).toBe(100);
    expect(activity.saleTotal).toBe(80);
  });

  it("oferece um resumo vazio para ativos sem movimentações", () => {
    const activity = getStockActivity(calculatePortfolio(data), "NEW");
    expect(activity.transactions).toEqual([]);
    expect(activity.position).toBeUndefined();
    expect(activity).toMatchObject({ purchaseTotal: 0, saleTotal: 0, realizedProfit: 0 });
  });
});
