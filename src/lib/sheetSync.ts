import type {
  AnnualStats,
  Asset,
  CryptoData,
  FiiData,
  FixedIncomeData,
  FixedIncomeInvestment,
  PortfolioData,
  Transaction,
} from "../types";
import { fetchWithRetry } from "./fetchRetry";

const SPREADSHEET_ID = "1cdPXA3O0DoSfOILOpc7GZjWHI7tHnhgRH9aMXdU-_F0";
const RANGES = {
  purchases: "'Ações Hist'!F25:J1000",
  sales: "'Ações Hist'!AJ25:AM1000",
  assets: "'Ações Base'!H12:Q1000",
};
const FII_RANGES = {
  purchases: "'FII Hist'!F24:I1000",
  sales: "'FII Hist'!AJ85:AN1000",
  assets: "'FII BASE'!A16:G1000",
  usdRate: "'Dólar'!G5",
};
const CRYPTO_RANGES = {
  transactions: "'Cripto'!A1:L1000",
  assets: "'Cripto Base'!D2:E5",
};
const FIXED_INCOME_RANGES = {
  investments: "'Fixa Hist'!B36:Q1000",
  usdRate: "'Dólar'!G5",
};
const ALL_RANGES = [
  ...Object.values(RANGES),
  ...Object.values(FII_RANGES),
  ...Object.values(CRYPTO_RANGES),
  ...Object.values(FIXED_INCOME_RANGES),
];
const CRYPTO_BY_NAME = new Map([
  ["BITCOIN", { ticker: "BTC", name: "Bitcoin" }],
  ["ETHEREUM", { ticker: "ETH", name: "Ethereum" }],
  ["BNB", { ticker: "BNB", name: "BNB" }],
  ["BINANCE COIN", { ticker: "BNB", name: "BNB" }],
]);
const SUPPORTED_CRYPTO_TICKERS = new Set([...CRYPTO_BY_NAME.values()].map((asset) => asset.ticker));

type SheetCell = string | number | boolean | null;
type SheetRow = SheetCell[];
interface ValueRange { values?: SheetRow[] }
interface BatchGetResponse { valueRanges?: ValueRange[] }

export interface SpreadsheetSyncResult {
  portfolio: PortfolioData;
  fiis: FiiData;
  crypto: CryptoData;
  fixedIncome: FixedIncomeData;
}

function excelSerialToSheetDate(serial: unknown) {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const wholeDays = Math.floor(serial);
  const seconds = Math.round((serial - wholeDays) * 86_400);
  const secondsWithinDay = seconds % 86_400;
  const timestamp = new Date(excelEpoch + wholeDays * 86_400_000 + seconds * 1_000)
    .toISOString();
  return {
    date: timestamp.slice(0, 10),
    time: secondsWithinDay > 0 ? timestamp.slice(11, 19) : undefined,
  };
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ticker(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mapPurchases(rows: SheetRow[], warnings: string[]): Transaction[] {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const sheetDate = excelSerialToSheetDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const total = numeric(row[3]);
    const sheetUnitPrice = numeric(row[4]);
    if (!sheetDate || !symbol || quantity === null || quantity <= 0 || total === null || total < 0) {
      warnings.push(`Compra inválida na linha ${index + 25}.`);
      return [];
    }
    return [{
      id: `buy-${index + 25}`,
      type: "buy" as const,
      ...sheetDate,
      ticker: symbol,
      quantity,
      total,
      unitPrice: sheetUnitPrice ?? total / quantity,
    }];
  });
}

function mapSales(rows: SheetRow[], warnings: string[]): Transaction[] {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const sheetDate = excelSerialToSheetDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const total = numeric(row[3]);
    if (!sheetDate || !symbol || quantity === null || quantity <= 0 || total === null || total < 0) {
      warnings.push(`Venda inválida na linha ${index + 25}.`);
      return [];
    }
    return [{
      id: `sell-${index + 25}`,
      type: "sell" as const,
      ...sheetDate,
      ticker: symbol,
      quantity,
      total,
      unitPrice: total / quantity,
    }];
  });
}

