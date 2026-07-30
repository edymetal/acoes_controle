import type {
  CryptoData,
  EvolutionAssetClass,
  EvolutionHistoryData,
  EvolutionHistoryRecord,
  EvolutionPoint,
  FiiData,
  FixedIncomeData,
  PortfolioData,
  PortfolioModel,
} from "../types";
import { calculateConsolidation } from "./consolidation";
import { calculateCryptoPortfolio } from "./cryptoPortfolio";
import { calculateFiiPortfolio } from "./fiiPortfolio";
import { calculateFixedIncome } from "./fixedIncome";
import { calculatePortfolio } from "./portfolio";

const MAX_QUOTE_AGE_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

type MarketData = PortfolioData | FiiData | CryptoData;
type HistoricalQuote = {
  value: number;
  date: string;
  status: EvolutionHistoryRecord["status"];
};

export interface EvolutionInputs {
  history: EvolutionHistoryData;
  stocks: PortfolioData;
  fiis: FiiData | null;
  crypto: CryptoData | null;
  fixedIncome: FixedIncomeData | null;
  brlPerUsd: number | null;
}

export type EvolutionPeriod = "30d" | "6m" | "ytd" | "1y" | "max";

function daysBetween(left: string, right: string) {
  return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / MILLISECONDS_PER_DAY);
}

function transactionsUntil<T extends MarketData>(data: T, date: string): T {
  const purchases = data.purchases.filter((item) => item.date <= date);
  const sales = data.sales.filter((item) => item.date <= date);
  return {
    ...data,
    generatedAt: `${date}T23:59:59.000Z`,
    purchases,
    sales,
    integrity: {
      ...data.integrity,
      purchaseRows: purchases.length,
      saleRows: sales.length,
    },
  };
}

function portfolioAt(
  data: MarketData,
  date: string,
  quotes: Map<string, HistoricalQuote>,
): PortfolioModel {
  const dated = transactionsUntil(data, date);
  const existingTickers = new Set(dated.assets.map((asset) => asset.ticker));
  return calculatePortfolio({
    ...dated,
    assets: [
      ...dated.assets.map((asset) => ({
        ...asset,
        currentPrice: quotes.get(asset.ticker)?.value ?? 0,
      })),
      ...[...quotes.entries()].flatMap(([ticker, quote]) => existingTickers.has(ticker) ? [] : [{
        ticker,
        name: ticker,
        sector: "Histórico",
        exchange: "Não informada",
        currentPrice: quote.value,
        annual: null,
      }]),
    ],
  });
}

function activeFixedIncomePrincipal(data: FixedIncomeData | null, date: string) {
  if (!data) return 0;
  return data.investments
    .filter((investment) => investment.purchaseDate <= date && investment.maturityDate >= date)
    .reduce((sum, investment) => sum + investment.investedAmount, 0);
}

function getFxForDate(records: EvolutionHistoryRecord[]) {
  return records
    .filter((record) => record.kind === "fx" && record.symbol === "USD-BRL")
    .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
    .at(-1)?.value ?? null;
}

function updateQuoteHistory(
  records: EvolutionHistoryRecord[],
  quoteHistory: Record<EvolutionAssetClass, Map<string, HistoricalQuote>>,
) {
  for (const record of records) {
    if (record.kind !== "quote" || record.assetClass === null) continue;
    quoteHistory[record.assetClass].set(record.symbol, {
      value: record.value,
      date: record.date,
      status: record.status,
    });
  }
}

function usableQuotes(
  data: MarketData | null,
  date: string,
  quotes: Map<string, HistoricalQuote>,
) {
  const usable = new Map<string, HistoricalQuote>();
  if (!data) return usable;
  for (const [ticker, quote] of quotes) {
    if (daysBetween(quote.date, date) <= MAX_QUOTE_AGE_DAYS) usable.set(ticker, quote);
  }
  return usable;
}

function recordPoint(
  date: string,
  stocks: PortfolioModel,
  fiis: PortfolioModel | null,
  crypto: PortfolioModel | null,
  fixedIncomeBrl: number,
  fixedIncomeReady: boolean,
  brlPerUsd: number | null,
  records: EvolutionHistoryRecord[],
  usedQuotes: Map<string, HistoricalQuote>[],
): EvolutionPoint {
  const rate = brlPerUsd !== null && Number.isFinite(brlPerUsd) && brlPerUsd > 0 ? brlPerUsd : null;
  const missing: string[] = [];
  if (stocks.health.valuation !== "complete") missing.push("ações");
  if (!fiis || fiis.health.valuation !== "complete") missing.push("FIIs");
  if (!crypto || crypto.health.valuation !== "complete") missing.push("cripto");
  if (!fixedIncomeReady) missing.push("renda fixa");
  if (!rate) missing.push("câmbio");
  if (records.some((record) => record.status === "partial")) missing.push("captura parcial");
  if (usedQuotes.some((quotes) => [...quotes.values()].some((quote) =>
    quote.status === "partial" || quote.date !== date))) {
    missing.push("cotação reaproveitada");
  }

  const stocksUsd = stocks.metrics.marketValue;
  const fiisBrl = fiis?.metrics.marketValue ?? 0;
  const cryptoUsd = crypto?.metrics.marketValue ?? 0;
  const totalUsd = stocksUsd + cryptoUsd + (rate ? (fiisBrl + fixedIncomeBrl) / rate : 0);
  const totalBrl = fiisBrl + fixedIncomeBrl + (rate ? (stocksUsd + cryptoUsd) * rate : 0);

  return {
    date,
    stocksUsd,
    fiisBrl,
    cryptoUsd,
    fixedIncomeBrl,
    brlPerUsd: rate,
    totalUsd,
    totalBrl,
    complete: missing.length === 0,
    isLive: false,
    missing: [...new Set(missing)],
  };
}

