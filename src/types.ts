export type TransactionType = "buy" | "sell";

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  ticker: string;
  quantity: number;
  total: number;
  unitPrice: number;
}

export interface ProcessedTransaction extends Transaction {
  costBasis: number | null;
  realizedProfit: number | null;
}

export interface AnnualStats {
  min: number;
  average: number;
  max: number;
  observations: number;
  currency: string;
  asOf?: string;
  isFallback?: boolean;
}

export interface Asset {
  ticker: string;
  name: string;
  sector: string;
  currentPrice: number;
  exchange: string;
  annual: AnnualStats | null;
}

export interface PortfolioData {
  schemaVersion: number;
  generatedAt: string;
  source: {
    spreadsheetId: string;
    ranges: Record<string, string>;
    currentQuotes: string;
    annualHistory: string;
  };
  purchases: Transaction[];
  sales: Transaction[];
  assets: Asset[];
  integrity: {
    purchaseRows: number;
    saleRows: number;
    assetRows: number;
    annualRows: number;
    warnings: string[];
  };
}

export interface FiiData {
  schemaVersion: number;
  generatedAt: string;
  source: {
    spreadsheetId: string;
    ranges: Record<string, string>;
    currentQuotes: string;
  };
  exchangeRate: {
    brlPerUsd: number | null;
    source: string;
  };
  purchases: Transaction[];
  sales: Transaction[];
  assets: Asset[];
  integrity: {
    purchaseRows: number;
    saleRows: number;
    assetRows: number;
    warnings: string[];
  };
}

export interface CryptoData {
  schemaVersion: number;
  generatedAt: string;
  source: {
    spreadsheetId: string;
    ranges: Record<string, string>;
    currentQuotes: string;
  };
  purchases: Transaction[];
  sales: Transaction[];
  assets: Asset[];
  integrity: {
    purchaseRows: number;
    saleRows: number;
    assetRows: number;
    warnings: string[];
  };
}

export interface FixedIncomeInvestment {
  id: string;
  risk: number | null;
  type: string;
  name: string;
  fgcGuarantee: boolean;
  yield: number | string;
  maturityDate: string;
  lockupDate: string | null;
  periodMonths: number | null;
  investedAmount: number;
  purchaseDate: string;
  grossAmount: number | null;
  taxAmount: number | null;
  taxRate: number | null;
  netAmount: number;
  profit: number;
}

export interface FixedIncomeData {
  schemaVersion: number;
  generatedAt: string;
  source: {
    spreadsheetId: string;
    ranges: Record<string, string>;
  };
  exchangeRate: {
    brlPerUsd: number | null;
    source: string;
  };
  investments: FixedIncomeInvestment[];
  integrity: {
    investmentRows: number;
    warnings: string[];
  };
}

export interface FixedIncomeMonth {
  month: number;
  label: string;
  shortLabel: string;
  investments: FixedIncomeInvestment[];
  amountToReceive: number;
  profit: number;
  covered: boolean;
}

export interface FixedIncomeMetrics {
  investedAmount: number;
  grossAmount: number;
  netAmount: number;
  profit: number;
  returnRate: number;
  assetCount: number;
  coveredMonths: number;
  missingMonths: number;
}

export interface FixedIncomeYear {
  year: number;
  investments: FixedIncomeInvestment[];
  months: FixedIncomeMonth[];
  metrics: FixedIncomeMetrics;
}

export interface FixedIncomeModel {
  referenceYear: number;
  investments: FixedIncomeInvestment[];
  years: FixedIncomeYear[];
  metrics: FixedIncomeMetrics;
  warnings: string[];
}

export interface Position {
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
  currentPrice: number;
  quoteAvailable: boolean;
  marketValue: number;
  unrealized: number;
  unrealizedPercent: number;
  realized: number;
  allocation: number;
  annual: AnnualStats | null;
}

export type StrategyKind = "buy" | "sell" | "breakout" | "neutral" | "unavailable";

export interface StrategySettings {
  sellDistanceFromHighPercent: number;
  initialSellPercent: number;
  breakoutSellPercent: number;
  minimumSaleAmount: number;
  buyZoneUpperPercent: number;
  buyZoneMiddlePercent: number;
  buyZoneLowerPercent: number;
  moderateBuyAmount: number;
  strongBuyAmount: number;
  breakdownBuyAmount: number;
  minimumPositionValue: number;
  maximumPositionValue: number;
}

export interface StrategySignal {
  kind: StrategyKind;
  label: string;
  description: string;
  strength: number;
  distanceToAverage: number | null;
  distanceToHigh: number | null;
  rangePositionPercent: number | null;
  positionValue: number;
  positionCost: number;
  targetPositionValue: number | null;
  actionAmount: number;
  remainingToTarget: number;
  remainingToMaximum: number;
  actionPercent: number | null;
}

export interface PortfolioModel {
  positions: Position[];
  transactions: ProcessedTransaction[];
  metrics: {
    historicalPurchases: number;
    historicalSales: number;
    openCost: number;
    marketValue: number;
    realizedProfit: number;
    unrealizedProfit: number;
    totalProfit: number;
    openReturn: number;
    totalReturnOnPurchases: number;
    openPositions: number;
    assetCount: number;
  };
  health: {
    valuation: "complete" | "partial";
    missingQuoteTickers: string[];
    staleAnnualTickers: string[];
    staleAnnualAsOf: string | null;
  };
  warnings: string[];
}
