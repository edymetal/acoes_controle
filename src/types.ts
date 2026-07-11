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

export interface Position {
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
  currentPrice: number;
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
  buyDistanceBelowAveragePercent: number;
  strongBreakoutAboveHighPercent: number;
}

export interface StrategySignal {
  kind: StrategyKind;
  label: string;
  description: string;
  strength: number;
  distanceToAverage: number | null;
  distanceToHigh: number | null;
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
  warnings: string[];
}
