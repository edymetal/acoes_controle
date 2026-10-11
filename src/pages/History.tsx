import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Filter,
  HandCoins,
  Layers3,
  Search,
  ShoppingCart,
} from "lucide-react";
import { StockAssetModal } from "../components/StockAssetModal";
import { SortableHeader, useSortableTable, type SortValue } from "../components/SortableTable";
import { EmptyState, MetricCard, Section, StockLogo, Value } from "../components/Ui";
import { formatCurrency, formatDate, formatNumber, formatPercent, formatTransactionDate } from "../lib/format";
import { getStockDetailsAsset } from "../lib/stockDetails";
import type { PortfolioData, PortfolioModel, ProcessedTransaction, TransactionType } from "../types";

function StackedHeader({ label }: { label: string }) {
  return (
    <span className="stacked-table-header">
      {label.split(" ").map((word) => <span key={word}>{word}</span>)}
    </span>
  );
}

const PAGE_SIZE = 15;

interface HistoryRow extends ProcessedTransaction {
  operationCount: number;
  startDate: string;
  endDate: string;
}

type HistorySortKey =
  | "costBasis"
  | "date"
  | "operationCount"
  | "quantity"
  | "realizedProfit"
  | "ticker"
  | "total"
  | "type"
  | "unitPrice";

function getHistorySortValue(item: HistoryRow, key: HistorySortKey): SortValue {
  if (key === "date") return item.operationCount === 1 ? `${item.endDate}T${item.time ?? ""}` : item.endDate;
  if (key === "type") return item.type === "buy" ? "Compra" : "Venda";
  return item[key];
}

