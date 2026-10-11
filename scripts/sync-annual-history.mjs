import { readFile } from "node:fs/promises";
import { batchGetValues, sheetsRequest } from "./google-sheets-client.mjs";
import { annualDateRange, annualStatsRow, ANNUAL_HISTORY_HEADER, ANNUAL_HISTORY_SHEET, createMassiveHistoryClient, marketDate } from "./annual-market-history.mjs";
import { mapAnnualMarketHistory } from "../src/lib/annualMarketHistoryCore.mjs";

const spreadsheetId = "1cdPXA3O0DoSfOILOpc7GZjWHI7tHnhgRH9aMXdU-_F0";
const apiKey = process.env.MASSIVE_API_KEY?.trim() || (await readFile("auth/massive-api-key.txt", "utf8")).trim();
if (!apiKey) throw new Error("Configure MASSIVE_API_KEY para atualizar os preços anuais.");
const metadata = await sheetsRequest({ spreadsheetId, resource: "?fields=sheets.properties" });
if (!metadata.sheets.some((sheet) => sheet.properties.title === ANNUAL_HISTORY_SHEET)) {
  await sheetsRequest({ spreadsheetId, resource: ":batchUpdate", method: "POST", body: { requests: [{ addSheet: { properties: { title: ANNUAL_HISTORY_SHEET, gridProperties: { rowCount: 1000, columnCount: 10, frozenRowCount: 1 } } } }] } });
}
const input = await batchGetValues({ spreadsheetId, ranges: ["'Ações Base'!H13:Q1000", `'${ANNUAL_HISTORY_SHEET}'!A2:J1000`], valueRenderOption: "UNFORMATTED_VALUE" });
const tickers = [...new Set((input.valueRanges[0].values ?? []).flatMap((row) => typeof row[0] === "string" && /^[A-Z0-9][A-Z0-9._-]*$/.test(row[0].trim().toUpperCase()) && typeof row[5] === "number" ? [row[0].trim().toUpperCase()] : []))];
if (!tickers.length) throw new Error("Nenhum ativo válido encontrado; os preços anuais existentes foram preservados.");
const previous = new Map((input.valueRanges[1].values ?? []).filter((row) => row[0]).map((row) => [row[0], row]));
const validPrevious = mapAnnualMarketHistory(input.valueRanges[1].values ?? [], new Date().toISOString(), []);
const load = createMassiveHistoryClient(apiKey);
const range = annualDateRange();
let updated = 0;
let failed = 0;
const rows = [];
for (const [index, ticker] of tickers.entries()) {
  const cached = validPrevious.has(ticker) ? previous.get(ticker) : undefined;
  if (cached?.[8] === "massive" && !validPrevious.get(ticker).isFallback && cached[5] === range.from && marketDate(Date.parse(cached[7])) === marketDate(Date.now())) {
    rows.push(cached);
  } else {
    try {
      rows.push(annualStatsRow(await load(ticker, range)));
      updated++;
    } catch (error) {
      if (error.message.includes("chave da Massive")) throw error;
      failed++;
      if (cached) rows.push(cached);
    }
  }
  console.log(`Histórico anual: ${index + 1}/${tickers.length} processados.`);
}
if (!rows.length) throw new Error("Nenhum histórico anual válido; a aba existente foi preservada.");
const values = [ANNUAL_HISTORY_HEADER, ...rows];
while (values.length < 1000) values.push(Array(10).fill(""));
await sheetsRequest({ spreadsheetId, resource: `/values/${encodeURIComponent(`'${ANNUAL_HISTORY_SHEET}'!A1:J1000`)}?valueInputOption=RAW`, method: "PUT", body: { range: `'${ANNUAL_HISTORY_SHEET}'!A1:J1000`, majorDimension: "ROWS", values } });
console.log(`Preços anuais gravados somente na planilha privada: ${updated} atualizados, ${failed} indisponíveis, ${rows.length} disponíveis.`);
if (failed) process.exitCode = 1;
