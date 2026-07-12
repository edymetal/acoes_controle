import { useMemo, useState } from "react";
import { BadgeDollarSign, Filter, HandCoins, Search, ShoppingCart } from "lucide-react";
import { CryptoLogo, EmptyState, MetricCard, Section, Value } from "../../components/Ui";
import { formatCurrency, formatDate, formatNumber } from "../../lib/format";
import type { PortfolioModel, TransactionType } from "../../types";

export function CryptoHistory({ model }: { model: PortfolioModel }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [ticker, setTicker] = useState("");
  const tickers = useMemo(() => [...new Set(model.transactions.map((item) => item.ticker))].sort(), [model.transactions]);
  const rows = useMemo(() => {
    const query = search.trim().toUpperCase();
    return model.transactions.filter((item) => (!query || item.ticker.includes(query)) && (!ticker || item.ticker === ticker) && (type === "all" || item.type === type));
  }, [model.transactions, search, ticker, type]);

  return <div className="page-stack">
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label="Total comprado" value={formatCurrency(model.metrics.historicalPurchases)} icon={<ShoppingCart size={19} />} helper={`${model.transactions.filter((item) => item.type === "buy").length} compras`} accent="blue" />
      <MetricCard label="Total vendido" value={formatCurrency(model.metrics.historicalSales)} icon={<HandCoins size={19} />} helper={`${model.transactions.filter((item) => item.type === "sell").length} vendas`} accent="violet" />
      <MetricCard label="Lucro realizado" value={formatCurrency(model.metrics.realizedProfit)} icon={<BadgeDollarSign size={19} />} helper="Custo médio descontado" change={model.metrics.realizedProfit} accent="green" />
    </section>
    <Section title="Histórico de cripto" subtitle="Compras e vendas de Bitcoin e Ethereum processadas exclusivamente a partir da aba Cripto">
      <div className="toolbar toolbar--history">
        <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar código da cripto" /></label>
        <label className="select-field"><Filter size={17} /><select value={type} onChange={(event) => setType(event.target.value as "all" | TransactionType)}><option value="all">Compras e vendas</option><option value="buy">Somente compras</option><option value="sell">Somente vendas</option></select></label>
        <label className="select-field"><select aria-label="Filtrar por cripto" value={ticker} onChange={(event) => setTicker(event.target.value)}><option value="">Todas as criptos</option>{tickers.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="filter-summary"><span><strong>{rows.length}</strong> movimentações de cripto</span></div>
      {rows.length ? <div className="table-wrap"><table className="history-table"><thead><tr><th>Data</th><th>Tipo</th><th>Cripto</th><th>Quantidade</th><th>Preço unitário</th><th>Valor total</th><th>Custo descontado</th><th>Lucro realizado</th></tr></thead><tbody>
        {rows.map((item) => <tr key={item.id}><td>{formatDate(item.date)}</td><td><span className={`transaction-type transaction-type--${item.type}`}>{item.type === "buy" ? "Compra" : "Venda"}</span></td><td><div className="asset-cell"><CryptoLogo ticker={item.ticker} size="compact" /><strong>{item.ticker}</strong></div></td><td>{formatNumber(item.quantity, 8)}</td><td>{formatCurrency(item.unitPrice)}</td><td><strong>{formatCurrency(item.total)}</strong></td><td>{item.type === "sell" && item.costBasis !== null ? formatCurrency(item.costBasis) : <span className="table-dash">—</span>}</td><td>{item.type === "sell" && item.realizedProfit !== null ? <Value value={item.realizedProfit}><strong>{formatCurrency(item.realizedProfit)}</strong></Value> : <span className="table-dash">—</span>}</td></tr>)}
      </tbody></table></div> : <EmptyState title="Nenhuma movimentação encontrada" description="Remova ou ajuste os filtros aplicados." />}
    </Section>
  </div>;
}
