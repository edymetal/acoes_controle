import { useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, ArrowUpRight, Search, Sparkles, Target, TrendingDown } from "lucide-react";
import { EmptyState, MetricCard, SignalBadge } from "../components/Ui";
import { formatCurrency, formatPercent } from "../lib/format";
import { getStrategySignal } from "../lib/portfolio";
import type { PortfolioData, StrategyKind, StrategySettings } from "../types";

type FilterKind = "all" | StrategyKind;

export function Strategy({ data, settings }: { data: PortfolioData; settings: StrategySettings }) {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const signals = useMemo(() => data.assets.map((asset) => ({ asset, signal: getStrategySignal(asset, settings) })), [data.assets, settings]);
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
        <div><span className="eyebrow"><Sparkles size={14} /> LEITURA DE 12 MESES</span><h2>Radar de oportunidades e rompimentos</h2><p>A intensidade compara a cotação atual com a média, mínima e máxima dos últimos 12 meses.</p></div>
        <span className="strategy-intro__disclaimer"><AlertTriangle size={17} /> Indicador matemático, não recomendação de investimento.</span>
      </section>

      <section className="metrics-grid metrics-grid--three">
        <MetricCard label="Abaixo da média" value={String(buyCount)} icon={<TrendingDown size={19} />} helper="Possíveis pontos de compra" accent="green" />
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
          {filtered.map(({ asset, signal }) => {
            const annual = asset.annual;
            const range = annual ? annual.max - annual.min : 0;
            const position = annual && range > 0 ? Math.max(0, Math.min(100, ((asset.currentPrice - annual.min) / range) * 100)) : 0;
            const style = { "--signal-strength": signal.strength } as CSSProperties;
            return (
              <article className={`strategy-card strategy-card--${signal.kind}`} style={style} key={asset.ticker}>
                <header><span className="ticker-avatar">{asset.ticker.slice(0, 2)}</span><span><strong>{asset.ticker}</strong><small>{asset.name}</small></span><SignalBadge signal={signal} /></header>
                <div className="strategy-card__price"><span><small>Cotação atual</small><strong>{formatCurrency(asset.currentPrice)}</strong></span>{signal.distanceToAverage !== null && <span className={signal.distanceToAverage < 0 ? "value--positive" : ""}><small>vs. média</small><strong>{formatPercent(signal.distanceToAverage)}</strong></span>}</div>
                {annual ? <>
                  <div className="range-track"><i style={{ left: `${position}%` }} /><span className="range-track__fill" style={{ width: `${position}%` }} /></div>
                  <div className="range-labels"><span><small>Mínima</small>{formatCurrency(annual.min)}</span><span><small>Média</small>{formatCurrency(annual.average)}</span><span><small>Máxima</small>{formatCurrency(annual.max)}</span></div>
                </> : <div className="range-unavailable">Histórico anual não disponível para este ativo.</div>}
                <footer><span>{signal.description}</span><strong>Intensidade {Math.round(signal.strength * 100)}</strong></footer>
              </article>
            );
          })}
        </div> : <EmptyState title="Nenhum sinal encontrado" description="Altere o filtro ou a busca para ver outros ativos." />}
      </section>
    </div>
  );
}
