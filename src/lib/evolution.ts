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
  Transaction,
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
  source: "snapshot" | "transaction";
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
  source: HistoricalQuote["source"],
) {
  for (const record of records) {
    if (record.kind !== "quote" || record.assetClass === null) continue;
    quoteHistory[record.assetClass].set(record.symbol, {
      value: record.value,
      date: record.date,
      status: record.status,
      source,
    });
  }
}

function usableQuotes(
  data: MarketData | null,
  date: string,
  snapshots: Map<string, HistoricalQuote>,
  transactions: Map<string, HistoricalQuote>,
) {
  const usable = new Map(transactions);
  if (!data) return usable;
  for (const [ticker, quote] of snapshots) {
    const transaction = usable.get(ticker);
    if (daysBetween(quote.date, date) <= MAX_QUOTE_AGE_DAYS
      && (!transaction || quote.date >= transaction.date)) {
      usable.set(ticker, quote);
    }
  }
  return usable;
}

function compareTransactions(left: Transaction, right: Transaction) {
  const date = left.date.localeCompare(right.date);
  if (date !== 0) return date;
  const time = (left.time ?? "").localeCompare(right.time ?? "");
  if (time !== 0) return time;
  const sourceOrder = (left.sourceOrder ?? Number.MAX_SAFE_INTEGER)
    - (right.sourceOrder ?? Number.MAX_SAFE_INTEGER);
  if (sourceOrder !== 0) return sourceOrder;
  if (left.type !== right.type) return left.type === "buy" ? -1 : 1;
  return left.id.localeCompare(right.id);
}

function transactionQuoteRecords(
  data: MarketData | null,
  assetClass: EvolutionAssetClass,
  currency: "USD" | "BRL",
  liveDate: string,
) {
  const recordsByDate = new Map<string, EvolutionHistoryRecord[]>();
  if (!data) return recordsByDate;
  const transactions = [...data.purchases, ...data.sales]
    .filter((transaction) => transaction.date <= liveDate)
    .sort(compareTransactions);
  for (const transaction of transactions) {
    const records = recordsByDate.get(transaction.date) ?? [];
    records.push({
      id: `transaction:${assetClass}:${transaction.id}`,
      date: transaction.date,
      capturedAt: `${transaction.date}T${transaction.time ?? "23:59:59"}Z`,
      kind: "quote",
      assetClass,
      symbol: transaction.ticker,
      currency,
      value: transaction.unitPrice,
      status: "partial",
    });
    recordsByDate.set(transaction.date, records);
  }
  return recordsByDate;
}

function recordPoint(
  date: string,
  stocks: PortfolioModel,
  fiis: PortfolioModel | null,
  crypto: PortfolioModel | null,
  fixedIncomeBrl: number,
  fixedIncomeReady: boolean,
  brlPerUsd: number | null,
  estimatedFx: boolean,
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
  if (rate && estimatedFx) missing.push("câmbio atual estimado");
  if (records.some((record) => record.status === "partial")) missing.push("captura parcial");
  const portfolios = [stocks, fiis, crypto];
  const relevantQuotes = usedQuotes.flatMap((quotes, index) =>
    (portfolios[index]?.positions ?? []).flatMap((position) => {
      const quote = quotes.get(position.ticker);
      return quote ? [quote] : [];
    }));
  const reconstructed = relevantQuotes.some((quote) => quote.source === "transaction");
  if (reconstructed) missing.push("preços das movimentações");
  if (relevantQuotes.some((quote) =>
    quote.source === "snapshot" && (quote.status === "partial" || quote.date !== date))) {
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
    reconstructed,
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
    reconstructed: false,
    missing: consolidation.complete ? [] : ["dados atuais incompletos"],
  };
}

export function calculateEvolution(inputs: EvolutionInputs): EvolutionPoint[] {
  const liveDate = inputs.stocks.generatedAt.slice(0, 10);
  const recordsByDate = new Map<string, EvolutionHistoryRecord[]>();
  for (const record of inputs.history.records) {
    if (record.kind === "benchmark") continue;
    const items = recordsByDate.get(record.date) ?? [];
    items.push(record);
    recordsByDate.set(record.date, items);
  }

  const transactionRecordsByClass = {
    stocks: transactionQuoteRecords(inputs.stocks, "stocks", "USD", liveDate),
    fiis: transactionQuoteRecords(inputs.fiis, "fiis", "BRL", liveDate),
    crypto: transactionQuoteRecords(inputs.crypto, "crypto", "USD", liveDate),
  } satisfies Record<EvolutionAssetClass, Map<string, EvolutionHistoryRecord[]>>;
  const historicalDates = new Set(recordsByDate.keys());
  for (const records of Object.values(transactionRecordsByClass)) {
    for (const date of records.keys()) historicalDates.add(date);
  }
  for (const investment of inputs.fixedIncome?.investments ?? []) {
    if (investment.purchaseDate <= liveDate) historicalDates.add(investment.purchaseDate);
  }

  const snapshotQuoteHistory: Record<EvolutionAssetClass, Map<string, HistoricalQuote>> = {
    stocks: new Map(),
    fiis: new Map(),
    crypto: new Map(),
  };
  const transactionQuoteHistory: Record<EvolutionAssetClass, Map<string, HistoricalQuote>> = {
    stocks: new Map(),
    fiis: new Map(),
    crypto: new Map(),
  };
  const points: EvolutionPoint[] = [];
  for (const date of [...historicalDates].filter((item) => item < liveDate).sort()) {
    const records = recordsByDate.get(date) ?? [];
    for (const assetClass of ["stocks", "fiis", "crypto"] as const) {
      updateQuoteHistory(
        transactionRecordsByClass[assetClass].get(date) ?? [],
        transactionQuoteHistory,
        "transaction",
      );
    }
    updateQuoteHistory(records, snapshotQuoteHistory, "snapshot");
    const stockQuotes = usableQuotes(
      inputs.stocks,
      date,
      snapshotQuoteHistory.stocks,
      transactionQuoteHistory.stocks,
    );
    const fiiQuotes = usableQuotes(
      inputs.fiis,
      date,
      snapshotQuoteHistory.fiis,
      transactionQuoteHistory.fiis,
    );
    const cryptoQuotes = usableQuotes(
      inputs.crypto,
      date,
      snapshotQuoteHistory.crypto,
      transactionQuoteHistory.crypto,
    );
    const capturedFx = getFxForDate(records);
    const fallbackFx = inputs.brlPerUsd !== null && inputs.brlPerUsd > 0 ? inputs.brlPerUsd : null;
    points.push(recordPoint(
      date,
      portfolioAt(inputs.stocks, date, stockQuotes),
      inputs.fiis ? portfolioAt(inputs.fiis, date, fiiQuotes) : null,
      inputs.crypto ? portfolioAt(inputs.crypto, date, cryptoQuotes) : null,
      activeFixedIncomePrincipal(inputs.fixedIncome, date),
      Boolean(inputs.fixedIncome),
      capturedFx ?? fallbackFx,
      capturedFx === null && fallbackFx !== null,
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
