import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { batchGetValues } from "./google-sheets-client.mjs";

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
const OUTPUT_DIRECTORY = path.resolve(process.env.SYNC_OUTPUT_DIR ?? "private-data");
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, "portfolio.json");
const FII_OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, "fiis.json");
const CRYPTO_OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, "crypto.json");
const FIXED_INCOME_OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, "fixed-income.json");
const CRYPTO_BY_NAME = new Map([
  ["BITCOIN", { ticker: "BTC", name: "Bitcoin" }],
  ["ETHEREUM", { ticker: "ETH", name: "Ethereum" }],
  ["BNB", { ticker: "BNB", name: "BNB" }],
  ["BINANCE COIN", { ticker: "BNB", name: "BNB" }],
]);
const SUPPORTED_CRYPTO_TICKERS = new Set([...CRYPTO_BY_NAME.values()].map((asset) => asset.ticker));

function excelSerialToIsoDate(serial) {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + Math.round(serial) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ticker(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mapPurchases(rows, warnings) {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const date = excelSerialToIsoDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const total = numeric(row[3]);
    const sheetUnitPrice = numeric(row[4]);

    if (!date || !symbol || quantity === null || quantity <= 0 || total === null || total < 0) {
      warnings.push(`Compra inválida na linha ${index + 25}.`);
      return [];
    }

    return [{
      id: `buy-${index + 25}`,
      type: "buy",
      date,
      ticker: symbol,
      quantity,
      total,
      unitPrice: sheetUnitPrice ?? total / quantity,
    }];
  });
}

function mapSales(rows, warnings) {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const date = excelSerialToIsoDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const total = numeric(row[3]);

    if (!date || !symbol || quantity === null || quantity <= 0 || total === null || total < 0) {
      warnings.push(`Venda inválida na linha ${index + 25}.`);
      return [];
    }

    return [{
      id: `sell-${index + 25}`,
      type: "sell",
      date,
      ticker: symbol,
      quantity,
      total,
      unitPrice: total / quantity,
    }];
  });
}

function mapAssets(rows, warnings, previousAnnualByTicker, generatedAt) {
  const seen = new Set();
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
    if (!hasAnnualStats) warnings.push(
      previousAnnual
        ? `Preços anuais indisponíveis para ${symbol}; mantidos os últimos valores válidos.`
        : `Preços anuais inválidos para ${symbol} na linha ${index + 12} da aba Ações Base.`,
    );

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

function mapFiiPurchases(rows, warnings) {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const date = excelSerialToIsoDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const unitPrice = numeric(row[3]);

    if ((!symbol && !date) || (quantity === null && unitPrice === null) || (quantity === 0 && unitPrice === 0)) return [];
    if (!date || !symbol || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0) {
      warnings.push(`Compra de FII inválida na linha ${index + 24}.`);
      return [];
    }

    return [{
      id: `fii-buy-${index + 24}`,
      type: "buy",
      date,
      ticker: symbol,
      quantity,
      total: quantity * unitPrice,
      unitPrice,
    }];
  });
}

function mapFiiSales(rows, warnings) {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "DATA" && text(row[1]).toUpperCase() === "CODIGO") return [];
    const date = excelSerialToIsoDate(row[0]);
    const symbol = ticker(row[1]);
    const quantity = numeric(row[2]);
    const unitPrice = numeric(row[3]);
    const sheetTotal = numeric(row[4]);

    if ((!symbol && !date) || (quantity === 0 && unitPrice === 0 && sheetTotal === 0)) return [];
    if (!date || !symbol || quantity === null || quantity <= 0 || (unitPrice === null && sheetTotal === null)) {
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
      type: "sell",
      date,
      ticker: symbol,
      quantity,
      total,
      unitPrice: unitPrice ?? total / quantity,
    }];
  });
}

