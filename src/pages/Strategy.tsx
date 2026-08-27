import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, Search, SlidersHorizontal, Sparkles, Target, TrendingDown, TrendingUp, WalletCards, X } from "lucide-react";
import { DataHealthNotice, EmptyState, MetricCard, SignalBadge, StockLogo } from "../components/Ui";
import { formatCurrency, formatPercent } from "../lib/format";
import { getStrategySignal } from "../lib/portfolio";
import { getStrategyLevelValues } from "../lib/settings";
import type { Asset, PortfolioData, PortfolioModel, StrategyKind, StrategySettings, StrategySignal } from "../types";

type FilterKind = "all" | "actionable" | StrategyKind;

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
  const [showLevels, setShowLevels] = useState(false);
  const levelValues = useMemo(() => getStrategyLevelValues(settings), [settings]);
  const signals = useMemo(() => {
    const positions = new Map(model.positions.map((position) => [position.ticker, position]));
    return data.assets.map((asset) => {
      const holding = positions.get(asset.ticker);
      const accountingReliable = !model.health.ambiguousTransactionTickers.includes(asset.ticker);
      return { asset, holding, signal: getStrategySignal(asset, settings, holding?.marketValue ?? 0, holding?.costBasis ?? 0, accountingReliable) };
    });
  }, [data.assets, model.health.ambiguousTransactionTickers, model.positions, settings]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return signals
      .filter(({ asset, signal }) => {
        const matchesFilter = filter === "all" || (filter === "actionable" ? signal.actionAmount > 0 : signal.kind === filter);
        const matchesSearch = !query || asset.ticker.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query);
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => b.signal.strength - a.signal.strength || a.asset.ticker.localeCompare(b.asset.ticker));
  }, [signals, filter, search]);
  const buyCount = signals.filter(({ signal }) => signal.kind === "buy").length;
  const sellCount = signals.filter(({ signal }) => (signal.kind === "sell" || signal.kind === "breakout") && signal.actionAmount > 0).length;
  const breakoutCount = signals.filter(({ signal }) => signal.kind === "breakout").length;
  const buyTotal = signals.reduce((total, { signal }) => total + (signal.kind === "buy" ? signal.actionAmount : 0), 0);
  const sellTotal = signals.reduce((total, { signal }) => total + (signal.kind === "sell" || signal.kind === "breakout" ? signal.actionAmount : 0), 0);

  useEffect(() => {
    if (!showLevels) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowLevels(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showLevels]);

  return (
    <div className="page-stack">
      <DataHealthNotice model={model} />
      <section className="strategy-intro">
        <div><span className="eyebrow"><Sparkles size={14} /> LEITURA DE 12 MESES</span><h2>Radar de compras e vendas</h2><p>Cada cartão separa a parcela sugerida do total necessário para completar a posição.</p></div>
        <button className="strategy-levels-button" type="button" aria-haspopup="dialog" onClick={() => setShowLevels(true)}><SlidersHorizontal size={18} /> Ver níveis e valores</button>
      </section>

      <section className="metrics-grid metrics-grid--three">
        <MetricCard label="Comprar agora" value={String(buyCount)} secondaryValue={`Necessário ${formatCurrency(buyTotal)}`} icon={<TrendingDown size={19} />} helper="Alvo do nível menos o valor comprado" accent="green" />
        <MetricCard label="Sinal de venda" value={String(sellCount)} secondaryValue={`Total ${formatCurrency(sellTotal)}`} icon={<Target size={19} />} helper={`Até ${settings.sellDistanceFromHighPercent}% da máxima anual e rompimentos`} accent="amber" />
        <MetricCard label="Em rompimento" value={String(breakoutCount)} icon={<ArrowUpRight size={19} />} helper="Acima da máxima anual" accent="violet" />
      </section>

      <section className="panel">
        <div className="strategy-toolbar">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ativo" /></label>
          <div className="segmented-control" role="group" aria-label="Filtrar sinais">
            {([['all', 'Todos'], ['actionable', 'Com operação'], ['buy', 'Compra'], ['sell', 'Venda'], ['breakout', 'Rompimento'], ['neutral', 'Neutros']] as Array<[FilterKind, string]>).map(([id, label]) => <button type="button" className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)} key={id}>{label}</button>)}
          </div>
        </div>

        {filtered.length ? <div className="strategy-grid">
          {filtered.map(({ asset, holding, signal }) => {
            const annual = signal.kind === "unavailable" ? null : asset.annual;
            const accountingReliable = !model.health.ambiguousTransactionTickers.includes(asset.ticker);
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
                  <span><small>{signal.kind === "buy" ? "Valor para atingir o nível" : "Próxima operação"}</small><strong>{signal.actionAmount > 0 ? (signal.kind === "buy" ? "COMPRAR" : "VENDER") : "AGUARDAR"}</strong></span>
                  <b>{signal.actionAmount > 0 ? formatCurrency(signal.actionAmount) : "—"}</b>
                </div>
                <div className="strategy-position">
                  <span><small>Comprado</small><strong>{accountingReliable ? formatCurrency(holding?.costBasis ?? 0) : "Indisponível"}</strong></span>
                  <span><small>Atual</small><strong>{formatCurrency(holding?.marketValue ?? 0)}</strong></span>
                  <span className={accountingReliable ? (profit > 0 ? "value--positive" : profit < 0 ? "value--negative" : "") : ""}><small>Lucro</small><strong>{accountingReliable ? formatCurrency(profit) : "Indisponível"}</strong></span>
                </div>
                {annual ? <>
                  <div className="range-track"><i style={{ left: `${rangePosition}%` }} /><span className="range-track__fill" style={{ width: `${rangePosition}%` }} /></div>
                  <div className="range-labels"><span><small>Mínima</small>{formatCurrency(annual.min)}</span><span><small>Média</small>{formatCurrency(annual.average)}</span><span><small>Máxima</small>{formatCurrency(annual.max)}</span></div>
                </> : <div className="range-unavailable">{signal.description}</div>}
                <footer>
                  {rangeDetails ? <span className="strategy-card__range-info"><small>Faixa atual {rangeDetails.label}</small><strong>{formatPercent(rangeDetails.currentPercent / 100)} no intervalo anual</strong><em>Valores do grupo: {rangeDetails.priceLabel}</em></span> : <span>{signal.description}</span>}
                </footer>
              </article>
            );
          })}
        </div> : <EmptyState title="Nenhum sinal encontrado" description="Altere o filtro ou a busca para ver outros ativos." />}
      </section>

      {showLevels && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLevels(false); }}>
          <section className="asset-modal strategy-levels-modal" role="dialog" aria-modal="true" aria-labelledby="strategy-levels-title">
            <header className="asset-modal__header">
              <div>
                <span className="strategy-levels-modal__icon"><SlidersHorizontal size={22} /></span>
                <span><small>CONFIGURAÇÃO ATUAL</small><h2 id="strategy-levels-title">Níveis e valores da estratégia</h2></span>
              </div>
              <button type="button" aria-label="Fechar níveis da estratégia" onClick={() => setShowLevels(false)}><X size={21} /></button>
            </header>

            <div className="strategy-levels-summary">
              <article><WalletCards size={19} /><span><small>Valor mínimo da posição</small><strong>{formatCurrency(settings.minimumPositionValue)}</strong><em>Piso preservado nas vendas</em></span></article>
              <article><WalletCards size={19} /><span><small>Valor máximo da posição</small><strong>{formatCurrency(settings.maximumPositionValue)}</strong><em>Teto considerado nas compras</em></span></article>
              <article><SlidersHorizontal size={19} /><span><small>Faixa negociável</small><strong>{formatCurrency(levelValues.positionRange)}</strong><em>Diferença entre máximo e mínimo</em></span></article>
              <article><Target size={19} /><span><small>Venda mínima</small><strong>{formatCurrency(settings.minimumSaleAmount)}</strong><em>Menor ordem de venda exibida</em></span></article>
            </div>

            <section className="strategy-levels-section">
              <header><TrendingDown size={19} /><span><h3>Níveis de compra</h3><p>A mínima anual representa 0% e a máxima anual representa 100%.</p></span></header>
              <div className="strategy-levels-list strategy-levels-list--buy">
                <article>
                  <span><small>Nível</small><strong>Abaixo da mínima anual</strong></span>
                  <span><small>Faixa da cotação</small><strong>Abaixo de 0%</strong></span>
                  <span className="strategy-levels-list__money"><small>Parcela sugerida</small><strong>{formatCurrency(settings.breakdownBuyAmount)}</strong></span>
                  <span className="strategy-levels-list__money strategy-levels-list__money--total"><small>Posição acumulada</small><strong>{formatCurrency(levelValues.breakdownBuyPositionValue)}</strong></span>
                </article>
                <article>
                  <span><small>Nível</small><strong>Compra forte</strong></span>
                  <span><small>Faixa da cotação</small><strong>{formatPercent(settings.buyZoneLowerPercent / 100)} – {formatPercent(settings.buyZoneMiddlePercent / 100)}</strong></span>
                  <span className="strategy-levels-list__money"><small>Parcela sugerida</small><strong>{formatCurrency(settings.strongBuyAmount)}</strong></span>
                  <span className="strategy-levels-list__money strategy-levels-list__money--total"><small>Posição acumulada</small><strong>{formatCurrency(levelValues.strongBuyPositionValue)}</strong></span>
                </article>
                <article>
                  <span><small>Nível</small><strong>Compra</strong></span>
                  <span><small>Faixa da cotação</small><strong>{formatPercent(settings.buyZoneMiddlePercent / 100)} – {formatPercent(settings.buyZoneUpperPercent / 100)}</strong></span>
                  <span className="strategy-levels-list__money"><small>Parcela sugerida</small><strong>{formatCurrency(settings.moderateBuyAmount)}</strong></span>
                  <span className="strategy-levels-list__money strategy-levels-list__money--total"><small>Posição acumulada</small><strong>{formatCurrency(levelValues.moderateBuyPositionValue)}</strong></span>
                </article>
              </div>
              <p className="strategy-levels-section__note">A posição acumulada parte do mínimo de {formatCurrency(settings.minimumPositionValue)}, soma cada parcela sugerida e nunca ultrapassa o máximo de {formatCurrency(settings.maximumPositionValue)}. Entre 0% e {formatPercent(settings.buyZoneLowerPercent / 100)}, e depois de {formatPercent(settings.buyZoneUpperPercent / 100)} até a zona de venda, a estratégia aguarda.</p>
            </section>

            <section className="strategy-levels-section">
              <header><TrendingUp size={19} /><span><h3>Níveis de venda</h3><p>As porcentagens de venda são aplicadas sobre a faixa negociável de {formatCurrency(levelValues.positionRange)}.</p></span></header>
              <div className="strategy-levels-list strategy-levels-list--sell">
                <article>
                  <span><small>Nível</small><strong>Próxima da máxima</strong></span>
                  <span><small>Gatilho</small><strong>Até {formatPercent(settings.sellDistanceFromHighPercent / 100)} abaixo da máxima</strong></span>
                  <span className="strategy-levels-list__money"><small>Vender {formatPercent(settings.initialSellPercent / 100)} da faixa</small><strong>{formatCurrency(levelValues.initialSellAmount)}</strong></span>
                </article>
                <article>
                  <span><small>Nível</small><strong>Acima da máxima</strong></span>
                  <span><small>Gatilho</small><strong>Rompimento acima de 100%</strong></span>
                  <span className="strategy-levels-list__money"><small>Vender {formatPercent(settings.breakoutSellPercent / 100)} da faixa</small><strong>{formatCurrency(levelValues.breakoutSellAmount)}</strong></span>
                </article>
              </div>
              <p className="strategy-levels-section__note">Os valores de venda são bases calculadas. A operação exibida preserva o piso de {formatCurrency(settings.minimumPositionValue)} e só aparece quando alcança a venda mínima de {formatCurrency(settings.minimumSaleAmount)}.</p>
            </section>

            <p className="asset-modal__note strategy-levels-note">Todos os valores desta tela são calculados com as configurações salvas no navegador. Ao alterar mínimo, máximo, percentuais ou parcelas em Configurações, estes níveis são atualizados automaticamente.</p>
          </section>
        </div>
      )}
    </div>
  );
}