function mapAssets(
  rows: SheetRow[],
  warnings: string[],
  previousAnnualByTicker: Map<string, AnnualStats>,
  generatedAt: string,
): Asset[] {
  const seen = new Set<string>();
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    const symbol = ticker(row[0]);
    const currentPrice = numeric(row[5]);
    const annualMin = numeric(row[6]);
    const annualAverage = numeric(row[7]);
    const annualMax = numeric(row[8]);
    if (!symbol && text(row[6]).toUpperCase() === "MINIMO") return [];
    if (!symbol || currentPrice === null || currentPrice < 0) {
      warnings.push(`Ativo inválido na linha ${index + 12} da aba Ações Base.`);
      return [];
    }
    if (seen.has(symbol)) {
      warnings.push(`Ticker duplicado na base: ${symbol}.`);
      return [];
    }
    seen.add(symbol);
    const hasAnnualStats = annualMin !== null
      && annualMin > 0
      && annualAverage !== null
      && annualAverage > 0
      && annualMax !== null
      && annualMax > 0
      && annualMin <= annualAverage
      && annualAverage <= annualMax;
    const previousAnnual = previousAnnualByTicker.get(symbol) ?? null;
    if (!hasAnnualStats) warnings.push(previousAnnual
      ? `Preços anuais indisponíveis para ${symbol}; mantidos os últimos valores válidos.`
      : `Preços anuais inválidos para ${symbol} na linha ${index + 12} da aba Ações Base.`);
    return [{
      ticker: symbol,
      name: text(row[1]) || symbol,
      sector: text(row[3]) || "Não informado",
      currentPrice,
      exchange: text(row[9]) || "Não informada",
      annual: hasAnnualStats ? {
        min: annualMin,
        average: annualAverage,
        max: annualMax,
        observations: 365,
        currency: "USD",
        asOf: generatedAt,
        isFallback: false,
      } : previousAnnual ? { ...previousAnnual, isFallback: true } : null,
    }];
  });
}

function mapFiiPurchases(rows: SheetRow[], warnings: string[]): Transaction[] {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const sheetDate = excelSerialToSheetDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const unitPrice = numeric(row[3]);
    if ((!symbol && !sheetDate) || (quantity === null && unitPrice === null) || (quantity === 0 && unitPrice === 0)) return [];
    if (!sheetDate || !symbol || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0) {
      warnings.push(`Compra de FII inválida na linha ${index + 24}.`);
      return [];
    }
    return [{
      id: `fii-buy-${index + 24}`,
      type: "buy" as const,
      ...sheetDate,
      ticker: symbol,
      quantity,
      total: quantity * unitPrice,
      unitPrice,
    }];
  });
}

function mapFiiSales(rows: SheetRow[], warnings: string[]): Transaction[] {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const sheetDate = excelSerialToSheetDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const unitPrice = numeric(row[3]);
    const sheetTotal = numeric(row[4]);
    if ((!symbol && !sheetDate) || (quantity === 0 && unitPrice === 0 && sheetTotal === 0)) return [];
    if (!sheetDate || !symbol || quantity === null || quantity <= 0 || (unitPrice === null && sheetTotal === null)) {
      warnings.push(`Venda de FII inválida na linha ${index + 85}.`);
      return [];
    }
    const total = sheetTotal ?? quantity * (unitPrice ?? 0);
    if (total < 0) {
      warnings.push(`Venda de FII inválida na linha ${index + 85}.`);
      return [];
    }
    return [{
      id: `fii-sell-${index + 85}`,
      type: "sell" as const,
      ...sheetDate,
      ticker: symbol,
      quantity,
      total,
      unitPrice: unitPrice ?? total / quantity,
    }];
  });
}

function mapFiiAssets(rows: SheetRow[], warnings: string[]): Asset[] {
  const seen = new Set<string>();
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    const symbol = ticker(row[0]);
    const currentPrice = numeric(row[6]);
    if (text(row[0]).toUpperCase() === "CODIGO") return [];
    if (!symbol && currentPrice === null) return [];
    if (!symbol || currentPrice === null || currentPrice < 0) {
      warnings.push(`FII inválido na linha ${index + 16} da aba FII BASE.`);
      return [];
    }
    if (seen.has(symbol)) {
      warnings.push(`FII duplicado na base: ${symbol}.`);
      return [];
    }
    seen.add(symbol);
    return [{
      ticker: symbol,
      name: text(row[1]) || symbol,
      sector: text(row[4]) || "Não informado",
      currentPrice,
      exchange: "B3",
      annual: null,
    }];
  });
}

function mapCryptoTransactions(rows: SheetRow[], warnings: string[]) {
  const purchases: Transaction[] = [];
  const sales: Transaction[] = [];
  rows.forEach((row, index) => {
    if (!row?.length) return;
    const symbol = ticker(row[4]);
    if (!SUPPORTED_CRYPTO_TICKERS.has(symbol)) return;
    const rawType = text(row[0]).toUpperCase();
    const type = rawType === "COMPRA" ? "buy" : rawType === "VENDA" ? "sell" : null;
    const sheetDate = excelSerialToSheetDate(row[1]);
    const quantity = numeric(row[5]);
    const unitPrice = numeric(row[6]);
    if (!type || !sheetDate || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0) {
      warnings.push(`Movimentação de cripto inválida na linha ${index + 1} da aba Cripto.`);
      return;
    }
    const transaction: Transaction = {
      id: `crypto-${type}-${index + 1}`,
      type,
      ...sheetDate,
      sourceOrder: index + 1,
      ticker: symbol,
      quantity,
      total: quantity * unitPrice,
      unitPrice,
    };
    (type === "buy" ? purchases : sales).push(transaction);
  });
  return { purchases, sales };
}

