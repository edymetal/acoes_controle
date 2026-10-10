import type { Asset, PortfolioModel } from "../types";

export const STOCK_CHART_PERIODS = [
  { id: "1d", label: "1 dia", description: "Último dia", range: "1d|1", googleWindow: "1D" },
  { id: "5d", label: "5 dias", description: "Últimos 5 dias", range: "5d|5", googleWindow: "5D" },
  { id: "1m", label: "1 mês", description: "Último mês", range: "1m|30", googleWindow: "1M" },
  { id: "6m", label: "6 meses", description: "Últimos 6 meses", range: "6m|1D", googleWindow: "6M" },
  { id: "ytd", label: "Este ano", description: "Desde o início do ano", range: "ytd|1D", googleWindow: "YTD" },
  { id: "1y", label: "1 ano", description: "Últimos 12 meses", range: "12m|1D", googleWindow: "1Y" },
  { id: "5y", label: "5 anos", description: "Últimos 5 anos", range: "60m|1W", googleWindow: "5Y" },
  { id: "max", label: "Máx.", description: "Todo o histórico disponível", range: "all|1M", googleWindow: "MAX" },
] as const;

export type StockChartPeriod = typeof STOCK_CHART_PERIODS[number]["id"];

const EXCHANGES: Record<string, { google: string; tradingView: string }> = {
  NASDAQ: { google: "NASDAQ", tradingView: "NASDAQ" },
  NASDAQGS: { google: "NASDAQ", tradingView: "NASDAQ" },
  NASDAQGM: { google: "NASDAQ", tradingView: "NASDAQ" },
  NASDAQCM: { google: "NASDAQ", tradingView: "NASDAQ" },
  NYSE: { google: "NYSE", tradingView: "NYSE" },
  NYSEARCA: { google: "NYSEARCA", tradingView: "AMEX" },
  AMEX: { google: "NYSEAMERICAN", tradingView: "AMEX" },
  NYSEAMERICAN: { google: "NYSEAMERICAN", tradingView: "AMEX" },
  BATS: { google: "BATS", tradingView: "BATS" },
};

export function getStockMarketLinks(asset: Pick<Asset, "ticker" | "exchange" | "name">, language = "pt-BR", period: StockChartPeriod = "1y") {
  const ticker = asset.ticker.trim().toUpperCase();
  const exchange = EXCHANGES[asset.exchange.trim().toUpperCase()];
  if (!exchange || !/^[A-Z0-9][A-Z0-9._-]*$/.test(ticker)) {
    return {
      chartUrl: null,
      tradingViewUrl: null,
      googleFinanceUrl: `https://www.google.com/search?${new URLSearchParams({ q: `${asset.ticker} ${asset.name} Google Finance` })}`,
    };
  }

  const symbol = `${exchange.tradingView}:${ticker}`;
  const selectedPeriod = STOCK_CHART_PERIODS.find((item) => item.id === period)!;
  // Use the same cross-origin iframe URL/configuration as TradingView's official
  // symbol-overview embed script, without executing vendor scripts in the app.
  const chartConfig = {
    symbols: [[symbol + "|1D"]],
    dateRanges: [selectedPeriod.range],
    colorTheme: "dark",
    locale: language === "it-IT" ? "it" : "br",
    width: "100%",
    height: "100%",
    autosize: true,
    chartOnly: false,
    isTransparent: true,
    showVolume: false,
    showMA: false,
    hideDateRanges: true,
    hideMarketStatus: false,
    hideSymbolLogo: false,
    scalePosition: "right",
    scaleMode: "Normal",
    noTimeScale: false,
    valuesTracking: "1",
    changeMode: "price-and-percent",
    chartType: "area",
    lineWidth: 2,
    lineType: 0,
    fontFamily: "system-ui, sans-serif",
  };

  return {
    chartUrl: `https://s.tradingview.com/embed-widget/symbol-overview/?locale=${chartConfig.locale}#${encodeURIComponent(JSON.stringify(chartConfig))}`,
    tradingViewUrl: `https://www.tradingview.com/chart/?${new URLSearchParams({ symbol })}`,
    googleFinanceUrl: `https://www.google.com/finance/quote/${encodeURIComponent(`${ticker}:${exchange.google}`)}?window=${selectedPeriod.googleWindow}`,
  };
}

export function getStockActivity(model: PortfolioModel, ticker: string) {
  const transactions = model.transactions.filter((item) => item.ticker === ticker);
  const purchases = transactions.filter((item) => item.type === "buy");
  const sales = transactions.filter((item) => item.type === "sell");
  const position = model.positions.find((item) => item.ticker === ticker);
  const accountingReliable = !model.health.ambiguousTransactionTickers.includes(ticker);
  return {
    transactions,
    position,
    accountingReliable,
    purchaseCount: purchases.length,
    saleCount: sales.length,
    purchaseTotal: purchases.reduce((total, item) => total + item.total, 0),
    saleTotal: sales.reduce((total, item) => total + item.total, 0),
    realizedProfit: accountingReliable && sales.every((item) => item.realizedProfit !== null)
      ? sales.reduce((total, item) => total + item.realizedProfit!, 0)
      : null,
  };
}
