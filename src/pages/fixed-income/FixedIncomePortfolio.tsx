import { useMemo, useState } from "react";
import { CalendarClock, CircleDollarSign, PiggyBank, Search, ShieldCheck, SlidersHorizontal, TrendingUp } from "lucide-react";
import { EmptyState, MetricCard, Section, Value } from "../../components/Ui";
import { formatBrl, formatDate, formatPercent, formatUsdFromBrl } from "../../lib/format";
import type { FixedIncomeModel } from "../../types";

const formatYield = (value: number | string) => typeof value === "number" ? formatPercent(value, 2) : value || "Não informado";

export function FixedIncomePortfolio({ model, usdRate }: { model: FixedIncomeModel; usdRate: number | null }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("maturity");
  const investments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return model.investments.filter((item) => !query || `${item.name} ${item.type}`.toLocaleLowerCase("pt-BR").includes(query)).sort((a, b) => sort === "profit" ? b.profit - a.profit : sort === "amount" ? b.investedAmount - a.investedAmount : a.maturityDate.localeCompare(b.maturityDate));
  }, [model.investments, search, sort]);

  return <div className="page-stack">
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label="Total aplicado" value={formatBrl(model.metrics.investedAmount)} secondaryValue={formatUsdFromBrl(model.metrics.investedAmount, usdRate)} icon={<PiggyBank size={19} />} helper={`${model.metrics.assetCount} ativos`} accent="blue" />
      <MetricCard label="Líquido a receber" value={formatBrl(model.metrics.netAmount)} secondaryValue={formatUsdFromBrl(model.metrics.netAmount, usdRate)} icon={<CircleDollarSign size={19} />} helper="Após o IR informado" accent="violet" />
      <MetricCard label="Lucro previsto" value={formatBrl(model.metrics.profit)} secondaryValue={formatUsdFromBrl(model.metrics.profit, usdRate)} icon={<TrendingUp size={19} />} helper={formatPercent(model.metrics.returnRate)} change={model.metrics.profit} accent="green" />
    </section>
    <Section title="Ativos de renda fixa" subtitle="Vencimento, recebimento e lucro de cada aplicação">
      <div className="toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar instituição ou tipo" /></label><label className="select-field"><SlidersHorizontal size={16} /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="maturity">Vencimento mais próximo</option><option value="amount">Maior aplicação</option><option value="profit">Maior lucro</option></select></label></div>
      {investments.length ? <div className="table-wrap"><table><thead><tr><th>Ativo</th><th>Rendimento</th><th>Compra</th><th>Vencimento</th><th>Aplicado</th><th>Valor líquido</th><th>Lucro</th><th>Proteção</th></tr></thead><tbody>{investments.map((item) => <tr key={item.id}><td><div className="asset-cell"><span className="ticker-avatar ticker-avatar--fixed-income">{item.type.slice(0, 2)}</span><span><strong>{item.name}</strong><small>{item.type} · risco {item.risk ?? "—"}</small></span></div></td><td><strong>{formatYield(item.yield)}</strong></td><td><span className="dual-value"><strong>{formatDate(item.purchaseDate)}</strong><small>{formatBrl(item.investedAmount)} · {formatUsdFromBrl(item.investedAmount, usdRate)}</small></span></td><td><span className="date-emphasis"><CalendarClock size={14} />{formatDate(item.maturityDate)}</span></td><td><span className="dual-value"><strong>{formatBrl(item.investedAmount)}</strong><small>{formatUsdFromBrl(item.investedAmount, usdRate)}</small></span></td><td><span className="dual-value"><strong>{formatBrl(item.netAmount)}</strong><small>{formatUsdFromBrl(item.netAmount, usdRate)}</small></span></td><td><Value value={item.profit}><span className="dual-value"><strong>{formatBrl(item.profit)}</strong><small>{formatUsdFromBrl(item.profit, usdRate)}</small></span></Value></td><td>{item.fgcGuarantee ? <span className="fgc-badge"><ShieldCheck size={14} /> FGC</span> : <span className="muted-badge">Sem FGC</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum ativo encontrado" description="Ajuste a busca para visualizar outras aplicações." />}
    </Section>
  </div>;
}
