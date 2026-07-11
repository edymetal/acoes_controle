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
const OUTPUT_PATH = path.resolve("public/data/portfolio.json");
const FII_OUTPUT_PATH = path.resolve("public/data/fiis.json");

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

function mapAssets(rows, warnings, previousAnnualByTicker) {
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
      } : previousAnnual,
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

async function loadPreviousAnnualStats() {
  try {
    const previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    return new Map(
      (previous.assets ?? [])
        .filter((asset) => asset?.ticker && asset?.annual)
        .map((asset) => [asset.ticker, asset.annual]),
    );
  } catch {
    return new Map();
  }
}

async function main() {
  const warnings = [];
  const previousAnnualByTicker = await loadPreviousAnnualStats();
  const response = await batchGetValues({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [...Object.values(RANGES), ...Object.values(FII_RANGES)],
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const [purchaseRange, saleRange, assetRange, fiiPurchaseRange, fiiSaleRange, fiiAssetRange, usdRateRange] = response.valueRanges;
  const purchases = mapPurchases(purchaseRange?.values ?? [], warnings);
  const sales = mapSales(saleRange?.values ?? [], warnings);
  const assets = mapAssets(assetRange?.values ?? [], warnings, previousAnnualByTicker);
  const fiiWarnings = [];
  const fiiPurchases = mapFiiPurchases(fiiPurchaseRange?.values ?? [], fiiWarnings);
  const fiiSales = mapFiiSales(fiiSaleRange?.values ?? [], fiiWarnings);
  const fiiAssets = mapFiiAssets(fiiAssetRange?.values ?? [], fiiWarnings);
  const brlPerUsd = numeric(usdRateRange?.values?.[0]?.[0]);
  if (brlPerUsd === null || brlPerUsd <= 0) fiiWarnings.push("Cotação do dólar inválida na célula Dólar!G5.");

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
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

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await Promise.all([
    writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8"),
    writeFile(FII_OUTPUT_PATH, `${JSON.stringify(fiiOutput, null, 2)}\n`, "utf8"),
  ]);
  console.log(
    `Dados sincronizados: ${purchases.length} compras, ${sales.length} vendas, ${assets.length} ativos, ${warnings.length} avisos.`,
  );
  console.log(
    `FIIs sincronizados: ${fiiPurchases.length} compras, ${fiiSales.length} vendas, ${fiiAssets.length} fundos, ${fiiWarnings.length} avisos.`,
  );
}

await main();