function mapCryptoAssets(rows: SheetRow[], warnings: string[]): Asset[] {
  const seen = new Set<string>();
  const assets = rows.flatMap((row, index) => {
    if (!row?.length) return [];
    const crypto = CRYPTO_BY_NAME.get(text(row[0]).toUpperCase());
    if (!crypto) return [];
    const currentPrice = numeric(row[1]);
    if (currentPrice === null || currentPrice < 0) {
      warnings.push(`Cotação inválida para ${crypto.name} na linha ${index + 2} da aba Cripto Base.`);
      return [];
    }
    if (seen.has(crypto.ticker)) {
      warnings.push(`Cripto duplicada na base: ${crypto.ticker}.`);
      return [];
    }
    seen.add(crypto.ticker);
    return [{
      ticker: crypto.ticker,
      name: crypto.name,
      sector: "Criptomoeda",
      currentPrice,
      exchange: "Mercado cripto",
      annual: null,
    }];
  });
  for (const crypto of new Map([...CRYPTO_BY_NAME.values()].map((item) => [item.ticker, item])).values()) {
    if (!seen.has(crypto.ticker)) warnings.push(`Cotação não encontrada para ${crypto.name} na aba Cripto Base.`);
  }
  return assets;
}

function mapFixedIncomeInvestments(rows: SheetRow[], warnings: string[]): FixedIncomeInvestment[] {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "RISCO" && text(row[1]).toUpperCase() === "TIPO") return [];
    const risk = numeric(row[0]);
    const type = text(row[1]);
    const name = text(row[2]);
    const maturityDate = excelSerialToSheetDate(row[6])?.date ?? null;
    const lockupDate = excelSerialToSheetDate(row[7])?.date ?? null;
    const periodMonths = numeric(row[8]);
    const investedAmount = numeric(row[9]);
    const purchaseDate = excelSerialToSheetDate(row[10])?.date ?? null;
    const grossAmount = numeric(row[11]);
    const taxAmount = numeric(row[12]);
    const taxRate = numeric(row[13]);
    const netAmount = numeric(row[14]);
    const profit = numeric(row[15]);
    if (!type && !name && investedAmount === null && !maturityDate) return [];
    if (!type || !name || !maturityDate || !purchaseDate || investedAmount === null || investedAmount <= 0
      || netAmount === null || netAmount < 0 || profit === null) {
      warnings.push(`Ativo de renda fixa inválido na linha ${index + 36} da aba Fixa Hist.`);
      return [];
    }
    const rawYield = row[5];
    return [{
      id: `fixed-income-${index + 36}`,
      risk,
      type,
      name,
      fgcGuarantee: /^sim$/i.test(text(row[4])),
      yield: typeof rawYield === "number" && Number.isFinite(rawYield) ? rawYield : text(rawYield),
      maturityDate,
      lockupDate,
      periodMonths,
      investedAmount,
      purchaseDate,
      grossAmount,
      taxAmount,
      taxRate,
      netAmount,
      profit,
    }];
  });
}