function buildLivePoint(inputs: EvolutionInputs): EvolutionPoint {
  const date = inputs.stocks.generatedAt.slice(0, 10);
  const stocks = calculatePortfolio(inputs.stocks);
  const fiis = inputs.fiis ? calculateFiiPortfolio(inputs.fiis) : null;
  const crypto = inputs.crypto ? calculateCryptoPortfolio(inputs.crypto) : null;
  const fixedIncome = inputs.fixedIncome ? calculateFixedIncome(inputs.fixedIncome) : null;
  const consolidation = calculateConsolidation(stocks, fiis, crypto, fixedIncome, inputs.brlPerUsd);
  const rate = inputs.brlPerUsd !== null && inputs.brlPerUsd > 0 ? inputs.brlPerUsd : null;

  return {
    date,
    stocksUsd: stocks.metrics.marketValue,
    fiisBrl: fiis?.metrics.marketValue ?? 0,
    cryptoUsd: crypto?.metrics.marketValue ?? 0,
    fixedIncomeBrl: fixedIncome?.metrics.currentPrincipal ?? 0,
    brlPerUsd: rate,
    totalUsd: consolidation.currentValueUsd,
    totalBrl: rate ? consolidation.currentValueUsd * rate : 0,
    complete: consolidation.complete,
    isLive: true,
    missing: consolidation.complete ? [] : ["dados atuais incompletos"],
  };
}

export function calculateEvolution(inputs: EvolutionInputs): EvolutionPoint[] {
  const recordsByDate = new Map<string, EvolutionHistoryRecord[]>();
  for (const record of inputs.history.records) {
    if (record.kind === "benchmark") continue;
    const items = recordsByDate.get(record.date) ?? [];
    items.push(record);
    recordsByDate.set(record.date, items);
  }

  const quoteHistory: Record<EvolutionAssetClass, Map<string, HistoricalQuote>> = {
    stocks: new Map(),
    fiis: new Map(),
    crypto: new Map(),
  };
  const points: EvolutionPoint[] = [];
  for (const date of [...recordsByDate.keys()].sort()) {
    const records = recordsByDate.get(date) ?? [];
    updateQuoteHistory(records, quoteHistory);
    const stockQuotes = usableQuotes(inputs.stocks, date, quoteHistory.stocks);
    const fiiQuotes = usableQuotes(inputs.fiis, date, quoteHistory.fiis);
    const cryptoQuotes = usableQuotes(inputs.crypto, date, quoteHistory.crypto);
    points.push(recordPoint(
      date,
      portfolioAt(inputs.stocks, date, stockQuotes),
      inputs.fiis ? portfolioAt(inputs.fiis, date, fiiQuotes) : null,
      inputs.crypto ? portfolioAt(inputs.crypto, date, cryptoQuotes) : null,
      activeFixedIncomePrincipal(inputs.fixedIncome, date),
      Boolean(inputs.fixedIncome),
      getFxForDate(records),
      records,
      [stockQuotes, fiiQuotes, cryptoQuotes],
    ));
  }

  const livePoint = buildLivePoint(inputs);
  return [...points.filter((point) => point.date !== livePoint.date), livePoint]
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function filterEvolutionPeriod(points: EvolutionPoint[], period: EvolutionPeriod) {
  if (period === "max" || points.length === 0) return points;
  const lastDate = points.at(-1)!.date;
  const last = new Date(`${lastDate}T00:00:00Z`);
  let start: Date;
  if (period === "ytd") {
    start = new Date(Date.UTC(last.getUTCFullYear(), 0, 1));
  } else {
    const days = period === "30d" ? 30 : period === "6m" ? 183 : 365;
    start = new Date(last.getTime() - days * MILLISECONDS_PER_DAY);
  }
  const startDate = start.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= startDate);
}

export function benchmarkSeries(history: EvolutionHistoryData, dates: string[]) {
  const allowedDates = new Set(dates);
  const bySymbol = new Map<string, Array<{ date: string; value: number }>>();
  for (const record of history.records) {
    if (record.kind !== "benchmark" || !allowedDates.has(record.date)) continue;
    const items = bySymbol.get(record.symbol) ?? [];
    items.push({ date: record.date, value: record.value });
    bySymbol.set(record.symbol, items);
  }
  return [...bySymbol.entries()].flatMap(([symbol, items]) => {
    const sorted = items.sort((left, right) => left.date.localeCompare(right.date));
    const base = sorted[0]?.value;
    if (!base || base <= 0) return [];
    return [{
      symbol,
      points: sorted.map((item) => ({ date: item.date, value: item.value / base * 100 })),
    }];
  });
}
