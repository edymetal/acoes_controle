import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Filter, Search } from "lucide-react";
import { EmptyState, Section } from "../components/Ui";
import { formatCurrency, formatDate, formatNumber } from "../lib/format";
import type { PortfolioModel, TransactionType } from "../types";

const PAGE_SIZE = 15;

export function History({ model }: { model: PortfolioModel }) {
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const tickers = useMemo(() => [...new Set(model.transactions.map((item) => item.ticker))].sort(), [model.transactions]);
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredTotal = filtered.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => setPage(1), [ticker, type, search, startDate, endDate]);

  return (
    <div className="page-stack">
      <Section title="Histórico de compras e vendas" subtitle="Consulte todas as movimentações registradas na planilha">
        <div className="toolbar toolbar--history">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ticker" /></label>
          <label className="select-field"><Filter size={16} /><select value={type} onChange={(event) => setType(event.target.value as "all" | TransactionType)}><option value="all">Compras e vendas</option><option value="buy">Somente compras</option><option value="sell">Somente vendas</option></select></label>
          <label className="select-field"><select aria-label="Filtrar por ticker" value={ticker} onChange={(event) => setTicker(event.target.value)}><option value="">Todos os ativos</option>{tickers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="date-field"><span>De</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label className="date-field"><span>Até</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>

        <div className="filter-summary"><span><strong>{filtered.length}</strong> movimentações</span><span>Volume filtrado <strong>{formatCurrency(filteredTotal)}</strong></span></div>

        {visible.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Ativo</th><th>Quantidade</th><th>Preço unitário</th><th>Valor total</th></tr></thead>
              <tbody>{visible.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td><span className={`transaction-type transaction-type--${item.type}`}>{item.type === "buy" ? "Compra" : "Venda"}</span></td>
                  <td><strong>{item.ticker}</strong></td>
                  <td>{formatNumber(item.quantity, 8)}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td><strong>{formatCurrency(item.total)}</strong></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="Nenhuma movimentação encontrada" description="Remova ou ajuste os filtros aplicados." />}

        <footer className="pagination"><span>Página {page} de {totalPages}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={16} /> Anterior</button><button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Próxima <ArrowRight size={16} /></button></div></footer>
      </Section>
    </div>
  );
}

