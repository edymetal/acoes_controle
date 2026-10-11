import { describe, expect, it, vi } from "vitest";
import { annualDateRange, annualStatsRow, calculateAnnualCloseStats, createMassiveHistoryClient } from "./annual-market-history.mjs";

const range = { from: "2025-10-11", to: "2026-10-10" };
const bars = [];
for (let time = Date.parse("2025-10-11T14:00:00Z"); time <= Date.parse("2026-10-10T14:00:00Z"); time += 86_400_000) {
  const weekday = new Date(time).getUTCDay();
  if (weekday !== 0 && weekday !== 6) bars.push({ t: time, c: bars.length % 2 === 0 ? 10 : 20, h: 1000, l: 1 });
}
const payload = { status: "OK", ticker: "AAA", adjusted: true, results: bars };
const options = { ticker: "AAA", ...range, updatedAt: "2026-10-11T18:00:00.000Z" };

describe("histórico anual Massive", () => {
  it("calcula mínimo, média e máximo dos fechamentos, preservando a regra da planilha", () => {
    const stats = calculateAnnualCloseStats(payload, options);
    expect(stats).toMatchObject({ min: 10, average: 15, max: 20, observations: 260, periodStart: "2025-10-11", periodEnd: "2026-10-09", source: "massive" });
    expect(annualStatsRow(stats)).toEqual(["AAA", 10, 15, 20, 260, "2025-10-11", "2026-10-09", options.updatedAt, "massive", "USD"]);
  });

  it("consulta somente dias concluídos e define o ano com o calendário de Nova York", () => {
    expect(annualDateRange(Date.parse("2026-10-12T01:00:00Z"))).toEqual(range);
  });

  it("recusa histórico parcial, outro ticker, preços sem ajuste e respostas paginadas", () => {
    for (const invalid of [{ ...payload, ticker: "OTHER" }, { ...payload, adjusted: false }, { ...payload, results: bars.slice(-200) }, { ...payload, next_url: "https://other.invalid/" }]) {
      expect(() => calculateAnnualCloseStats(invalid, options)).toThrow();
    }
  });

  it("recusa preços inválidos, datas duplicadas e barras fora do período", () => {
    for (const invalidBar of [{ ...bars[0], c: NaN }, { ...bars[0], c: 0 }, { ...bars[0], t: Date.parse("2027-01-01T14:00:00Z") }, bars[1]]) {
      expect(() => calculateAnnualCloseStats({ ...payload, results: [invalidBar, ...bars.slice(1)] }, options)).toThrow();
    }
  });

  it("respeita cinco consultas por minuto e envia a chave somente no cabeçalho", async () => {
    let clock = Date.parse(options.updatedAt);
    const sleepImpl = vi.fn(async (ms) => { clock += ms; });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload)));
    const load = createMassiveHistoryClient("test-secret", { fetchImpl, sleepImpl, now: () => clock });
    for (let i = 0; i < 6; i++) await load("AAA", range);
    expect(clock - Date.parse(options.updatedAt)).toBe(65_000);
    expect(fetchImpl.mock.calls[0][0]).toMatch(/^https:\/\/api.massive.com\//);
    expect(fetchImpl.mock.calls[0][0]).not.toContain("test-secret");
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer test-secret" });
  });

  it("aguarda o próximo minuto após limite de consultas e não repete uma chave recusada", async () => {
    let clock = Date.parse(options.updatedAt);
    const sleepImpl = vi.fn(async (ms) => { clock += ms; });
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    await createMassiveHistoryClient("test-secret", { fetchImpl, sleepImpl, now: () => clock })("AAA", range);
    expect(sleepImpl).toHaveBeenCalledWith(60_000);
    const denied = vi.fn(async () => new Response(null, { status: 401 }));
    await expect(createMassiveHistoryClient("test-secret", { fetchImpl: denied })("AAA", range)).rejects.toThrow("chave da Massive");
    expect(denied).toHaveBeenCalledTimes(1);
  });
});