export function buildSpreadsheetData(
  valueRanges: ValueRange[],
  previousPortfolio: PortfolioData | null = null,
  generatedAt = new Date().toISOString(),
): SpreadsheetSyncResult {
  if (valueRanges.length < ALL_RANGES.length) throw new Error("A resposta da planilha está incompleta.");
  const [purchaseRange, saleRange, assetRange, fiiPurchaseRange, fiiSaleRange, fiiAssetRange, usdRateRange,
    cryptoTransactionRange, cryptoAssetRange, fixedIncomeRange, fixedIncomeUsdRateRange] = valueRanges;
  const previousAnnualByTicker = new Map(
    (previousPortfolio?.assets ?? []).flatMap((asset) => asset.annual ? [[asset.ticker, {
      ...asset.annual,
      asOf: asset.annual.asOf ?? previousPortfolio?.generatedAt,
    }] as const] : []),
  );

  const warnings: string[] = [];
  const purchases = mapPurchases(purchaseRange?.values ?? [], warnings);
  const sales = mapSales(saleRange?.values ?? [], warnings);
  const assets = mapAssets(assetRange?.values ?? [], warnings, previousAnnualByTicker, generatedAt);

  const fiiWarnings: string[] = [];
  const fiiPurchases = mapFiiPurchases(fiiPurchaseRange?.values ?? [], fiiWarnings);
  const fiiSales = mapFiiSales(fiiSaleRange?.values ?? [], fiiWarnings);
  const fiiAssets = mapFiiAssets(fiiAssetRange?.values ?? [], fiiWarnings);
  const brlPerUsd = numeric(usdRateRange?.values?.[0]?.[0]);
  if (brlPerUsd === null || brlPerUsd <= 0) fiiWarnings.push("Cotação do dólar inválida na célula Dólar!G5.");

  const cryptoWarnings: string[] = [];
  const cryptoTransactions = mapCryptoTransactions(cryptoTransactionRange?.values ?? [], cryptoWarnings);
  const cryptoAssets = mapCryptoAssets(cryptoAssetRange?.values ?? [], cryptoWarnings);

  const fixedIncomeWarnings: string[] = [];
  const fixedIncomeInvestments = mapFixedIncomeInvestments(fixedIncomeRange?.values ?? [], fixedIncomeWarnings);
  const fixedIncomeBrlPerUsd = numeric(fixedIncomeUsdRateRange?.values?.[0]?.[0]);
  if (fixedIncomeBrlPerUsd === null || fixedIncomeBrlPerUsd <= 0) fixedIncomeWarnings.push("Cotação do dólar inválida na célula Dólar!G5.");

  return {
    portfolio: {
      schemaVersion: 1,
      generatedAt,
      source: {
        spreadsheetId: SPREADSHEET_ID,
        ranges: RANGES,
        currentQuotes: "Google Sheets — atualização direta",
        annualHistory: "Google Sheets — mínimo, média e máximo dos últimos 365 dias",
      },
      purchases,
      sales,
      assets,
      integrity: {
        purchaseRows: purchases.length,
        saleRows: sales.length,
        assetRows: assets.length,
        annualRows: assets.filter((asset) => asset.annual).length,
        warnings,
      },
    },
    fiis: {
      schemaVersion: 1,
      generatedAt,
      source: {
        spreadsheetId: SPREADSHEET_ID,
        ranges: FII_RANGES,
        currentQuotes: "Google Sheets — atualização direta",
      },
      exchangeRate: {
        brlPerUsd: brlPerUsd !== null && brlPerUsd > 0 ? brlPerUsd : null,
        source: FII_RANGES.usdRate,
      },
      purchases: fiiPurchases,
      sales: fiiSales,
      assets: fiiAssets,
      integrity: {
        purchaseRows: fiiPurchases.length,
        saleRows: fiiSales.length,
        assetRows: fiiAssets.length,
        warnings: fiiWarnings,
      },
    },
    crypto: {
      schemaVersion: 1,
      generatedAt,
      source: {
        spreadsheetId: SPREADSHEET_ID,
        ranges: CRYPTO_RANGES,
        currentQuotes: "Google Sheets — atualização direta",
      },
      purchases: cryptoTransactions.purchases,
      sales: cryptoTransactions.sales,
      assets: cryptoAssets,
      integrity: {
        purchaseRows: cryptoTransactions.purchases.length,
        saleRows: cryptoTransactions.sales.length,
        assetRows: cryptoAssets.length,
        warnings: cryptoWarnings,
      },
    },
    fixedIncome: {
      schemaVersion: 1,
      generatedAt,
      source: {
        spreadsheetId: SPREADSHEET_ID,
        ranges: FIXED_INCOME_RANGES,
      },
      exchangeRate: {
        brlPerUsd: fixedIncomeBrlPerUsd !== null && fixedIncomeBrlPerUsd > 0 ? fixedIncomeBrlPerUsd : null,
        source: FIXED_INCOME_RANGES.usdRate,
      },
      investments: fixedIncomeInvestments,
      integrity: {
        investmentRows: fixedIncomeInvestments.length,
        warnings: fixedIncomeWarnings,
      },
    },
  };
}

export async function syncSpreadsheetData(
  accessToken: string,
  previousPortfolio: PortfolioData | null = null,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  for (const range of ALL_RANGES) search.append("ranges", range);
  const response = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${search}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    },
    { maxAttempts: 3, timeoutMs: 60_000 },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
    const message = error.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Falha ao ler a planilha: ${message}`);
  }
  const payload = await response.json() as BatchGetResponse;
  return buildSpreadsheetData(payload.valueRanges ?? [], previousPortfolio);
}
