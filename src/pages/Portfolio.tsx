import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  HandCoins,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { DataHealthNotice, EmptyState, MetricCard, Section, StockLogo, Value } from "../components/Ui";
import { getPositionSortValue, PortfolioTableHead, type PositionSortKey } from "../components/PortfolioTableHead";
import { useSortableTable } from "../components/SortableTable";
import { formatCurrency, formatNumber, formatPercent } from "../lib/format";
import type { PortfolioModel } from "../types";

export function Portfolio({ model }: { model: PortfolioModel }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("market-desc");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
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

  const selectedSummary = useMemo(() => {
    if (!selectedTicker) return null;
    const items = model.transactions.filter((item) => item.ticker === selectedTicker);
    const purchases = items.filter((item) => item.type === "buy");
    const sales = items.filter((item) => item.type === "sell");
    const position = model.positions.find((item) => item.ticker === selectedTicker);
    const accountingReliable = !model.health.ambiguousTransactionTickers.includes(selectedTicker);
    return {
      ticker: selectedTicker,
      name: position?.name ?? selectedTicker,
      purchaseTotal: purchases.reduce((sum, item) => sum + item.total, 0),
      saleTotal: sales.reduce((sum, item) => sum + item.total, 0),
      realizedProfit: accountingReliable
        ? sales.reduce((sum, item) => sum + (item.realizedProfit ?? 0), 0)
        : null,
      accountingReliable,
      purchaseQuantity: purchases.reduce((sum, item) => sum + item.quantity, 0),
      saleQuantity: sales.reduce((sum, item) => sum + item.quantity, 0),
      purchaseCount: purchases.length,
      saleCount: sales.length,
      openQuantity: position?.quantity ?? 0,
      marketValue: accountingReliable ? position?.marketValue ?? 0 : 0,
      quoteAvailable: accountingReliable && (position?.quoteAvailable ?? true),
    };
  }, [model.health.ambiguousTransactionTickers, model.positions, model.transactions, selectedTicker]);

  useEffect(() => {
    if (!selectedTicker) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTicker(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedTicker]);

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
                    <td><button className="asset-cell portfolio-asset-link" type="button" aria-haspopup="dialog" aria-label={`Abrir resumo de ${position.name}`} onClick={() => setSelectedTicker(position.ticker)}><StockLogo ticker={position.ticker} /><span><strong>{position.ticker}</strong><small>{position.name} · {position.sector}</small></span></button></td>
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

      {selectedSummary && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTicker(null); }}>
          <section className="asset-modal" role="dialog" aria-modal="true" aria-labelledby="portfolio-asset-modal-title">
            <header className="asset-modal__header">
              <div><StockLogo ticker={selectedSummary.ticker} /><span><small>RESUMO HISTÓRICO</small><h2 id="portfolio-asset-modal-title">{selectedSummary.ticker} · {selectedSummary.name}</h2></span></div>
              <button type="button" aria-label="Fechar resumo da ação" onClick={() => setSelectedTicker(null)}><X size={21} /></button>
            </header>
            <div className="asset-modal__metrics">
              <article><ShoppingCart size={20} /><span><small>Total comprado</small><strong>{formatCurrency(selectedSummary.purchaseTotal)}</strong><em>{selectedSummary.purchaseCount} operações · {formatNumber(selectedSummary.purchaseQuantity, 6)} ações</em></span></article>
              <article><HandCoins size={20} /><span><small>Total vendido</small><strong>{formatCurrency(selectedSummary.saleTotal)}</strong><em>{selectedSummary.saleCount} operações · {formatNumber(selectedSummary.saleQuantity, 6)} ações</em></span></article>
              <article className="asset-modal__profit"><BadgeDollarSign size={20} /><span><small>Lucro realizado</small>{selectedSummary.accountingReliable && selectedSummary.realizedProfit !== null ? <Value value={selectedSummary.realizedProfit}><strong>{formatCurrency(selectedSummary.realizedProfit)}</strong></Value> : <strong>Indisponível</strong>}<em>{selectedSummary.accountingReliable ? "Valor já descontado do custo de compra" : "Informe a ordem das operações do mesmo dia"}</em></span></article>
              <article><WalletCards size={20} /><span><small>Posição atual</small><strong>{selectedSummary.accountingReliable ? `${formatNumber(selectedSummary.openQuantity, 6)} ações` : "Indisponível"}</strong><em>{selectedSummary.quoteAvailable ? `${formatCurrency(selectedSummary.marketValue)} em valor de mercado` : selectedSummary.accountingReliable ? "Cotação atual indisponível" : "Ordem das operações do mesmo dia não informada"}</em></span></article>
            </div>
            <p className="asset-modal__note">O lucro realizado usa o custo médio disponível na data de cada venda. A posição atual não interfere no resultado das vendas já concluídas.</p>
          </section>
        </div>
      )}
    </div>
  );
}
