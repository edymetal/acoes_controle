import { useMemo, useState } from "react";
import { BriefcaseBusiness, Search, SlidersHorizontal, TrendingUp, WalletCards } from "lucide-react";
import { DataHealthNotice, EmptyState, MetricCard, Section, StockLogo, Value } from "../components/Ui";
import { getPositionSortValue, PortfolioTableHead, type PositionSortKey } from "../components/PortfolioTableHead";
import { useSortableTable } from "../components/SortableTable";
import { formatCurrency, formatNumber, formatPercent } from "../lib/format";
import type { PortfolioModel } from "../types";

export function Portfolio({ model }: { model: PortfolioModel }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("market-desc");
  const positions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return model.positions
      .filter((item) => !query || item.ticker.toLowerCase().includes(query) || item.name.toLowerCase().includes(query) || item.sector.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sort === "pnl-desc") return b.unrealizedPercent - a.unrealizedPercent;
        if (sort === "pnl-asc") return a.unrealizedPercent - b.unrealizedPercent;
        if (sort === "ticker") return a.ticker.localeCompare(b.ticker);
        return b.marketValue - a.marketValue;
      });
  }, [model.positions, search, sort]);
  const {
    requestSort,
    resetSort,
    sortedRows: sortedPositions,
    sortConfig,
  } = useSortableTable<typeof positions[number], PositionSortKey>(positions, getPositionSortValue);
  const valuationComplete = model.health.valuation === "complete";
  const accountingComplete = model.health.accounting === "complete";
  const financialResultsComplete = valuationComplete && accountingComplete;

  return (
    <div className="page-stack">
      <DataHealthNotice model={model} />
      <section className="metrics-grid metrics-grid--three">
        <MetricCard label="Custo das posições" value={accountingComplete ? formatCurrency(model.metrics.openCost) : "Indisponível"} icon={<WalletCards size={19} />} helper={accountingComplete ? "Base de custo em aberto" : "Ordem das operações ambígua"} accent="blue" />
        <MetricCard label={financialResultsComplete ? "Valor de mercado" : "Valor conhecido (parcial)"} value={formatCurrency(model.metrics.marketValue)} icon={<BriefcaseBusiness size={19} />} helper={`${model.metrics.openPositions} posições atuais`} accent="violet" />
        <MetricCard label="Resultado em aberto" value={financialResultsComplete ? formatCurrency(model.metrics.unrealizedProfit) : "Indisponível"} icon={<TrendingUp size={19} />} helper={financialResultsComplete ? formatPercent(model.metrics.openReturn) : "Base financeira incompleta"} change={financialResultsComplete ? model.metrics.unrealizedProfit : undefined} accent="green" />
      </section>

      <Section title="Posições atuais" subtitle="Custo médio móvel e marcação pela cotação mais recente">
        <div className="toolbar">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ticker, empresa ou setor" /></label>
          <label className="select-field"><SlidersHorizontal size={16} /><select value={sort} onChange={(event) => { setSort(event.target.value); resetSort(); }}><option value="market-desc">Maior posição</option><option value="pnl-desc">Maior rentabilidade</option><option value="pnl-asc">Menor rentabilidade</option><option value="ticker">Ticker A–Z</option></select></label>
        </div>

        {positions.length ? (
          <div className="table-wrap">
            <table className="portfolio-table">
              <PortfolioTableHead assetLabel="Ativo" quantityLabel="Quantidade" sortConfig={sortConfig} onSort={requestSort} />
              <tbody>
                {sortedPositions.map((position) => (
                  <tr key={position.ticker}>
                    <td><div className="asset-cell"><StockLogo ticker={position.ticker} /><span><strong>{position.ticker}</strong><small>{position.name} · {position.sector}</small></span></div></td>
                    <td>{formatNumber(position.quantity, 6)}</td>
                    <td>{accountingComplete ? formatCurrency(position.averageCost) : <span className="data-unavailable">Indisponível</span>}</td>
                    <td>{position.quoteAvailable ? formatCurrency(position.currentPrice) : <span className="data-unavailable">Indisponível</span>}</td>
                    <td>{accountingComplete ? formatCurrency(position.costBasis) : <span className="data-unavailable">Indisponível</span>}</td>
                    <td>{position.quoteAvailable && position.accountingReliable ? <strong>{formatCurrency(position.marketValue)}</strong> : <span className="data-unavailable">Indisponível</span>}</td>
                    <td>{position.quoteAvailable && position.accountingReliable ? <div className="allocation-cell"><span>{formatPercent(position.allocation)}</span><span className="mini-progress"><i style={{ width: `${Math.max(3, position.allocation * 100)}%` }} /></span></div> : <span className="data-unavailable">—</span>}</td>
                    <td>{position.quoteAvailable && position.accountingReliable ? <Value value={position.unrealized}><strong>{formatCurrency(position.unrealized)}</strong><small>{formatPercent(position.unrealizedPercent)}</small></Value> : <span className="data-unavailable">Indisponível</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Nenhuma posição encontrada" description="Ajuste a busca para visualizar outros ativos." />}
      </Section>
    </div>
  );
}
