import { useMemo, useState } from "react";
import { BriefcaseBusiness, Search, SlidersHorizontal, TrendingUp, WalletCards } from "lucide-react";
import { getPositionSortValue, PortfolioTableHead, type PositionSortKey } from "../../components/PortfolioTableHead";
import { useSortableTable } from "../../components/SortableTable";
import { DataHealthNotice, EmptyState, MetricCard, Section, Value } from "../../components/Ui";
import { formatBrl, formatNumber, formatPercent, formatUsdFromBrl } from "../../lib/format";
import type { PortfolioModel } from "../../types";

export function FiiPortfolio({ model, usdRate }: { model: PortfolioModel; usdRate: number | null }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("market-desc");
  const positions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return model.positions.filter((item) => !query || item.ticker.toLowerCase().includes(query) || item.name.toLowerCase().includes(query) || item.sector.toLowerCase().includes(query)).sort((a, b) => {
      if (sort === "pnl-desc") return b.unrealizedPercent - a.unrealizedPercent;
      if (sort === "pnl-asc") return a.unrealizedPercent - b.unrealizedPercent;
      if (sort === "ticker") return a.ticker.localeCompare(b.ticker);
      return b.marketValue - a.marketValue;
    });
  }, [model.positions, search, sort]);
  const { requestSort, resetSort, sortedRows: sortedPositions, sortConfig } =
    useSortableTable<typeof positions[number], PositionSortKey>(positions, getPositionSortValue);
  const valuationComplete = model.health.valuation === "complete";
  const accountingComplete = model.health.accounting === "complete";
  const financialResultsComplete = valuationComplete && accountingComplete;

  return <div className="page-stack">
    <DataHealthNotice model={model} showAnnual={false} />
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label="Custo das posições" value={accountingComplete ? formatBrl(model.metrics.openCost) : "Indisponível"} secondaryValue={accountingComplete ? formatUsdFromBrl(model.metrics.openCost, usdRate) : undefined} icon={<WalletCards size={19} />} helper={accountingComplete ? "Base de custo das cotas" : "Ordem das operações ambígua"} accent="blue" />
      <MetricCard label={financialResultsComplete ? "Valor de mercado" : "Valor conhecido (parcial)"} value={formatBrl(model.metrics.marketValue)} secondaryValue={formatUsdFromBrl(model.metrics.marketValue, usdRate)} icon={<BriefcaseBusiness size={19} />} helper={`${model.metrics.openPositions} fundos na carteira`} accent="violet" />
      <MetricCard label="Resultado em aberto" value={financialResultsComplete ? formatBrl(model.metrics.unrealizedProfit) : "Indisponível"} secondaryValue={financialResultsComplete ? formatUsdFromBrl(model.metrics.unrealizedProfit, usdRate) : undefined} icon={<TrendingUp size={19} />} helper={financialResultsComplete ? formatPercent(model.metrics.openReturn) : "Base financeira incompleta"} change={financialResultsComplete ? model.metrics.unrealizedProfit : undefined} accent="green" />
    </section>
    <Section title="Posições em FIIs" subtitle="Custo médio móvel e cotação atual em reais">
      <div className="toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar fundo, nome ou segmento" /></label>
        <label className="select-field"><SlidersHorizontal size={16} /><select value={sort} onChange={(event) => { setSort(event.target.value); resetSort(); }}><option value="market-desc">Maior posição</option><option value="pnl-desc">Maior rentabilidade</option><option value="pnl-asc">Menor rentabilidade</option><option value="ticker">Código A–Z</option></select></label>
      </div>
      {positions.length ? <div className="table-wrap"><table className="portfolio-table"><PortfolioTableHead assetLabel="Fundo" quantityLabel="Cotas" sortConfig={sortConfig} onSort={requestSort} /><tbody>
        {sortedPositions.map((position) => <tr key={position.ticker}><td><div className="asset-cell"><span className="ticker-avatar ticker-avatar--fii">{position.ticker.slice(0, 2)}</span><span><strong>{position.ticker}</strong><small>{position.name} · {position.sector}</small></span></div></td><td>{formatNumber(position.quantity, 4)}</td><td>{accountingComplete ? formatBrl(position.averageCost) : <span className="data-unavailable">Indisponível</span>}</td><td>{position.quoteAvailable ? formatBrl(position.currentPrice) : <span className="data-unavailable">Indisponível</span>}</td><td>{accountingComplete ? formatBrl(position.costBasis) : <span className="data-unavailable">Indisponível</span>}</td><td>{position.quoteAvailable && position.accountingReliable ? <strong>{formatBrl(position.marketValue)}</strong> : <span className="data-unavailable">Indisponível</span>}</td><td>{position.quoteAvailable && position.accountingReliable ? <div className="allocation-cell"><span>{formatPercent(position.allocation)}</span><span className="mini-progress"><i style={{ width: `${Math.max(3, position.allocation * 100)}%` }} /></span></div> : <span className="data-unavailable">—</span>}</td><td>{position.quoteAvailable && position.accountingReliable ? <Value value={position.unrealized}><strong>{formatBrl(position.unrealized)}</strong><small>{formatPercent(position.unrealizedPercent)}</small></Value> : <span className="data-unavailable">Indisponível</span>}</td></tr>)}
      </tbody></table></div> : <EmptyState title="Nenhum FII encontrado" description="Ajuste a busca para visualizar outros fundos." />}
    </Section>
  </div>;
}
