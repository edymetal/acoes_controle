import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Filter, HandCoins, Search, ShoppingCart, WalletCards, X } from "lucide-react";
import { useSortableTable } from "../../components/SortableTable";
import { getTransactionSortValue, TransactionTableHead, type TransactionSortKey } from "../../components/TransactionTableHead";
import { EmptyState, MetricCard, Section, Value } from "../../components/Ui";
import { formatBrl, formatNumber, formatTransactionDate, formatUsdFromBrl } from "../../lib/format";
import type { PortfolioModel, TransactionType } from "../../types";

export function FiiHistory({ model, usdRate }: { model: PortfolioModel; usdRate: number | null }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [ticker, setTicker] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const accountingComplete = model.health.accounting === "complete";
  const tickers = useMemo(() => [...new Set(model.transactions.map((item) => item.ticker))].sort(), [model.transactions]);
  const rows = useMemo(() => {
    const query = search.trim().toUpperCase();
    return model.transactions.filter((item) => (!query || item.ticker.includes(query)) && (!ticker || item.ticker === ticker) && (type === "all" || item.type === type));
  }, [model.transactions, search, ticker, type]);
  const { requestSort, sortedRows, sortConfig } =
    useSortableTable<typeof rows[number], TransactionSortKey>(rows, getTransactionSortValue);

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
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedTicker(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedTicker]);

  return <div className="page-stack">
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label="Total comprado" value={formatBrl(model.metrics.historicalPurchases)} secondaryValue={formatUsdFromBrl(model.metrics.historicalPurchases, usdRate)} icon={<ShoppingCart size={19} />} helper={`${model.transactions.filter((item) => item.type === "buy").length} compras`} accent="blue" />
      <MetricCard label="Total vendido" value={formatBrl(model.metrics.historicalSales)} secondaryValue={formatUsdFromBrl(model.metrics.historicalSales, usdRate)} icon={<HandCoins size={19} />} helper={`${model.transactions.filter((item) => item.type === "sell").length} vendas`} accent="violet" />
      <MetricCard label="Lucro realizado" value={accountingComplete ? formatBrl(model.metrics.realizedProfit) : "Indisponível"} secondaryValue={accountingComplete ? formatUsdFromBrl(model.metrics.realizedProfit, usdRate) : undefined} icon={<BadgeDollarSign size={19} />} helper={accountingComplete ? "Custo médio descontado" : "Ordem das operações ambígua"} change={accountingComplete ? model.metrics.realizedProfit : undefined} accent="green" />
    </section>
    <Section title="Histórico de FIIs" subtitle="Compras e vendas processadas exclusivamente a partir da aba FII Hist">
      <div className="toolbar toolbar--history">
        <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar código do fundo" /></label>
        <label className="select-field"><Filter size={17} /><select value={type} onChange={(event) => setType(event.target.value as "all" | TransactionType)}><option value="all">Compras e vendas</option><option value="buy">Somente compras</option><option value="sell">Somente vendas</option></select></label>
        <label className="select-field"><select aria-label="Filtrar por fundo" value={ticker} onChange={(event) => setTicker(event.target.value)}><option value="">Todos os fundos</option>{tickers.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="filter-summary"><span><strong>{rows.length}</strong> movimentações de FIIs</span></div>
      {rows.length ? <div className="table-wrap"><table className="history-table"><TransactionTableHead assetLabel="Fundo" quantityLabel="Cotas" sortConfig={sortConfig} onSort={requestSort} /><tbody>
        {sortedRows.map((item) => <tr key={item.id}><td>{formatTransactionDate(item.date, item.time)}</td><td><span className={`transaction-type transaction-type--${item.type}`}>{item.type === "buy" ? "Compra" : "Venda"}</span></td><td><button className="ticker-link" type="button" onClick={() => setSelectedTicker(item.ticker)}>{item.ticker}</button></td><td>{formatNumber(item.quantity, 4)}</td><td>{formatBrl(item.unitPrice)}</td><td><strong>{formatBrl(item.total)}</strong></td><td>{item.type === "sell" && item.costBasis !== null ? formatBrl(item.costBasis) : <span className="table-dash">—</span>}</td><td>{item.type === "sell" && item.realizedProfit !== null ? <Value value={item.realizedProfit}><strong>{formatBrl(item.realizedProfit)}</strong></Value> : <span className="table-dash">—</span>}</td></tr>)}
      </tbody></table></div> : <EmptyState title="Nenhuma movimentação encontrada" description="Remova ou ajuste os filtros aplicados." />}
    </Section>
    {selectedSummary && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTicker(null); }}>
      <section className="asset-modal" role="dialog" aria-modal="true" aria-labelledby="fii-modal-title">
        <header className="asset-modal__header">
          <div><span className="ticker-avatar ticker-avatar--fii">{selectedSummary.ticker.slice(0, 2)}</span><span><small>RESUMO HISTÓRICO</small><h2 id="fii-modal-title">{selectedSummary.ticker} · {selectedSummary.name}</h2></span></div>
          <button type="button" aria-label="Fechar resumo do fundo" onClick={() => setSelectedTicker(null)}><X size={21} /></button>
        </header>
        <div className="asset-modal__metrics">
          <article><ShoppingCart size={20} /><span><small>Total comprado</small><strong>{formatBrl(selectedSummary.purchaseTotal)}</strong><em>{selectedSummary.purchaseCount} operações · {formatNumber(selectedSummary.purchaseQuantity, 4)} cotas</em></span></article>
          <article><HandCoins size={20} /><span><small>Total vendido</small><strong>{formatBrl(selectedSummary.saleTotal)}</strong><em>{selectedSummary.saleCount} operações · {formatNumber(selectedSummary.saleQuantity, 4)} cotas</em></span></article>
          <article className="asset-modal__profit"><BadgeDollarSign size={20} /><span><small>Lucro realizado</small>{selectedSummary.accountingReliable && selectedSummary.realizedProfit !== null ? <Value value={selectedSummary.realizedProfit}><strong>{formatBrl(selectedSummary.realizedProfit)}</strong></Value> : <strong>Indisponível</strong>}<em>{selectedSummary.accountingReliable ? "Valor já descontado do custo de compra" : "Informe a ordem das operações do mesmo dia"}</em></span></article>
          <article><WalletCards size={20} /><span><small>Posição atual</small><strong>{selectedSummary.accountingReliable ? `${formatNumber(selectedSummary.openQuantity, 4)} cotas` : "Indisponível"}</strong><em>{selectedSummary.quoteAvailable ? `${formatBrl(selectedSummary.marketValue)} em valor de mercado` : selectedSummary.accountingReliable ? "Cotação atual indisponível" : "Ordem das operações do mesmo dia não informada"}</em></span></article>
        </div>
        <p className="asset-modal__note">O lucro realizado usa o custo médio disponível na data de cada venda. A posição atual não interfere no resultado das vendas já concluídas.</p>
      </section>
    </div>}
  </div>;
}
