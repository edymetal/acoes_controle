/**
 * Coletor diário da evolução patrimonial.
 *
 * Este script deve ser vinculado à planilha privada. Ele copia somente
 * cotações, câmbio e benchmarks para a aba "Evolução Hist". Todos os
 * cálculos financeiros continuam sendo feitos pelo aplicativo.
 */

const EVOLUTION_HISTORY_SHEET = "Evolução Hist";
const EVOLUTION_TIMEZONE = "America/Sao_Paulo";
const EVOLUTION_SPREADSHEET_ID_PROPERTY = "evolution.spreadsheetId";
const EVOLUTION_HEADERS = [
  "Data",
  "Capturado em",
  "Tipo",
  "Classe",
  "Código",
  "Moeda",
  "Valor",
  "Status",
];

const EVOLUTION_QUOTE_SOURCES = [
  {
    sheet: "Ações Base",
    range: "H12:Q1000",
    assetClass: "stocks",
    currency: "USD",
    symbolColumn: 0,
    valueColumn: 5,
  },
  {
    sheet: "FII BASE",
    range: "A16:G1000",
    assetClass: "fiis",
    currency: "BRL",
    symbolColumn: 0,
    valueColumn: 6,
  },
];

const EVOLUTION_CRYPTO_SYMBOLS = {
  BITCOIN: "BTC",
  ETHEREUM: "ETH",
  BNB: "BNB",
  "BINANCE COIN": "BNB",
};

function evolutionText_(value) {
  return typeof value === "string" ? value.trim() : "";
}

function evolutionPositiveNumber_(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function evolutionHistorySheet_(spreadsheet) {
  const existing = spreadsheet.getSheetByName(EVOLUTION_HISTORY_SHEET);
  if (existing) return existing;
  const created = spreadsheet.insertSheet(EVOLUTION_HISTORY_SHEET);
  created.getRange(1, 1, 1, EVOLUTION_HEADERS.length).setValues([EVOLUTION_HEADERS]);
  created.setFrozenRows(1);
  created.getRange("A:A").setNumberFormat("@");
  created.getRange("B:B").setNumberFormat("@");
  created.getRange("G:G").setNumberFormat("0.00000000");
  return created;
}

function evolutionSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(EVOLUTION_SPREADSHEET_ID_PROPERTY);
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  const active = SpreadsheetApp.getActive();
  if (!active) throw new Error("Execute setupEvolutionHistory uma vez na planilha.");
  return active;
}

function evolutionQuoteRows_(spreadsheet, date, capturedAt) {
  const rows = [];
  for (const source of EVOLUTION_QUOTE_SOURCES) {
    const sheet = spreadsheet.getSheetByName(source.sheet);
    if (!sheet) continue;
    for (const row of sheet.getRange(source.range).getValues()) {
      const symbol = evolutionText_(row[source.symbolColumn]).toUpperCase();
      const value = evolutionPositiveNumber_(row[source.valueColumn]);
      if (!symbol || value === null) continue;
      rows.push([date, capturedAt, "quote", source.assetClass, symbol, source.currency, value, "valid"]);
    }
  }

  const cryptoSheet = spreadsheet.getSheetByName("Cripto Base");
  if (cryptoSheet) {
    for (const row of cryptoSheet.getRange("D2:E13").getValues()) {
      const symbol = EVOLUTION_CRYPTO_SYMBOLS[evolutionText_(row[0]).toUpperCase()];
      const value = evolutionPositiveNumber_(row[1]);
      if (!symbol || value === null) continue;
      rows.push([date, capturedAt, "quote", "crypto", symbol, "USD", value, "valid"]);
    }
  }
  return rows;
}

function evolutionFxRows_(spreadsheet, date, capturedAt) {
  const sheet = spreadsheet.getSheetByName("Dólar");
  if (!sheet) return [];
  const value = evolutionPositiveNumber_(sheet.getRange("G5").getValue());
  return value === null ? [] : [[date, capturedAt, "fx", "", "USD-BRL", "BRL", value, "valid"]];
}

function evolutionBenchmarkRows_(spreadsheet, date, capturedAt) {
  const sheet = spreadsheet.getSheetByName("Evolução Benchmarks");
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues().flatMap((row) => {
    const symbol = evolutionText_(row[0]).toUpperCase();
    const currency = evolutionText_(row[1]).toUpperCase();
    const value = evolutionPositiveNumber_(row[2]);
    if (!symbol || (currency !== "USD" && currency !== "BRL") || value === null) return [];
    return [[date, capturedAt, "benchmark", "", symbol, currency, value, "valid"]];
  });
}

function removeEvolutionDate_(sheet, date) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const dates = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    if (dates[index][0] === date) sheet.deleteRow(index + 2);
  }
}

function captureEvolutionSnapshot() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30_000);
  try {
    const spreadsheet = evolutionSpreadsheet_();
    const now = new Date();
    const date = Utilities.formatDate(now, EVOLUTION_TIMEZONE, "yyyy-MM-dd");
    const capturedAt = now.toISOString();
    const rows = [
      ...evolutionQuoteRows_(spreadsheet, date, capturedAt),
      ...evolutionFxRows_(spreadsheet, date, capturedAt),
      ...evolutionBenchmarkRows_(spreadsheet, date, capturedAt),
    ];
    if (rows.length === 0) throw new Error("Nenhuma cotação válida foi encontrada para a captura.");

    const history = evolutionHistorySheet_(spreadsheet);
    removeEvolutionDate_(history, date);
    history.getRange(history.getLastRow() + 1, 1, rows.length, EVOLUTION_HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function createDailyEvolutionTrigger() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === "captureEvolutionSnapshot") ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger("captureEvolutionSnapshot")
    .timeBased()
    .atHour(23)
    .nearMinute(30)
    .everyDays(1)
    .inTimezone(EVOLUTION_TIMEZONE)
    .create();
}

function setupEvolutionHistory() {
  const spreadsheet = SpreadsheetApp.getActive();
  if (!spreadsheet) throw new Error("Abra a planilha antes de executar a configuração.");
  PropertiesService.getScriptProperties()
    .setProperty(EVOLUTION_SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
  evolutionHistorySheet_(spreadsheet);
  captureEvolutionSnapshot();
  createDailyEvolutionTrigger();
}
