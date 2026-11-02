import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculatePortfolio } from "../lib/portfolio";
import { DEFAULT_STRATEGY_SETTINGS } from "../lib/settings";
import { formatCurrency } from "../lib/format";
import type { Asset, PortfolioData } from "../types";
import { Strategy } from "./Strategy";

function renderStrategy(currentPrice: number, positionValue: number, positionCost = positionValue, annual: Asset["annual"] = { min: 8, average: 18, max: 30, observations: 250, currency: "USD" }) {
  const quantity = positionValue / currentPrice;
  const data: PortfolioData = {
    schemaVersion: 1,
    generatedAt: "2026-11-02T12:00:00.000Z",
    source: { spreadsheetId: "test", ranges: {}, currentQuotes: "test", annualHistory: "test" },
    purchases: [{ id: "buy", type: "buy", ticker: "AAA", date: "2026-01-01", quantity, unitPrice: positionCost / quantity, total: positionCost }],
    sales: [],
    assets: [{ ticker: "AAA", name: "A", sector: "Tech", exchange: "NYSE", currentPrice, annual }],
    integrity: { purchaseRows: 1, saleRows: 0, assetRows: 1, annualRows: annual ? 1 : 0, warnings: [] },
  };
  return renderToStaticMarkup(<Strategy data={data} model={calculatePortfolio(data)} settings={DEFAULT_STRATEGY_SETTINGS} />);
}

describe("Strategy", () => {
  it.each([
    { price: 14, value: 50, cost: 65, operation: "COMPRAR AGORA", amount: 10 },
    { price: 11, value: 41.52, cost: 40.37, operation: "COMPRAR AGORA", amount: 59.63 },
    { price: 7, value: 50, cost: 65, operation: "COMPRAR AGORA", amount: 50 },
    { price: 29, value: 115, cost: 115, operation: "VENDER AGORA", amount: 40 },
    { price: 29, value: 95, cost: 95, operation: "VENDER AGORA", amount: 20 },
    { price: 31, value: 75, cost: 75, operation: "VENDER AGORA", amount: 10 },
  ])("exibe uma única operação atual de $amount para cotação $price e posição $value", ({ price, value, cost, operation, amount }) => {
    const html = renderStrategy(price, value, cost);
    const action = html.match(/<div class="strategy-action [^"]*">(.*?)<\/div>/)?.[1];
    expect(action).toContain(`<small>Operação agora</small><strong>${operation}</strong>`);
    expect(action).toContain(`<b>${formatCurrency(amount)}</b>`);
    expect(action?.match(/<b>/g)).toHaveLength(1);
    expect(html).toContain(`Total agora ${formatCurrency(amount)}`);
  });

  it.each([
    { price: 14, value: 110, cost: 100 },
    { price: 20, value: 115, cost: 115 },
    { price: 29, value: 75, cost: 75 },
    { price: 31, value: 65, cost: 65 },
  ])("mostra aguardar sem valor passado ou futuro na cotação $price e posição $value", ({ price, value, cost }) => {
    const html = renderStrategy(price, value, cost);
    expect(html).toContain('<div class="strategy-action strategy-action--waiting"><span><small>Operação agora</small><strong>AGUARDAR</strong></span><b>—</b></div>');
    expect(html).not.toContain("COMPRAR AGORA");
    expect(html).not.toContain("VENDER AGORA");
  });

  it("indica operação indisponível quando não há histórico anual válido", () => {
    expect(renderStrategy(14, 65, 65, null)).toContain('<small>Operação agora</small><strong>INDISPONÍVEL</strong></span><b>—</b>');
  });
});
