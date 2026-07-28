import type {
  Asset,
  CryptoData,
  FiiData,
  FixedIncomeData,
  FixedIncomeInvestment,
  PortfolioData,
  Transaction,
} from "../types";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isCount = (value: unknown) => isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
const isPositiveInteger = (value: unknown) => isFiniteNumber(value) && Number.isInteger(value) && value > 0;
const isNonNegativeNumber = (value: unknown): value is number => isFiniteNumber(value) && value >= 0;
const isPositiveNumber = (value: unknown): value is number => isFiniteNumber(value) && value > 0;
const isIsoDate = (value: unknown) => {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isIsoDateTime = (value: unknown) => {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const normalized = value.includes(".")
    ? value.replace(/\.(\d{1,3})Z$/, (_, fraction: string) => `.${fraction.padEnd(3, "0")}Z`)
    : value.replace(/Z$/, ".000Z");
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === normalized;
};
const isTime = (value: unknown) =>
  typeof value === "string"
  && /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value);
const isNormalizedTicker = (value: unknown) =>
  isString(value) && value === value.trim().toUpperCase();
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString);
const isStringRecord = (value: unknown) =>
  isRecord(value)
  && Object.keys(value).length > 0
  && Object.entries(value).every(([key, item]) => isString(key) && isString(item));

function isTransaction(value: unknown) {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && (value.type === "buy" || value.type === "sell")
    && isIsoDate(value.date)
    && (value.time === undefined || isTime(value.time))
    && (value.sourceOrder === undefined || isPositiveInteger(value.sourceOrder))
    && isNormalizedTicker(value.ticker)
    && isPositiveNumber(value.quantity)
    && isNonNegativeNumber(value.total)
    && isNonNegativeNumber(value.unitPrice);
}

function isAnnualStats(value: unknown) {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.min)
    && value.min > 0
    && isFiniteNumber(value.average)
    && value.average > 0
    && isFiniteNumber(value.max)
    && value.max > 0
    && value.min <= value.average
    && value.average <= value.max
    && isPositiveInteger(value.observations)
    && typeof value.currency === "string"
    && /^[A-Z]{3}$/.test(value.currency)
    && (value.asOf === undefined || isIsoDateTime(value.asOf))
    && (value.isFallback === undefined || typeof value.isFallback === "boolean")
    && (value.isFallback !== true || isIsoDateTime(value.asOf));
}

function isAsset(value: unknown) {
  if (!isRecord(value)) return false;
  return isNormalizedTicker(value.ticker)
    && isString(value.name)
    && isString(value.sector)
    && isFiniteNumber(value.currentPrice)
    && value.currentPrice >= 0
    && isString(value.exchange)
    && isAnnualStats(value.annual);
}

function hasUniqueValues(values: Array<string | number>) {
  return new Set(values).size === values.length;
}

function commonPortfolioConsistencyIssue(value: RecordValue) {
  const purchases = value.purchases as Transaction[];
  const sales = value.sales as Transaction[];
  const assets = value.assets as Asset[];
  const integrity = value.integrity as RecordValue;
  const transactions = [...purchases, ...sales];
  const sourceOrders = transactions.flatMap((transaction) =>
    transaction.sourceOrder === undefined ? [] : [transaction.sourceOrder]);

  if (purchases.some((transaction) => transaction.type !== "buy")) return "a lista de compras contém uma venda";
  if (sales.some((transaction) => transaction.type !== "sell")) return "a lista de vendas contém uma compra";
  if (!hasUniqueValues(transactions.map((transaction) => transaction.id))) return "há identificadores de transação duplicados";
  if (!hasUniqueValues(sourceOrders)) return "há ordens de origem duplicadas";
  if (!hasUniqueValues(assets.map((asset) => asset.ticker))) return "há tickers de ativos duplicados";
  if (integrity.purchaseRows !== purchases.length) return "a contagem de compras não corresponde aos registros";
  if (integrity.saleRows !== sales.length) return "a contagem de vendas não corresponde aos registros";
  if (integrity.assetRows !== assets.length) return "a contagem de ativos não corresponde aos registros";
  return null;
}

function hasCommonPortfolioShape(value: unknown) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isIsoDateTime(value.generatedAt)) return false;
  if (!Array.isArray(value.purchases) || !value.purchases.every(isTransaction)) return false;
  if (!Array.isArray(value.sales) || !value.sales.every(isTransaction)) return false;
  if (!Array.isArray(value.assets) || !value.assets.every(isAsset)) return false;
  if (!isRecord(value.source) || !isString(value.source.spreadsheetId) || !isStringRecord(value.source.ranges)) return false;
  if (!isRecord(value.integrity) || !isStringArray(value.integrity.warnings)) return false;
  return isCount(value.integrity.purchaseRows)
    && isCount(value.integrity.saleRows)
    && isCount(value.integrity.assetRows);
}

function invalidData(label: string, detail?: string | null): never {
  const suffix = detail ? ` Detalhe: ${detail}.` : "";
  throw new Error(`${label} está em um formato inválido ou contém valores inconsistentes.${suffix}`);
}

function invalidDataIfPresent(label: string, detail: string | null) {
  if (detail) invalidData(label, detail);
}

