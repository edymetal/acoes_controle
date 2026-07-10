import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { batchGetValues } from "./google-sheets-client.mjs";

const SPREADSHEET_ID = "1cdPXA3O0DoSfOILOpc7GZjWHI7tHnhgRH9aMXdU-_F0";
const RANGES = {
  purchases: "'Ações Hist'!F25:J1000",
  sales: "'Ações Hist'!AJ25:AM1000",
  assets: "'Ações Base'!H12:N110",
};
const OUTPUT_PATH = path.resolve("public/data/portfolio.json");

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

function mapAssets(rows, warnings) {
  const seen = new Set();
  return rows.flatMap((row, index) => {
    if (!row?.length) return [];
    const symbol = ticker(row[0]);
    const currentPrice = numeric(row[5]);

    if (!symbol || currentPrice === null || currentPrice < 0) {
      warnings.push(`Ativo inválido na linha ${index + 12} da aba Ações Base.`);
      return [];
    }
    if (seen.has(symbol)) {
      warnings.push(`Ticker duplicado na base: ${symbol}.`);
      return [];
    }
    seen.add(symbol);

    return [{
      ticker: symbol,
      name: text(row[1]) || symbol,
      sector: text(row[3]) || "Não informado",
      currentPrice,
      exchange: text(row[6]) || "Não informada",
      annual: null,
    }];
  });
}

async function fetchAnnualStats(symbol) {
  const encodedTicker = encodeURIComponent(symbol.replace(".", "-"));
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}?range=1y&interval=1d&events=history&includeAdjustedClose=true`;
  const response = await fetch(url, {
    headers: { "User-Agent": "acoes-controle/1.0" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close
    ?? result?.indicators?.adjclose?.[0]?.adjclose
    ?? [];
  const validCloses = closes.filter((value) => typeof value === "number" && Number.isFinite(value));

  if (validCloses.length < 20) throw new Error("histórico insuficiente");

  return {
    min: Math.min(...validCloses),
    average: validCloses.reduce((sum, value) => sum + value, 0) / validCloses.length,
    max: Math.max(...validCloses),
    observations: validCloses.length,
    currency: result?.meta?.currency ?? "USD",
  };
}

async function enrichAnnualStats(assets, warnings) {
  const queue = [...assets];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const asset = queue.shift();
      if (!asset) break;
      try {
        asset.annual = await fetchAnnualStats(asset.ticker);
      } catch (error) {
        warnings.push(`Histórico anual indisponível para ${asset.ticker}: ${error.message}.`);
      }
    }
  });
  await Promise.all(workers);
}

async function main() {
  const warnings = [];
  const response = await batchGetValues({
    spreadsheetId: SPREADSHEET_ID,
    ranges: Object.values(RANGES),
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const [purchaseRange, saleRange, assetRange] = response.valueRanges;
  const purchases = mapPurchases(purchaseRange?.values ?? [], warnings);
  const sales = mapSales(saleRange?.values ?? [], warnings);
  const assets = mapAssets(assetRange?.values ?? [], warnings);

  await enrichAnnualStats(assets, warnings);

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      spreadsheetId: SPREADSHEET_ID,
      ranges: RANGES,
      currentQuotes: "Google Sheets",
      annualHistory: "Yahoo Finance — fechamentos diários de 1 ano",
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

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Dados sincronizados: ${purchases.length} compras, ${sales.length} vendas, ${assets.length} ativos, ${warnings.length} avisos.`,
  );
}

await main();
