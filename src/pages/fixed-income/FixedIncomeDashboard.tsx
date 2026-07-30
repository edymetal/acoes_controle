import { useState } from "react";
import { ArrowRight, CalendarCheck2, CalendarX2, CircleDollarSign, Landmark, PiggyBank, ReceiptText, TrendingUp } from "lucide-react";
import type { PageId } from "../../components/Shell";
import { MetricCard, Section, Value } from "../../components/Ui";
import { formatBrl, formatDate, formatPercent, formatUsdFromBrl } from "../../lib/format";
import type { FixedIncomeModel } from "../../types";
import { FixedIncomeWarningNotice } from "./FixedIncomeWarningNotice";
import { FixedIncomeYearSelector } from "./FixedIncomeYearSelector";

export function FixedIncomeDashboard({ model, usdRate, onNavigate }: { model: FixedIncomeModel; usdRate: number | null; onNavigate: (page: PageId) => void }) {
  const { metrics, investments } = model;
  const [selectedYear, setSelectedYear] = useState(model.referenceYear);
  const activeYear = model.years.find(({ year }) => year === selectedYear) ?? model.years[0];
  const hasIgnoredTaxAmount = model.warnings.some((warning) =>
    warning.startsWith("Valores bruto e de imposto inconsistentes em fixed-income-"));
  return <div className="page-stack">
    <FixedIncomeWarningNotice warnings={model.warnings} />
    <section className="hero-card hero-card--fixed-income">
      <div><span className="eyebrow">VALOR LÍQUIDO PROJETADO NO VENCIMENTO</span><strong>{formatBrl(metrics.projectedNetAmount)}</strong><small className="hero-card__converted currency-conversion">{formatUsdFromBrl(metrics.projectedNetAmount, usdRate)}</small><p><Value value={metrics.projectedProfit}>{formatBrl(metrics.projectedProfit)} ({formatPercent(metrics.projectedReturnRate)})</Value><span> de lucro projetado</span></p></div>
      <div className="hero-card__summary"><span><small>Principal aplicado</small><strong>{formatBrl(metrics.currentPrincipal)}</strong></span><span><small>Ativos</small><strong>{metrics.assetCount}</strong></span><span><small>Meses em {activeYear.year}</small><strong>{activeYear.metrics.coveredMonths}/12</strong></span></div>
    </section>
    <section className="metrics-grid metrics-grid--five">
      <MetricCard label="Principal aplicado" value={formatBrl(metrics.currentPrincipal)} secondaryValue={formatUsdFromBrl(metrics.currentPrincipal, usdRate)} icon={<PiggyBank size={19} />} helper={`${metrics.assetCount} aplicações · proxy atual`} accent="blue" />
      <MetricCard label="Bruto projetado" value={formatBrl(metrics.projectedGrossAmount)} secondaryValue={formatUsdFromBrl(metrics.projectedGrossAmount, usdRate)} icon={<CircleDollarSign size={19} />} helper="No vencimento, antes dos impostos" accent="violet" />
      <MetricCard label="Total de imposto de renda" value={formatBrl(metrics.projectedTaxAmount)} secondaryValue={formatUsdFromBrl(metrics.projectedTaxAmount, usdRate)} icon={<ReceiptText size={19} />} helper={hasIgnoredTaxAmount ? "Total parcial · revise o aviso da planilha" : "IR projetado nos vencimentos"} accent="amber" />
      <MetricCard label="Lucro projetado" value={formatBrl(metrics.projectedProfit)} secondaryValue={formatUsdFromBrl(metrics.projectedProfit, usdRate)} icon={<TrendingUp size={19} />} helper={formatPercent(metrics.projectedReturnRate)} change={metrics.projectedProfit} accent="green" />
      <MetricCard label={`Meses sem ativo em ${activeYear.year}`} value={String(activeYear.metrics.missingMonths)} icon={<CalendarX2 size={19} />} helper="Meta: ao menos 1 por mês" accent="amber" />
    </section>
    <section className="dashboard-grid dashboard-grid--lower">
      <Section title={`Cobertura dos 12 meses de ${activeYear.year}`} subtitle="Ativos agrupados por ano e mês de vencimento" action={<div className="fixed-income-section-actions"><FixedIncomeYearSelector years={model.years.map(({ year }) => year)} value={activeYear.year} onChange={setSelectedYear} /><button className="text-button" type="button" onClick={() => onNavigate("fixed-income-ladder")}>Ver escada <ArrowRight size={15} /></button></div>}>
        <div className="month-coverage-grid">{activeYear.months.map((month) => <div key={month.month} className={`month-coverage ${month.covered ? "month-coverage--covered" : "month-coverage--missing"}`}><span>{month.shortLabel}</span><strong>{month.investments.length || "—"}</strong><small>{month.covered ? "coberto" : "falta comprar"}</small></div>)}</div>
      </Section>
      <Section title="Próximos vencimentos" subtitle="Quando você receberá o valor líquido" action={<button className="text-button" type="button" onClick={() => onNavigate("fixed-income-portfolio")}>Ver carteira <ArrowRight size={15} /></button>}>
        <div className="fixed-income-upcoming">{investments.slice(0, 5).map((item) => <div key={item.id}><span className="fixed-income-icon"><Landmark size={17} /></span><span><strong>{item.name}</strong><small>{item.type} · vence em {formatDate(item.maturityDate)}</small></span><span><strong>{formatBrl(item.netAmount)}</strong><small className="value--positive">+ {formatBrl(item.profit)}</small></span></div>)}</div>
        <div className="source-strip"><CalendarCheck2 size={15} /> Dados da aba Fixa Hist · valores principais em reais</div>
      </Section>
    </section>
  </div>;
}