export function parsePortfolioData(value: unknown): PortfolioData {
  if (!hasCommonPortfolioShape(value) || !isRecord(value)) invalidData("A base de ações");
  if (!isRecord(value.source) || !isString(value.source.currentQuotes) || !isString(value.source.annualHistory)) invalidData("A base de ações");
  if (!isRecord(value.integrity) || !isCount(value.integrity.annualRows)) invalidData("A base de ações");
  invalidDataIfPresent("A base de ações", commonPortfolioConsistencyIssue(value));
  const annualRows = (value.assets as Asset[]).filter((asset) => asset.annual !== null).length;
  if (value.integrity.annualRows !== annualRows) {
    invalidData("A base de ações", "a contagem de históricos anuais não corresponde aos ativos");
  }
  return value as unknown as PortfolioData;
}

function hasExchangeRate(value: RecordValue) {
  return isRecord(value.exchangeRate)
    && (value.exchangeRate.brlPerUsd === null || isPositiveNumber(value.exchangeRate.brlPerUsd))
    && isString(value.exchangeRate.source);
}

export function parseFiiData(value: unknown): FiiData {
  if (!hasCommonPortfolioShape(value) || !isRecord(value) || !hasExchangeRate(value)) invalidData("A base de FIIs");
  if (!isRecord(value.source) || !isString(value.source.currentQuotes)) invalidData("A base de FIIs");
  invalidDataIfPresent("A base de FIIs", commonPortfolioConsistencyIssue(value));
  return value as unknown as FiiData;
}

export function parseCryptoData(value: unknown): CryptoData {
  if (!hasCommonPortfolioShape(value) || !isRecord(value)) invalidData("A base de cripto");
  if (!isRecord(value.source) || !isString(value.source.currentQuotes)) invalidData("A base de cripto");
  invalidDataIfPresent("A base de cripto", commonPortfolioConsistencyIssue(value));
  return value as unknown as CryptoData;
}

function isFixedIncomeInvestment(value: unknown) {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && (value.risk === null || isNonNegativeNumber(value.risk))
    && isString(value.type)
    && isString(value.name)
    && typeof value.fgcGuarantee === "boolean"
    && (isNonNegativeNumber(value.yield) || isString(value.yield))
    && isIsoDate(value.maturityDate)
    && (value.lockupDate === null || isIsoDate(value.lockupDate))
    && (value.periodMonths === null || isPositiveNumber(value.periodMonths))
    && isPositiveNumber(value.investedAmount)
    && isIsoDate(value.purchaseDate)
    && (value.grossAmount === null || isNonNegativeNumber(value.grossAmount))
    && (value.taxAmount === null || isNonNegativeNumber(value.taxAmount))
    && (value.taxRate === null || (isNonNegativeNumber(value.taxRate) && value.taxRate <= 1))
    && isNonNegativeNumber(value.netAmount)
    && isFiniteNumber(value.profit);
}

function amountsMatch(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(0.02, Math.max(Math.abs(left), Math.abs(right)) * 1e-9);
}

function fixedIncomeConsistencyIssue(investments: FixedIncomeInvestment[]) {
  if (!hasUniqueValues(investments.map((investment) => investment.id))) return "há identificadores de investimentos duplicados";
  for (const investment of investments) {
    if (investment.purchaseDate > investment.maturityDate) return `a compra de ${investment.id} ocorre após o vencimento`;
    if (investment.lockupDate !== null && investment.lockupDate < investment.purchaseDate) {
      return `a carência de ${investment.id} ocorre antes da compra`;
    }
    if (!amountsMatch(investment.netAmount, investment.investedAmount + investment.profit)) {
      return `o valor líquido de ${investment.id} não corresponde ao principal mais o resultado`;
    }
    if (investment.grossAmount !== null && investment.grossAmount < investment.netAmount) {
      return `o valor bruto de ${investment.id} é menor que o valor líquido`;
    }
    if (investment.grossAmount !== null && investment.taxAmount !== null
      && !amountsMatch(investment.netAmount, investment.grossAmount - investment.taxAmount)) {
      return `o valor líquido de ${investment.id} não corresponde ao bruto menos o imposto`;
    }
  }
  return null;
}

export function parseFixedIncomeData(value: unknown): FixedIncomeData {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isIsoDateTime(value.generatedAt) || !hasExchangeRate(value)) invalidData("A base de renda fixa");
  if (!isRecord(value.source) || !isString(value.source.spreadsheetId) || !isStringRecord(value.source.ranges)) invalidData("A base de renda fixa");
  if (!Array.isArray(value.investments) || !value.investments.every(isFixedIncomeInvestment)) invalidData("A base de renda fixa");
  if (!isRecord(value.integrity) || !isCount(value.integrity.investmentRows) || !isStringArray(value.integrity.warnings)) invalidData("A base de renda fixa");
  const investments = value.investments as FixedIncomeInvestment[];
  if (value.integrity.investmentRows !== investments.length) {
    invalidData("A base de renda fixa", "a contagem de investimentos não corresponde aos registros");
  }
  invalidDataIfPresent("A base de renda fixa", fixedIncomeConsistencyIssue(investments));
  return value as unknown as FixedIncomeData;
}
