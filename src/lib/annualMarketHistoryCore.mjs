const DAY_MS = 86_400_000;
export const ANNUAL_MARKET_HISTORY_RANGE = "'Ações Anual API'!A2:J1000";

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function mapAnnualMarketHistory(rows, generatedAt, warnings) {
  const annualByTicker = new Map();
  const duplicateTickers = new Set();
  const now = Date.parse(generatedAt);
  for (const row of rows) {
    if (!row.length || !row[0]) continue;
    const [rawTicker, min, average, max, observations, periodStart, periodEnd, asOf, source, currency] = row;
    const ticker = typeof rawTicker === "string" ? rawTicker.trim().toUpperCase() : "";
    const validNumbers = [min, average, max].every((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(ticker) || !validNumbers || min > average || average > max
      || typeof observations !== "number" || !Number.isInteger(observations) || observations < 200 || observations > 366
      || !validDate(periodStart) || !validDate(periodEnd) || periodStart >= periodEnd
      || typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(asOf) || !Number.isFinite(Date.parse(asOf))
      || new Date(asOf).toISOString() !== asOf || Date.parse(asOf) > now + 300_000
      || periodEnd > asOf.slice(0, 10) || Date.parse(periodEnd) - Date.parse(periodStart) < 330 * DAY_MS
      || Date.parse(periodEnd) - Date.parse(periodStart) > 366 * DAY_MS || source !== "massive" || currency !== "USD") {
      warnings.push("Um registro do histórico anual Massive foi ignorado por conter dados inválidos.");
      continue;
    }
    if (annualByTicker.has(ticker) || duplicateTickers.has(ticker)) {
      annualByTicker.delete(ticker);
      duplicateTickers.add(ticker);
      warnings.push(`Histórico anual Massive duplicado para ${ticker}; o registro foi ignorado.`);
      continue;
    }
    annualByTicker.set(ticker, {
      min, average, max, observations, periodStart, periodEnd, asOf, source, currency,
      isFallback: now - Date.parse(asOf) > 3 * DAY_MS || now - Date.parse(`${periodEnd}T00:00:00Z`) > 7 * DAY_MS,
    });
  }
  return annualByTicker;
}