function mapFiiAssets(rows, warnings) {
  const seen = new Set();
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

function mapCryptoTransactions(rows, warnings) {
  const purchases = [];
  const sales = [];

  rows.forEach((row, index) => {
    if (!row?.length) return;
    const symbol = ticker(row[4]);
    if (!SUPPORTED_CRYPTO_TICKERS.has(symbol)) return;

    const rawType = text(row[0]).toUpperCase();
    const type = rawType === "COMPRA" ? "buy" : rawType === "VENDA" ? "sell" : null;
    const date = excelSerialToIsoDate(row[1]);
    const quantity = numeric(row[5]);
    const unitPrice = numeric(row[6]);

    if (!type || !date || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0) {
      warnings.push(`Movimentação de cripto inválida na linha ${index + 1} da aba Cripto.`);
      return;
    }

    const transaction = {
      id: `crypto-${type}-${index + 1}`,
      type,
      date,
      ticker: symbol,
      quantity,
      total: quantity * unitPrice,
      unitPrice,
    };
    (type === "buy" ? purchases : sales).push(transaction);
  });

  return { purchases, sales };
}

function mapCryptoAssets(rows, warnings) {
  const seen = new Set();
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

  for (const crypto of new Map([...CRYPTO_BY_NAME.values()].map((crypto) => [crypto.ticker, crypto])).values()) {
    if (!seen.has(crypto.ticker)) warnings.push(`Cotação não encontrada para ${crypto.name} na aba Cripto Base.`);
  }
  return assets;
}

function mapFixedIncomeInvestments(rows, warnings) {
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    if (text(row[0]).toUpperCase() === "RISCO" && text(row[1]).toUpperCase() === "TIPO") return [];

    const risk = numeric(row[0]);
    const type = text(row[1]);
    const name = text(row[2]);
    const maturityDate = excelSerialToIsoDate(row[6]);
    const lockupDate = excelSerialToIsoDate(row[7]);
    const periodMonths = numeric(row[8]);
    const investedAmount = numeric(row[9]);
    const purchaseDate = excelSerialToIsoDate(row[10]);
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

async function loadPreviousAnnualStats() {
  try {
    const previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    return new Map(
      (previous.assets ?? [])
        .filter((asset) => asset?.ticker && asset?.annual)
        .map((asset) => [asset.ticker, {
          ...asset.annual,
          asOf: asset.annual.asOf ?? previous.generatedAt,
        }]),
    );
  } catch {
    return new Map();
  }
}

async function main() {
  const warnings = [];
  const generatedAt = new Date().toISOString();
  const previousAnnualByTicker = await loadPreviousAnnualStats();
  const response = await batchGetValues({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [...Object.values(RANGES), ...Object.values(FII_RANGES), ...Object.values(CRYPTO_RANGES), ...Object.values(FIXED_INCOME_RANGES)],
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const [purchaseRange, saleRange, assetRange, fiiPurchaseRange, fiiSaleRange, fiiAssetRange, usdRateRange, cryptoTransactionRange, cryptoAssetRange, fixedIncomeRange, fixedIncomeUsdRateRange] = response.valueRanges;
  const purchases = mapPurchases(purchaseRange?.values ?? [], warnings);
  const sales = mapSales(saleRange?.values ?? [], warnings);
  const assets = mapAssets(assetRange?.values ?? [], warnings, previousAnnualByTicker, generatedAt);
  const fiiWarnings = [];
  const fiiPurchases = mapFiiPurchases(fiiPurchaseRange?.values ?? [], fiiWarnings);
  const fiiSales = mapFiiSales(fiiSaleRange?.values ?? [], fiiWarnings);
  const fiiAssets = mapFiiAssets(fiiAssetRange?.values ?? [], fiiWarnings);
  const brlPerUsd = numeric(usdRateRange?.values?.[0]?.[0]);
  if (brlPerUsd === null || brlPerUsd <= 0) fiiWarnings.push("Cotação do dólar inválida na célula Dólar!G5.");
  const cryptoWarnings = [];
  const cryptoTransactions = mapCryptoTransactions(cryptoTransactionRange?.values ?? [], cryptoWarnings);
  const cryptoAssets = mapCryptoAssets(cryptoAssetRange?.values ?? [], cryptoWarnings);
  const fixedIncomeWarnings = [];
  const fixedIncomeInvestments = mapFixedIncomeInvestments(fixedIncomeRange?.values ?? [], fixedIncomeWarnings);
  const fixedIncomeBrlPerUsd = numeric(fixedIncomeUsdRateRange?.values?.[0]?.[0]);
  if (fixedIncomeBrlPerUsd === null || fixedIncomeBrlPerUsd <= 0) fixedIncomeWarnings.push("Cotação do dólar inválida na célula Dólar!G5.");

  const output = {
    schemaVersion: 1,
    generatedAt,
    source: {
      spreadsheetId: SPREADSHEET_ID,
      ranges: RANGES,
      currentQuotes: "Google Sheets",
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
  };

  const fiiOutput = {
    schemaVersion: 1,
    generatedAt: output.generatedAt,
    source: {
      spreadsheetId: SPREADSHEET_ID,
      ranges: FII_RANGES,
      currentQuotes: "Google Sheets",
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
  };

  const cryptoOutput = {
    schemaVersion: 1,
    generatedAt: output.generatedAt,
    source: {
      spreadsheetId: SPREADSHEET_ID,
      ranges: CRYPTO_RANGES,
      currentQuotes: "Google Sheets",
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
  };

  const fixedIncomeOutput = {
    schemaVersion: 1,
    generatedAt: output.generatedAt,
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
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await Promise.all([
    writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8"),
    writeFile(FII_OUTPUT_PATH, `${JSON.stringify(fiiOutput, null, 2)}\n`, "utf8"),
    writeFile(CRYPTO_OUTPUT_PATH, `${JSON.stringify(cryptoOutput, null, 2)}\n`, "utf8"),
    writeFile(FIXED_INCOME_OUTPUT_PATH, `${JSON.stringify(fixedIncomeOutput, null, 2)}\n`, "utf8"),
  ]);
  console.log(
    `Dados sincronizados: ${purchases.length} compras, ${sales.length} vendas, ${assets.length} ativos, ${warnings.length} avisos.`,
  );
  console.log(
    `FIIs sincronizados: ${fiiPurchases.length} compras, ${fiiSales.length} vendas, ${fiiAssets.length} fundos, ${fiiWarnings.length} avisos.`,
  );
  console.log(
    `Criptos sincronizadas: ${cryptoTransactions.purchases.length} compras, ${cryptoTransactions.sales.length} vendas, ${cryptoAssets.length} ativos, ${cryptoWarnings.length} avisos.`,
  );
  console.log(
    `Renda fixa sincronizada: ${fixedIncomeInvestments.length} ativos, ${fixedIncomeWarnings.length} avisos.`,
  );
  console.log(`Arquivos privados gravados em ${OUTPUT_DIRECTORY}.`);
}

await main();
