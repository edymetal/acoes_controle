import { useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, ArrowUpRight, Search, Sparkles, Target, TrendingDown } from "lucide-react";
import { EmptyState, MetricCard, SignalBadge, StockLogo } from "../components/Ui";
import { formatCurrency, formatPercent } from "../lib/format";
import { getStrategySignal } from "../lib/portfolio";
import type { Asset, PortfolioData, PortfolioModel, StrategyKind, StrategySettings, StrategySignal } from "../types";

type FilterKind = "all" | StrategyKind;

function getRangeDetails(asset: Asset, signal: StrategySignal, settings: StrategySettings) {
  const annual = asset.annual;
  if (!annual || signal.rangePositionPercent === null) return null;

  const annualRange = annual.max - annual.min;
  const priceAt = (percent: number) => annual.min + annualRange * (percent / 100);
  const currentPercent = signal.rangePositionPercent;
  const sellStartPrice = annual.max * (1 - settings.sellDistanceFromHighPercent / 100);
  const sellStartPercent = ((sellStartPrice - annual.min) / annualRange) * 100;

  if (asset.currentPrice < annual.min) {
    return { label: "Abaixo da mínima", currentPercent, priceLabel: `Abaixo de ${formatCurrency(annual.min)}` };
  }
  if (asset.currentPrice > annual.max) {
    return { label: "Acima da máxima", currentPercent, priceLabel: `Acima de ${formatCurrency(annual.max)}` };
  }
  if (signal.kind === "sell") {
    return { label: `${sellStartPercent.toFixed(1)}%–100%`, currentPercent, priceLabel: `${formatCurrency(sellStartPrice)}–${formatCurrency(annual.max)}` };
  }

  const boundaries = [
    { lower: 0, upper: settings.buyZoneLowerPercent },
    { lower: settings.buyZoneLowerPercent, upper: settings.buyZoneMiddlePercent },
    { lower: settings.buyZoneMiddlePercent, upper: settings.buyZoneUpperPercent },
    { lower: settings.buyZoneUpperPercent, upper: Math.max(settings.buyZoneUpperPercent, sellStartPercent) },
  ];
  const group = boundaries.find(({ lower, upper }) => currentPercent >= lower && currentPercent <= upper) ?? { lower: 0, upper: 100 };

  return {
    label: `${group.lower.toFixed(group.lower % 1 ? 1 : 0)}%–${group.upper.toFixed(group.upper % 1 ? 1 : 0)}%`,
    currentPercent,
    priceLabel: `${formatCurrency(priceAt(group.lower))}–${formatCurrency(priceAt(group.upper))}`,
  };
}

