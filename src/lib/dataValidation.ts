import type { CryptoData, FiiData, FixedIncomeData, PortfolioData } from "../types";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isNullableNumber = (value: unknown) => value === null || isFiniteNumber(value);
const isCount = (value: unknown) => isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
const isIsoDate = (value: unknown) => {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const isIsoDateTime = (value: unknown) => isString(value) && !Number.isNaN(Date.parse(value));
const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string");
const isStringRecord = (value: unknown) => isRecord(value) && Object.values(value).every((item) => typeof item === "string");

function isTransaction(value: unknown) {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && (value.type === "buy" || value.type === "sell")
    && isIsoDate(value.date)
    && isString(value.ticker)
    && isFiniteNumber(value.quantity)
    && value.quantity > 0
    && isFiniteNumber(value.total)
    && value.total >= 0
    && isFiniteNumber(value.unitPrice)
    && value.unitPrice >= 0;
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
    && isFiniteNumber(value.observations)
    && value.observations > 0
    && isString(value.currency);
}

function isAsset(value: unknown) {
  if (!isRecord(value)) return false;
  return isString(value.ticker)
    && isString(value.name)
    && isString(value.sector)
    && isFiniteNumber(value.currentPrice)
    && value.currentPrice >= 0
    && isString(value.exchange)
    && isAnnualStats(value.annual);
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

function invalidData(label: string): never {
  throw new Error(`${label} está em um formato inválido ou contém valores inconsistentes.`);
}

export function parsePortfolioData(value: unknown): PortfolioData {
  if (!hasCommonPortfolioShape(value) || !isRecord(value)) invalidData("A base de ações");
  if (!isRecord(value.source) || !isString(value.source.currentQuotes) || !isString(value.source.annualHistory)) invalidData("A base de ações");
  if (!isRecord(value.integrity) || !isCount(value.integrity.annualRows)) invalidData("A base de ações");
  return value as unknown as PortfolioData;
}

function hasExchangeRate(value: RecordValue) {
  return isRecord(value.exchangeRate)
    && isNullableNumber(value.exchangeRate.brlPerUsd)
    && isString(value.exchangeRate.source);
}

export function parseFiiData(value: unknown): FiiData {
  if (!hasCommonPortfolioShape(value) || !isRecord(value) || !hasExchangeRate(value)) invalidData("A base de FIIs");
  if (!isRecord(value.source) || !isString(value.source.currentQuotes)) invalidData("A base de FIIs");
  return value as unknown as FiiData;
}

export function parseCryptoData(value: unknown): CryptoData {
  if (!hasCommonPortfolioShape(value) || !isRecord(value)) invalidData("A base de cripto");
  if (!isRecord(value.source) || !isString(value.source.currentQuotes)) invalidData("A base de cripto");
  return value as unknown as CryptoData;
}

function isFixedIncomeInvestment(value: unknown) {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isNullableNumber(value.risk)
    && isString(value.type)
    && isString(value.name)
    && typeof value.fgcGuarantee === "boolean"
    && (isFiniteNumber(value.yield) || typeof value.yield === "string")
    && isIsoDate(value.maturityDate)
    && (value.lockupDate === null || isIsoDate(value.lockupDate))
    && isNullableNumber(value.periodMonths)
    && isFiniteNumber(value.investedAmount)
    && value.investedAmount > 0
    && isIsoDate(value.purchaseDate)
    && isNullableNumber(value.grossAmount)
    && isNullableNumber(value.taxAmount)
    && isNullableNumber(value.taxRate)
    && isFiniteNumber(value.netAmount)
    && value.netAmount >= 0
    && isFiniteNumber(value.profit);
}

export function parseFixedIncomeData(value: unknown): FixedIncomeData {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isIsoDateTime(value.generatedAt) || !hasExchangeRate(value)) invalidData("A base de renda fixa");
  if (!isRecord(value.source) || !isString(value.source.spreadsheetId) || !isStringRecord(value.source.ranges)) invalidData("A base de renda fixa");
  if (!Array.isArray(value.investments) || !value.investments.every(isFixedIncomeInvestment)) invalidData("A base de renda fixa");
  if (!isRecord(value.integrity) || !isCount(value.integrity.investmentRows) || !isStringArray(value.integrity.warnings)) invalidData("A base de renda fixa");
  return value as unknown as FixedIncomeData;
}
