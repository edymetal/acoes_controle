const DAY_MS = 86_400_000;
export const ANNUAL_HISTORY_SHEET = "Ações Anual API";
export const ANNUAL_HISTORY_HEADER = ["Ticker", "Mínima", "Média", "Máxima", "Pregões", "Início", "Último pregão", "Atualizado em", "Fonte", "Moeda"];

export function marketDate(timestamp) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

export function annualDateRange(now = Date.now()) {
  const today = marketDate(now);
  const todayUtc = Date.parse(`${today}T00:00:00Z`);
  return { from: new Date(todayUtc - 365 * DAY_MS).toISOString().slice(0, 10), to: new Date(todayUtc - DAY_MS).toISOString().slice(0, 10) };
}

export function calculateAnnualCloseStats(payload, { ticker, from, to, updatedAt }) {
  if (payload?.status !== "OK" || payload.ticker !== ticker || payload.adjusted !== true || payload.next_url || !Array.isArray(payload.results) || payload.results.length < 200) {
    throw new Error("Histórico anual incompleto ou inválido.");
  }
  const seen = new Set();
  const bars = payload.results.map((bar) => {
    if (!Number.isFinite(bar.t) || !Number.isFinite(bar.c) || bar.c <= 0) throw new Error("Fechamento diário inválido.");
    const date = marketDate(bar.t);
    if (date < from || date > to || seen.has(date)) throw new Error("Data de fechamento inválida ou duplicada.");
    seen.add(date);
    return { date, close: bar.c };
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (Date.parse(`${bars[0].date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 14 * DAY_MS
    || Date.parse(`${to}T00:00:00Z`) - Date.parse(`${bars.at(-1).date}T00:00:00Z`) > 7 * DAY_MS) {
    throw new Error("O histórico não cobre o período anual solicitado.");
  }
  const closes = bars.map((bar) => bar.close);
  return { ticker, min: Math.min(...closes), average: closes.reduce((sum, price) => sum + price, 0) / closes.length, max: Math.max(...closes), observations: closes.length,
    periodStart: from, periodEnd: bars.at(-1).date, asOf: updatedAt, source: "massive", currency: "USD" };
}

export function annualStatsRow(stats) {
  return [stats.ticker, stats.min, stats.average, stats.max, stats.observations, stats.periodStart, stats.periodEnd, stats.asOf, stats.source, stats.currency];
}

export function createMassiveHistoryClient(apiKey, { fetchImpl = fetch, sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now } = {}) {
  let lastRequest = null;
  return async function load(ticker, range) {
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(ticker)) throw new Error("Ticker inválido.");
    for (let attempt = 0; attempt < 3; attempt++) {
      if (lastRequest !== null) await sleepImpl(Math.max(0, 13_000 - (now() - lastRequest)));
      lastRequest = now();
      const url = new URL(`https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${range.from}/${range.to}`);
      url.search = new URLSearchParams({ adjusted: "true", sort: "asc", limit: "5000" }).toString();
      let response;
      try {
        response = await fetchImpl(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30_000) });
      } catch {
        if (attempt === 2) throw new Error("Não foi possível consultar o histórico da Massive.");
        continue;
      }
      if (response.status === 401 || response.status === 403) throw new Error("A chave da Massive ou o plano não permite consultar o histórico.");
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel().catch(() => undefined);
        if (attempt === 2) throw new Error("O provedor não disponibilizou o histórico após três tentativas.");
        if (response.status === 429) await sleepImpl(60_000);
        continue;
      }
      if (!response.ok) throw new Error(`Consulta de histórico recusada (HTTP ${response.status}).`);
      const payload = await response.json();
      return calculateAnnualCloseStats(payload, { ticker, ...range, updatedAt: new Date(now()).toISOString() });
    }
    throw new Error("Não foi possível consultar o histórico.");
  };
}
