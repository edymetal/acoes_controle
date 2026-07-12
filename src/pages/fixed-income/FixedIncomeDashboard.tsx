import { ArrowRight, CalendarCheck2, CalendarX2, CircleDollarSign, Landmark, PiggyBank, TrendingUp } from "lucide-react";
import type { PageId } from "../../components/Shell";
import { MetricCard, Section, Value } from "../../components/Ui";
import { formatBrl, formatDate, formatPercent, formatUsdFromBrl } from "../../lib/format";
import type { FixedIncomeModel } from "../../types";

export function FixedIncomeDashboard({ model, usdRate, onNavigate }: { model: FixedIncomeModel; usdRate: number | null; onNavigate: (page: PageId) => void }) {
  const { metrics, months, investments } = model;
  return <div className="page-stack">
    {model.warnings.length > 0 && <div className="refresh-message refresh-message--warning" role="status">{model.warnings.length === 1 ? model.warnings[0] : `${model.warnings.length} avisos foram identificados na renda fixa.`}</div>}
    <section className="hero-card hero-card--fixed-income">
      <div><span className="eyebrow">VALOR LÍQUIDO A RECEBER</span><strong>{formatBrl(metrics.netAmount)}</strong><small className="hero-card__converted">{formatUsdFromBrl(metrics.netAmount, usdRate)}</small><p><Value value={metrics.profit}>{formatBrl(metrics.profit)} ({formatPercent(metrics.returnRate)})</Value><span> de lucro previsto</span></p></div>
      <div className="hero-card__summary"><span><small>Total aplicado</small><strong>{formatBrl(metrics.investedAmount)}</strong></span><span><small>Ativos</small><strong>{metrics.assetCount}</strong></span><span><small>Meses cobertos</small><strong>{metrics.coveredMonths}/12</strong></span></div>
    </section>
    <section className="metrics-grid">
      <MetricCard label="Total aplicado" value={formatBrl(metrics.investedAmount)} secondaryValue={formatUsdFromBrl(metrics.investedAmount, usdRate)} icon={<PiggyBank size={19} />} helper={`${metrics.assetCount} aplicações`} accent="blue" />
      <MetricCard label="Valor bruto" value={formatBrl(metrics.grossAmount)} secondaryValue={formatUsdFromBrl(metrics.grossAmount, usdRate)} icon={<CircleDollarSign size={19} />} helper="Antes dos impostos" accent="violet" />
      <MetricCard label="Lucro previsto" value={formatBrl(metrics.profit)} secondaryValue={formatUsdFromBrl(metrics.profit, usdRate)} icon={<TrendingUp size={19} />} helper={formatPercent(metrics.returnRate)} change={metrics.profit} accent="green" />
      <MetricCard label="Meses ainda sem ativo" value={String(metrics.missingMonths)} icon={<CalendarX2 size={19} />} helper="Meta: ao menos 1 por mês" accent="amber" />
    </section>
    <section className="dashboard-grid dashboard-grid--lower">
      <Section title="Cobertura dos 12 meses" subtitle="Ativos agrupados pelo mês de vencimento" action={<button className="text-button" type="button" onClick={() => onNavigate("fixed-income-ladder")}>Ver escada <ArrowRight size={15} /></button>}>
        <div className="month-coverage-grid">{months.map((month) => <div key={month.month} className={`month-coverage ${month.covered ? "month-coverage--covered" : "month-coverage--missing"}`}><span>{month.shortLabel}</span><strong>{month.investments.length || "—"}</strong><small>{month.covered ? "coberto" : "falta comprar"}</small></div>)}</div>
      </Section>
      <Section title="Próximos vencimentos" subtitle="Quando você receberá o valor líquido" action={<button className="text-button" type="button" onClick={() => onNavigate("fixed-income-portfolio")}>Ver carteira <ArrowRight size={15} /></button>}>
        <div className="fixed-income-upcoming">{investments.slice(0, 5).map((item) => <div key={item.id}><span className="fixed-income-icon"><Landmark size={17} /></span><span><strong>{item.name}</strong><small>{item.type} · vence em {formatDate(item.maturityDate)}</small></span><span><strong>{formatBrl(item.netAmount)}</strong><small className="value--positive">+ {formatBrl(item.profit)}</small></span></div>)}</div>
        <div className="source-strip"><CalendarCheck2 size={15} /> Dados da aba Fixa Hist · valores principais em reais</div>
      </Section>
    </section>
  </div>;
}
