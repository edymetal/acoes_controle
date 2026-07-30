import type {
  EvolutionAssetClass,
  EvolutionCurrency,
  EvolutionHistoryData,
  EvolutionHistoryRecord,
  EvolutionRecordKind,
  EvolutionRecordStatus,
} from "../types";
import { parseEvolutionHistoryData } from "./dataValidation";

const SPREADSHEET_ID = "1cdPXA3O0DoSfOILOpc7GZjWHI7tHnhgRH9aMXdU-_F0";
export const EVOLUTION_RANGE = "'Evolução Hist'!A2:H100000";

export type EvolutionSheetCell = string | number | boolean | null;
export type EvolutionSheetRow = EvolutionSheetCell[];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedSymbol(value: unknown) {
  return text(value).toUpperCase();
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function recordKind(value: unknown): EvolutionRecordKind | null {
  const normalized = text(value).toLowerCase();
  return normalized === "quote" || normalized === "fx" || normalized === "benchmark" ? normalized : null;
}

function assetClass(value: unknown): EvolutionAssetClass | null {
  const normalized = text(value).toLowerCase();
  return normalized === "stocks" || normalized === "fiis" || normalized === "crypto" ? normalized : null;
}

function currency(value: unknown): EvolutionCurrency | null {
  const normalized = text(value).toUpperCase();
  return normalized === "USD" || normalized === "BRL" ? normalized : null;
}

function recordStatus(value: unknown): EvolutionRecordStatus | null {
  const normalized = text(value).toLowerCase();
  return normalized === "valid" || normalized === "partial" ? normalized : null;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoDateTime(value: string) {
  return !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function mapEvolutionRow(
  row: EvolutionSheetRow,
  rowNumber: number,
  warnings: string[],
): EvolutionHistoryRecord | null {
  if (!row?.length) return null;
  const date = text(row[0]);
  const capturedAt = text(row[1]);
  const kind = recordKind(row[2]);
  const itemClass = assetClass(row[3]);
  const symbol = normalizedSymbol(row[4]);
  const itemCurrency = currency(row[5]);
  const value = positiveNumber(row[6]);
  const status = recordStatus(row[7]);
  const hasValidClass = kind !== "quote" || itemClass !== null;

  if (!isIsoDate(date) || !isIsoDateTime(capturedAt) || !kind || !hasValidClass || !symbol
    || !itemCurrency || value === null || !status) {
    warnings.push(`Registro histórico inválido na linha ${rowNumber} da aba Evolução Hist.`);
    return null;
  }

  return {
    id: `${date}:${kind}:${itemClass ?? "global"}:${symbol}`,
    date,
    capturedAt: new Date(capturedAt).toISOString(),
    kind,
    assetClass: itemClass,
    symbol,
    currency: itemCurrency,
    value,
    status,
  };
}

export function buildEvolutionHistoryData(
  rows: EvolutionSheetRow[],
  generatedAt = new Date().toISOString(),
): EvolutionHistoryData {
  const warnings: string[] = [];
  const recordsById = new Map<string, EvolutionHistoryRecord>();

  rows.forEach((row, index) => {
    const record = mapEvolutionRow(row, index + 2, warnings);
    if (!record) return;
    if (recordsById.has(record.id)) {
      warnings.push(`Registro histórico duplicado para ${record.id}; mantida a captura mais recente.`);
    }
    const previous = recordsById.get(record.id);
    if (!previous || previous.capturedAt <= record.capturedAt) recordsById.set(record.id, record);
  });

  const records = [...recordsById.values()]
    .sort((left, right) => left.date.localeCompare(right.date)
      || left.kind.localeCompare(right.kind)
      || left.symbol.localeCompare(right.symbol));

  return parseEvolutionHistoryData({
    schemaVersion: 1,
    generatedAt,
    source: {
      spreadsheetId: SPREADSHEET_ID,
      range: EVOLUTION_RANGE,
    },
    records,
    integrity: {
      recordRows: records.length,
      warnings,
    },
  });
}