export function History({ data, model }: { data: PortfolioData; model: PortfolioModel }) {
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const accountingComplete = model.health.accounting === "complete";
  const realizedProfitShare = accountingComplete && model.health.valuation === "complete" && model.metrics.totalProfit !== 0
    ? model.metrics.realizedProfit / model.metrics.totalProfit
    : null;

  const tickers = useMemo(
    () => [...new Set(model.transactions.map((item) => item.ticker))].sort(),
    [model.transactions],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toUpperCase();
    return model.transactions.filter((item) =>
      (!ticker || item.ticker === ticker)
      && (type === "all" || item.type === type)
      && (!query || item.ticker.includes(query))
      && (!startDate || item.date >= startDate)
      && (!endDate || item.date <= endDate),
    );
  }, [model.transactions, ticker, type, search, startDate, endDate]);

  const displayRows = useMemo<HistoryRow[]>(() => {
    if (!grouped) {
      return filtered.map((item) => ({
        ...item,
        operationCount: 1,
        startDate: item.date,
        endDate: item.date,
      }));
    }

    const groups = new Map<string, HistoryRow>();
    for (const item of filtered) {
      const key = `${item.type}-${item.ticker}`;
      const current = groups.get(key);
      if (!current) {
        groups.set(key, {
          ...item,
          id: `group-${key}`,
          operationCount: 1,
          startDate: item.date,
          endDate: item.date,
        });
        continue;
      }

      current.quantity += item.quantity;
      current.total += item.total;
      current.unitPrice = current.total / current.quantity;
      current.operationCount += 1;
      current.startDate = item.date < current.startDate ? item.date : current.startDate;
      current.endDate = item.date > current.endDate ? item.date : current.endDate;
      current.date = current.endDate;
      if (item.type === "sell") {
        current.costBasis = (current.costBasis ?? 0) + (item.costBasis ?? 0);
        current.realizedProfit = (current.realizedProfit ?? 0) + (item.realizedProfit ?? 0);
      }
    }

    return [...groups.values()].sort(
      (a, b) => b.endDate.localeCompare(a.endDate) || a.ticker.localeCompare(b.ticker),
    );
  }, [filtered, grouped]);
  const { requestSort, resetSort, sortedRows: sortedDisplayRows, sortConfig } =
    useSortableTable<HistoryRow, HistorySortKey>(displayRows, getHistorySortValue);

  const totals = useMemo(() => ({
    purchases: filtered
      .filter((item) => item.type === "buy")
      .reduce((sum, item) => sum + item.total, 0),
    sales: filtered
      .filter((item) => item.type === "sell")
      .reduce((sum, item) => sum + item.total, 0),
    realized: filtered
      .filter((item) => item.type === "sell")
      .reduce((sum, item) => sum + (item.realizedProfit ?? 0), 0),
  }), [filtered]);
  const filteredAccountingComplete = filtered.every(
    (item) => !model.health.ambiguousTransactionTickers.includes(item.ticker),
  );

  const selectedAsset = getStockDetailsAsset(data, model, selectedTicker);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const visible = sortedDisplayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const handleSort = (key: HistorySortKey) => {
    requestSort(key);
    setPage(1);
  };

  useEffect(() => setPage(1), [ticker, type, search, startDate, endDate, grouped]);

  const formatPeriod = (item: HistoryRow) => item.operationCount === 1
    ? formatTransactionDate(item.endDate, item.time)
    : item.startDate === item.endDate
      ? formatDate(item.endDate)
    : `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`;

  return (
    <div className="page-stack">
      <section className="metrics-grid metrics-grid--three">
        <MetricCard label="Total comprado" value={formatCurrency(model.metrics.historicalPurchases)} icon={<ShoppingCart size={19} />} helper={`${model.transactions.filter((item) => item.type === "buy").length} compras`} accent="blue" />
        <MetricCard label="Total vendido" value={formatCurrency(model.metrics.historicalSales)} icon={<HandCoins size={19} />} helper={`${model.transactions.filter((item) => item.type === "sell").length} vendas`} accent="violet" />
        <MetricCard label="Lucro realizado" value={accountingComplete ? formatCurrency(model.metrics.realizedProfit) : "Indisponível"} icon={<BadgeDollarSign size={19} />} helper={accountingComplete ? (realizedProfitShare === null ? "Após descontar o custo das compras" : `${formatPercent(realizedProfitShare)} do lucro total`) : "Ordem das operações ambígua"} change={accountingComplete ? model.metrics.realizedProfit : undefined} accent="green" />
      </section>

      <Section title="Histórico de compras e vendas" subtitle="Consulte, agrupe e analise todas as movimentações registradas">
        <div className="toolbar toolbar--history">
          <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ticker" /></label>
          <label className="select-field"><Filter size={17} /><select value={type} onChange={(event) => setType(event.target.value as "all" | TransactionType)}><option value="all">Compras e vendas</option><option value="buy">Somente compras</option><option value="sell">Somente vendas</option></select></label>
          <label className="select-field"><select aria-label="Filtrar por ticker" value={ticker} onChange={(event) => setTicker(event.target.value)}><option value="">Todos os ativos</option>{tickers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button className={`group-toggle ${grouped ? "active" : ""}`} type="button" aria-pressed={grouped} onClick={() => { setGrouped((value) => !value); resetSort(); }}><Layers3 size={17} /> Agrupar por ação</button>
          <label className="date-field"><span>De</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label className="date-field"><span>Até</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>

        <div className="filter-summary filter-summary--financial">
          <span><strong>{displayRows.length}</strong> {grouped ? "grupos" : "movimentações"}</span>
          <span>Compras filtradas <strong>{formatCurrency(totals.purchases)}</strong></span>
          <span>Vendas filtradas <strong>{formatCurrency(totals.sales)}</strong></span>
          <span>Lucro filtrado {filteredAccountingComplete ? <Value value={totals.realized}><strong>{formatCurrency(totals.realized)}</strong></Value> : <strong>Indisponível</strong>}</span>
        </div>

        {visible.length ? (
          <div className="table-wrap table-wrap--stock-history">
            <table className={`history-table history-table--stocks ${grouped ? "history-table--grouped" : ""}`}>
              <thead><tr>
                <SortableHeader sortKey="date" sortConfig={sortConfig} onSort={handleSort}>{grouped ? "Período" : "Data"}</SortableHeader>
                <SortableHeader sortKey="type" sortConfig={sortConfig} onSort={handleSort}>Tipo</SortableHeader>
                <SortableHeader sortKey="ticker" sortConfig={sortConfig} onSort={handleSort}>Ativo</SortableHeader>
                {grouped && <SortableHeader sortKey="operationCount" sortConfig={sortConfig} onSort={handleSort}>Operações</SortableHeader>}
                <SortableHeader sortKey="quantity" sortConfig={sortConfig} onSort={handleSort}>Quantidade</SortableHeader>
                <SortableHeader sortKey="unitPrice" sortConfig={sortConfig} onSort={handleSort}><StackedHeader label={grouped ? "Preço médio" : "Preço unitário"} /></SortableHeader>
                <SortableHeader sortKey="total" sortConfig={sortConfig} onSort={handleSort}><StackedHeader label="Valor total" /></SortableHeader>
                <SortableHeader sortKey="costBasis" sortConfig={sortConfig} onSort={handleSort}><StackedHeader label="Custo descontado" /></SortableHeader>
                <SortableHeader sortKey="realizedProfit" sortConfig={sortConfig} onSort={handleSort}><StackedHeader label="Lucro realizado" /></SortableHeader>
              </tr></thead>
              <tbody>{visible.map((item) => (
                <tr key={item.id}>
                  <td>{formatPeriod(item)}</td>
                  <td><span className={`transaction-type transaction-type--${item.type}`}>{item.type === "buy" ? "Compra" : "Venda"}</span></td>
                  <td><button className="ticker-link history-asset-link" type="button" aria-haspopup="dialog" aria-label={`Abrir gráfico e movimentações de ${item.ticker}`} onClick={() => setSelectedTicker(item.ticker)}><StockLogo ticker={item.ticker} /><span>{item.ticker}</span></button></td>
                  {grouped && <td><span className="operation-count">{item.operationCount}</span></td>}
                  <td>{formatNumber(item.quantity, 8)}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td><strong>{formatCurrency(item.total)}</strong></td>
                  <td>{item.type === "sell" && item.costBasis !== null ? formatCurrency(item.costBasis) : <span className="table-dash">—</span>}</td>
                  <td>{item.type === "sell" && item.realizedProfit !== null ? <Value value={item.realizedProfit}><strong>{formatCurrency(item.realizedProfit)}</strong></Value> : <span className="table-dash">—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Nenhuma movimentação encontrada" description="Remova ou ajuste os filtros aplicados." />}

        <footer className="pagination"><span>Página {page} de {totalPages}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={16} /> Anterior</button><button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Próxima <ArrowRight size={16} /></button></div></footer>
      </Section>

      {selectedAsset && <StockAssetModal key={selectedAsset.ticker} asset={selectedAsset} model={model} generatedAt={data.generatedAt} contextLabel="MOVIMENTAÇÕES" onClose={() => setSelectedTicker(null)} />}
    </div>
  );
}
