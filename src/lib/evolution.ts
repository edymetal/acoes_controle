import type {
  CryptoData,
  EvolutionAssetClass,
  EvolutionCurrency,
  EvolutionHistoryData,
  EvolutionHistoryRecord,
  EvolutionPoint,
  FiiData,
  FixedIncomeData,
  PortfolioData,
  Transaction,
} from "../types";

const MILLISECONDS_PER_DAY = 86_400_000;
const EPSILON = 0.0000001;

type MarketData = PortfolioData | FiiData | CryptoData;
type CurrencyCapital = { usd: number; brl: number; conversionAvailable: boolean };
type RateAtDate = (date: string) => { value: number | null; estimated: boolean };
type InvestedPosition = {
  quantity: number;
  usdCost: number;
  brlCost: number;
  conversionAvailable: boolean;
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

export interface EvolutionCalendarMonth {
  year: number;
  month: number;
  invested: number | null;
  investmentCount: number;
  capital: number | null;
  closingDate: string | null;
  complete: boolean;
  reconstructed: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

export type EvolutionContributionClass = EvolutionAssetClass | "fixedIncome";

export interface EvolutionMonthContribution {
  id: string;
  date: string;
  assetClass: EvolutionContributionClass;
  title: string;
  subtitle: string;
  quantity: number | null;
  unitPrice: number | null;
  nativeCurrency: EvolutionCurrency;
  nativeValue: number;
  currency: EvolutionCurrency;
  value: number | null;
}

type EvolutionCalendarInputs = Pick<
  EvolutionInputs,
  "stocks" | "fiis" | "crypto" | "fixedIncome" | "brlPerUsd"
>;

function contributionRecords(inputs: EvolutionCalendarInputs) {
  return [
    ...inputs.stocks.purchases.map((item) => ({
      id: `stocks:${item.id}`,
      date: item.date,
      value: item.total,
      currency: "USD" as const,
      assetClass: "stocks" as const,
      title: item.ticker,
      subtitle: inputs.stocks.assets.find((asset) => asset.ticker === item.ticker)?.name ?? item.ticker,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    ...(inputs.fiis?.purchases ?? []).map((item) => ({
      id: `fiis:${item.id}`,
      date: item.date,
      value: item.total,
      currency: "BRL" as const,
      assetClass: "fiis" as const,
      title: item.ticker,
      subtitle: inputs.fiis?.assets.find((asset) => asset.ticker === item.ticker)?.name ?? item.ticker,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    ...(inputs.crypto?.purchases ?? []).map((item) => ({
      id: `crypto:${item.id}`,
      date: item.date,
      value: item.total,
      currency: "USD" as const,
      assetClass: "crypto" as const,
      title: item.ticker,
      subtitle: inputs.crypto?.assets.find((asset) => asset.ticker === item.ticker)?.name ?? item.ticker,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    ...(inputs.fixedIncome?.investments ?? []).map((item) => ({
      id: `fixedIncome:${item.id}`,
      date: item.purchaseDate,
      value: item.investedAmount,
      currency: "BRL" as const,
      assetClass: "fixedIncome" as const,
      title: item.name,
      subtitle: item.type,
      quantity: null,
      unitPrice: null,
    })),
  ];
}

function rateAtDate(points: EvolutionPoint[], date: string, fallback: number | null) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point.date <= date && point.brlPerUsd && point.brlPerUsd > 0) return point.brlPerUsd;
  }
  return fallback && fallback > 0 ? fallback : null;
}

function contributionInCurrency(
  value: number,
  nativeCurrency: EvolutionCurrency,
  currency: EvolutionCurrency,
  rate: number | null,
) {
  if (nativeCurrency === currency) return value;
  if (!rate) return null;
  return nativeCurrency === "USD" ? value * rate : value / rate;
}

export function getEvolutionMonthContributions(
  points: EvolutionPoint[],
  inputs: EvolutionCalendarInputs,
  year: number,
  month: number,
  currency: EvolutionCurrency,
): EvolutionMonthContribution[] {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  return contributionRecords(inputs)
    .filter((item) => item.date.startsWith(monthKey))
    .map((item) => ({
      id: item.id,
      date: item.date,
      assetClass: item.assetClass,
      title: item.title,
      subtitle: item.subtitle,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      nativeCurrency: item.currency,
      nativeValue: item.value,
      currency,
      value: contributionInCurrency(
        item.value,
        item.currency,
        currency,
        rateAtDate(points, item.date, inputs.brlPerUsd),
      ),
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

export function getEvolutionCalendarYears(
  points: EvolutionPoint[],
  inputs: EvolutionCalendarInputs,
) {
  const referenceDate = points.at(-1)?.date ?? inputs.stocks.generatedAt.slice(0, 10);
  const referenceYear = Number(referenceDate.slice(0, 4));
  const years = [
    ...points.map((point) => Number(point.date.slice(0, 4))),
    ...contributionRecords(inputs).map((item) => Number(item.date.slice(0, 4))),
  ].filter((year) => Number.isInteger(year) && year <= referenceYear);
  const firstYear = years.length > 0 ? Math.min(...years) : referenceYear;
  return Array.from({ length: referenceYear - firstYear + 1 }, (_, index) => firstYear + index);
}

export function buildEvolutionCalendar(
  points: EvolutionPoint[],
  inputs: EvolutionCalendarInputs,
  year: number,
  currency: EvolutionCurrency,
): EvolutionCalendarMonth[] {
  const referenceDate = points.at(-1)?.date ?? inputs.stocks.generatedAt.slice(0, 10);
  const referenceMonth = referenceDate.slice(0, 7);
  const contributions = contributionRecords(inputs);

  return Array.from({ length: 12 }, (_, month) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const isFuture = monthKey > referenceMonth;
    const monthContributions = contributions.filter((item) => item.date.startsWith(monthKey));
    let invested = 0;
    let conversionAvailable = true;
    for (const contribution of monthContributions) {
      const converted = contributionInCurrency(
        contribution.value,
        contribution.currency,
        currency,
        rateAtDate(points, contribution.date, inputs.brlPerUsd),
      );
      if (converted === null) {
        conversionAvailable = false;
      } else {
        invested += converted;
      }
    }
    const closingPoint = isFuture
      ? null
      : points.filter((point) => point.date.startsWith(monthKey)).at(-1) ?? null;

    return {
      year,
      month,
      invested: conversionAvailable ? invested : null,
      investmentCount: monthContributions.length,
      capital: closingPoint
        ? currency === "USD" ? closingPoint.totalUsd : closingPoint.totalBrl
        : null,
      closingDate: closingPoint?.date ?? null,
      complete: closingPoint?.complete ?? false,
      reconstructed: closingPoint?.reconstructed ?? false,
      isCurrent: monthKey === referenceMonth,
      isFuture,
    };
  });
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

function buildRateAtDate(inputs: EvolutionInputs): RateAtDate {
  const liveDate = inputs.stocks.generatedAt.slice(0, 10);
  const fallback = inputs.brlPerUsd !== null && inputs.brlPerUsd > 0 ? inputs.brlPerUsd : null;
  const historicalRates = inputs.history.records
    .filter((record) => record.kind === "fx" && record.symbol === "USD-BRL")
    .sort((left, right) => left.date.localeCompare(right.date)
      || left.capturedAt.localeCompare(right.capturedAt));
  const ratesByDate = new Map<string, { value: number | null; estimated: boolean }>();

  return (date) => {
    const cached = ratesByDate.get(date);
    if (cached) return cached;
    if (date === liveDate && fallback) {
      const current = { value: fallback, estimated: false };
      ratesByDate.set(date, current);
      return current;
    }

    let lower = 0;
    let upper = historicalRates.length - 1;
    let captured: number | null = null;
    while (lower <= upper) {
      const middle = Math.floor((lower + upper) / 2);
      const record = historicalRates[middle];
      if (record.date <= date) {
        captured = record.value;
        lower = middle + 1;
      } else {
        upper = middle - 1;
      }
    }

    const resolved = captured && captured > 0
      ? { value: captured, estimated: false }
      : { value: fallback, estimated: fallback !== null };
    ratesByDate.set(date, resolved);
    return resolved;
  };
}

function transactionCapitalAt(
  data: MarketData,
  date: string,
  nativeCurrency: EvolutionCurrency,
  rateAtDate: RateAtDate,
): CurrencyCapital {
  const positions = new Map<string, InvestedPosition>();
  const transactions = [...data.purchases, ...data.sales]
    .filter((transaction) => transaction.date <= date)
    .sort(compareTransactions);

  for (const transaction of transactions) {
    const position = positions.get(transaction.ticker) ?? {
      quantity: 0,
      usdCost: 0,
      brlCost: 0,
      conversionAvailable: true,
    };

    if (transaction.type === "buy") {
      const rate = rateAtDate(transaction.date).value;
      position.quantity += transaction.quantity;
      if (nativeCurrency === "USD") {
        position.usdCost += transaction.total;
        if (rate) position.brlCost += transaction.total * rate;
      } else {
        position.brlCost += transaction.total;
        if (rate) position.usdCost += transaction.total / rate;
      }
      if (!rate) position.conversionAvailable = false;
      positions.set(transaction.ticker, position);
      continue;
    }

    if (position.quantity <= EPSILON) continue;
    const matchedQuantity = Math.min(position.quantity, transaction.quantity);
    const remainingRatio = Math.max(0, (position.quantity - matchedQuantity) / position.quantity);
    position.quantity -= matchedQuantity;
    position.usdCost *= remainingRatio;
    position.brlCost *= remainingRatio;
    if (position.quantity <= EPSILON) {
      position.quantity = 0;
      position.usdCost = 0;
      position.brlCost = 0;
      position.conversionAvailable = true;
    }
    positions.set(transaction.ticker, position);
  }

  return [...positions.values()].reduce<CurrencyCapital>((capital, position) => ({
    usd: capital.usd + position.usdCost,
    brl: capital.brl + position.brlCost,
    conversionAvailable: capital.conversionAvailable && position.conversionAvailable,
  }), { usd: 0, brl: 0, conversionAvailable: true });
}

function fixedIncomeCapitalAt(
  data: FixedIncomeData,
  date: string,
  rateAtDate: RateAtDate,
): CurrencyCapital {
  return data.investments
    .filter((investment) => investment.purchaseDate <= date && investment.maturityDate >= date)
    .reduce<CurrencyCapital>((capital, investment) => {
      const rate = rateAtDate(investment.purchaseDate).value;
      return {
        usd: capital.usd + (rate ? investment.investedAmount / rate : 0),
        brl: capital.brl + investment.investedAmount,
        conversionAvailable: capital.conversionAvailable && rate !== null,
      };
    }, { usd: 0, brl: 0, conversionAvailable: true });
}

function emptyCapital(): CurrencyCapital {
  return { usd: 0, brl: 0, conversionAvailable: true };
}

function buildInvestedPoint(
  inputs: EvolutionInputs,
  date: string,
  records: EvolutionHistoryRecord[],
  rateAtDate: RateAtDate,
  isLive: boolean,
  reconstructed: boolean,
): EvolutionPoint {
  const stocks = transactionCapitalAt(inputs.stocks, date, "USD", rateAtDate);
  const fiis = inputs.fiis ? transactionCapitalAt(inputs.fiis, date, "BRL", rateAtDate) : emptyCapital();
  const crypto = inputs.crypto ? transactionCapitalAt(inputs.crypto, date, "USD", rateAtDate) : emptyCapital();
  const fixedIncome = inputs.fixedIncome ? fixedIncomeCapitalAt(inputs.fixedIncome, date, rateAtDate) : emptyCapital();
  const rate = rateAtDate(date);
  const missing: string[] = [];

  if (!inputs.fiis) missing.push("FIIs");
  if (!inputs.crypto) missing.push("cripto");
  if (!inputs.fixedIncome) missing.push("renda fixa");
  if (!rate.value) missing.push("câmbio");
  if (![stocks, fiis, crypto, fixedIncome].every((capital) => capital.conversionAvailable)) {
    missing.push("câmbio das movimentações");
  }
  if (rate.estimated) missing.push("câmbio atual estimado");
  if (records.some((record) => record.kind === "fx" && record.status === "partial")) {
    missing.push("captura parcial");
  }

  return {
    date,
    stocksUsd: stocks.usd,
    stocksBrl: stocks.brl,
    fiisUsd: fiis.usd,
    fiisBrl: fiis.brl,
    cryptoUsd: crypto.usd,
    cryptoBrl: crypto.brl,
    fixedIncomeUsd: fixedIncome.usd,
    fixedIncomeBrl: fixedIncome.brl,
    brlPerUsd: rate.value,
    totalUsd: stocks.usd + fiis.usd + crypto.usd + fixedIncome.usd,
    totalBrl: stocks.brl + fiis.brl + crypto.brl + fixedIncome.brl,
    complete: missing.length === 0,
    isLive,
    reconstructed,
    missing: [...new Set(missing)],
  };
}

function nextIsoDate(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
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

  const historicalDates = new Set(recordsByDate.keys());
  for (const data of [inputs.stocks, inputs.fiis, inputs.crypto]) {
    for (const transaction of [...(data?.purchases ?? []), ...(data?.sales ?? [])]) {
      if (transaction.date <= liveDate) historicalDates.add(transaction.date);
    }
  }
  for (const investment of inputs.fixedIncome?.investments ?? []) {
    if (investment.purchaseDate <= liveDate) historicalDates.add(investment.purchaseDate);
    const redemptionDate = nextIsoDate(investment.maturityDate);
    if (redemptionDate <= liveDate) historicalDates.add(redemptionDate);
  }

  const rateAtDate = buildRateAtDate(inputs);
  const points: EvolutionPoint[] = [];
  for (const date of [...historicalDates].filter((item) => item < liveDate).sort()) {
    const records = recordsByDate.get(date) ?? [];
    points.push(buildInvestedPoint(inputs, date, records, rateAtDate, false, records.length === 0));
  }

  const livePoint = buildInvestedPoint(
    inputs,
    liveDate,
    recordsByDate.get(liveDate) ?? [],
    rateAtDate,
    true,
    false,
  );
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