export function Strategy({ data, model, settings }: { data: PortfolioData; model: PortfolioModel; settings: StrategySettings }) {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const signals = useMemo(() => {
    const positions = new Map(model.positions.map((position) => [position.ticker, position]));
    return data.assets.map((asset) => {
      const holding = positions.get(asset.ticker);
      return { asset, holding, signal: getStrategySignal(asset, settings, holding?.marketValue ?? 0) };
    });
  }, [data.assets, model.positions, settings]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return signals
      .filter(({ asset, signal }) => (filter === "all" || signal.kind === filter) && (!query || asset.ticker.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query)))
      .sort((a, b) => b.signal.strength - a.signal.strength || a.asset.ticker.localeCompare(b.asset.ticker));
  }, [signals, filter, search]);
  const buyCount = signals.filter(({ signal }) => signal.kind === "buy").length;
  const sellCount = signals.filter(({ signal }) => signal.kind === "sell").length;
  const breakoutCount = signals.filter(({ signal }) => signal.kind === "breakout").length;

  return (
    <div className="page-stack">
      <section className="strategy-intro">
        <div><span className="eyebrow"><Sparkles size={14} /> LEITURA DE 12 MESES</span><h2>Radar de compras e vendas</h2><p>Cada cartão mostra o valor exato da próxima operação e respeita a faixa configurada por ação.</p></div>
        <span className="strategy-intro__disclaimer"><AlertTriangle size={17} /> Indicador matemático, não recomendação de investimento.</span>
      </section>

      <section className="metrics-grid metrics-grid--three">
        <MetricCard label="Comprar agora" value={String(buyCount)} icon={<TrendingDown size={19} />} helper="Sinais com valor de compra" accent="green" />
        <MetricCard label="Sinal de venda" value={String(sellCount)} icon={<Target size={19} />} helper={`Até ${settings.sellDistanceFromHighPercent}% da máxima anual`} accent="amber" />
        <MetricCard label="Em rompimento" value={String(breakoutCount)} icon={<ArrowUpRight size={19} />} helper="Acima da máxima anual" accent="violet" />
      </section>

      <section className="panel">
        <div className="strategy-toolbar">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ativo" /></label>
          <div className="segmented-control" role="group" aria-label="Filtrar sinais">
            {([['all', 'Todos'], ['buy', 'Compra'], ['sell', 'Venda'], ['breakout', 'Rompimento'], ['neutral', 'Neutros']] as Array<[FilterKind, string]>).map(([id, label]) => <button type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)} key={id}>{label}</button>)}
          </div>
        </div>

        {filtered.length ? <div className="strategy-grid">
          {filtered.map(({ asset, holding, signal }) => {
            const annual = asset.annual;
            const range = annual ? annual.max - annual.min : 0;
            const rangePosition = annual && range > 0 ? Math.max(0, Math.min(100, ((asset.currentPrice - annual.min) / range) * 100)) : 0;
            const profit = holding?.unrealized ?? 0;
            const rangeDetails = getRangeDetails(asset, signal, settings);
            const style = { "--signal-strength": signal.strength } as CSSProperties;
            return (
              <article className={`strategy-card strategy-card--${signal.kind}`} style={style} key={asset.ticker}>
                <header><StockLogo ticker={asset.ticker} /><span><strong>{asset.ticker}</strong><small>{asset.name}</small></span><SignalBadge signal={signal} /></header>
                <div className="strategy-card__price"><span><small>Cotação atual</small><strong>{formatCurrency(asset.currentPrice)}</strong></span>{signal.rangePositionPercent !== null && <span><small>No intervalo anual</small><strong>{formatPercent(signal.rangePositionPercent / 100)}</strong></span>}</div>
                <div className={`strategy-action strategy-action--${signal.actionAmount > 0 ? signal.kind : "waiting"}`}>
                  <span><small>Próxima operação</small><strong>{signal.actionAmount > 0 ? (signal.kind === "buy" ? "COMPRAR" : "VENDER") : "AGUARDAR"}</strong></span>
                  <b>{signal.actionAmount > 0 ? formatCurrency(signal.actionAmount) : "—"}</b>
                </div>
                <div className="strategy-position">
                  <span><small>Comprado</small><strong>{formatCurrency(holding?.costBasis ?? 0)}</strong></span>
                  <span><small>Atual</small><strong>{formatCurrency(holding?.marketValue ?? 0)}</strong></span>
                  <span className={profit > 0 ? "value--positive" : profit < 0 ? "value--negative" : ""}><small>Lucro</small><strong>{formatCurrency(profit)}</strong></span>
                </div>
                {annual ? <>
                  <div className="range-track"><i style={{ left: `${rangePosition}%` }} /><span className="range-track__fill" style={{ width: `${rangePosition}%` }} /></div>
                  <div className="range-labels"><span><small>Mínima</small>{formatCurrency(annual.min)}</span><span><small>Média</small>{formatCurrency(annual.average)}</span><span><small>Máxima</small>{formatCurrency(annual.max)}</span></div>
                </> : <div className="range-unavailable">Histórico anual não disponível para este ativo.</div>}
                <footer>
                  {rangeDetails ? <span className="strategy-card__range-info"><small>Faixa atual {rangeDetails.label}</small><strong>{formatPercent(rangeDetails.currentPercent / 100)} no intervalo anual</strong><em>Valores do grupo: {rangeDetails.priceLabel}</em></span> : <span>{signal.description}</span>}
                </footer>
              </article>
            );
          })}
        </div> : <EmptyState title="Nenhum sinal encontrado" description="Altere o filtro ou a busca para ver outros ativos." />}
      </section>
    </div>
  );
}
