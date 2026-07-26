import { useMemo, useState } from "react";
import { CalendarClock, CircleDollarSign, PiggyBank, Search, ShieldCheck, SlidersHorizontal, TrendingUp } from "lucide-react";
import { SortableHeader, useSortableTable, type SortValue } from "../../components/SortableTable";
import { EmptyState, MetricCard, Section, Value } from "../../components/Ui";
import { formatBrl, formatDate, formatPercent, formatUsdFromBrl } from "../../lib/format";
import type { FixedIncomeInvestment, FixedIncomeModel } from "../../types";

const formatYield = (value: number | string) => typeof value === "number" ? formatPercent(value, 2) : value || "Não informado";

type FixedIncomeSortKey =
  | "fgcGuarantee"
  | "investedAmount"
  | "maturityDate"
  | "name"
  | "netAmount"
  | "profit"
  | "purchaseDate"
  | "yield";

function getFixedIncomeSortValue(
  investment: FixedIncomeInvestment,
  key: FixedIncomeSortKey,
): SortValue {
  return investment[key];
}

export function FixedIncomePortfolio({ model, usdRate }: { model: FixedIncomeModel; usdRate: number | null }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("maturity");
  const [year, setYear] = useState("all");
  const investments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return model.investments.filter((item) => (year === "all" || item.maturityDate.startsWith(year)) && (!query || `${item.name} ${item.type}`.toLocaleLowerCase("pt-BR").includes(query))).sort((a, b) => sort === "profit" ? b.profit - a.profit : sort === "amount" ? b.investedAmount - a.investedAmount : a.maturityDate.localeCompare(b.maturityDate));
  }, [model.investments, search, sort, year]);
  const {
    requestSort,
    resetSort,
    sortedRows: sortedInvestments,
    sortConfig,
  } = useSortableTable<FixedIncomeInvestment, FixedIncomeSortKey>(investments, getFixedIncomeSortValue);

  return <div className="page-stack">
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label="Total aplicado" value={formatBrl(model.metrics.investedAmount)} secondaryValue={formatUsdFromBrl(model.metrics.investedAmount, usdRate)} icon={<PiggyBank size={19} />} helper={`${model.metrics.assetCount} ativos`} accent="blue" />
      <MetricCard label="Líquido a receber" value={formatBrl(model.metrics.netAmount)} secondaryValue={formatUsdFromBrl(model.metrics.netAmount, usdRate)} icon={<CircleDollarSign size={19} />} helper="Após o IR informado" accent="violet" />
      <MetricCard label="Lucro previsto" value={formatBrl(model.metrics.profit)} secondaryValue={formatUsdFromBrl(model.metrics.profit, usdRate)} icon={<TrendingUp size={19} />} helper={formatPercent(model.metrics.returnRate)} change={model.metrics.profit} accent="green" />
    </section>
    <Section title="Ativos de renda fixa" subtitle="Vencimento, recebimento e lucro de cada aplicação">
      <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar instituição ou tipo" /></label><label className="select-field"><select aria-label="Filtrar por ano de vencimento" value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Todos os anos</option>{model.years.map(({ year: optionYear }) => <option value={String(optionYear)} key={optionYear}>{optionYear}</option>)}</select></label><label className="select-field"><SlidersHorizontal size={16} /><select value={sort} onChange={(event) => { setSort(event.target.value); resetSort(); }}><option value="maturity">Vencimento mais próximo</option><option value="amount">Maior aplicação</option><option value="profit">Maior lucro</option></select></label></div>
      {investments.length ? <div className="table-wrap table-wrap--fixed-income"><table className="fixed-income-table"><thead><tr>
        <SortableHeader sortKey="name" sortConfig={sortConfig} onSort={requestSort}>Ativo</SortableHeader>
        <SortableHeader sortKey="yield" sortConfig={sortConfig} onSort={requestSort}>Rendimento</SortableHeader>
        <SortableHeader sortKey="purchaseDate" sortConfig={sortConfig} onSort={requestSort}>Compra</SortableHeader>
        <SortableHeader sortKey="maturityDate" sortConfig={sortConfig} onSort={requestSort}>Vencimento</SortableHeader>
        <SortableHeader sortKey="investedAmount" sortConfig={sortConfig} onSort={requestSort}>Aplicado</SortableHeader>
        <SortableHeader sortKey="netAmount" sortConfig={sortConfig} onSort={requestSort}>Valor líquido</SortableHeader>
        <SortableHeader sortKey="profit" sortConfig={sortConfig} onSort={requestSort}>Lucro</SortableHeader>
        <SortableHeader sortKey="fgcGuarantee" sortConfig={sortConfig} onSort={requestSort}>Proteção</SortableHeader>
      </tr></thead><tbody>{sortedInvestments.map((item) => <tr key={item.id}><td><div className="asset-cell"><span className="ticker-avatar ticker-avatar--fixed-income">{item.type.slice(0, 2)}</span><span><strong>{item.name}</strong><small>{item.type} · risco {item.risk ?? "—"}</small></span></div></td><td><strong>{formatYield(item.yield)}</strong></td><td><strong>{formatDate(item.purchaseDate)}</strong></td><td><span className="date-emphasis"><CalendarClock size={14} />{formatDate(item.maturityDate)}</span></td><td><span className="dual-value"><strong>{formatBrl(item.investedAmount)}</strong><small className="currency-conversion">{formatUsdFromBrl(item.investedAmount, usdRate)}</small></span></td><td><span className="dual-value"><strong>{formatBrl(item.netAmount)}</strong><small className="currency-conversion">{formatUsdFromBrl(item.netAmount, usdRate)}</small></span></td><td><Value value={item.profit}><span className="dual-value"><strong>{formatBrl(item.profit)}</strong><small className="currency-conversion">{formatUsdFromBrl(item.profit, usdRate)}</small></span></Value></td><td>{item.fgcGuarantee ? <span className="fgc-badge"><ShieldCheck size={14} /> FGC</span> : <span className="muted-badge">Sem FGC</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum ativo encontrado" description="Ajuste a busca para visualizar outras aplicações." />}
    </Section>
  </div>;
}
