import { useState } from "react";
import { CalendarCheck2, CalendarPlus, CircleDollarSign, Target, TrendingUp } from "lucide-react";
import { MetricCard, Section } from "../../components/Ui";
import { formatBrl, formatDate, formatUsdFromBrl } from "../../lib/format";
import type { FixedIncomeModel } from "../../types";
import { FixedIncomeYearSelector } from "./FixedIncomeYearSelector";

export function FixedIncomeLadder({ model, usdRate }: { model: FixedIncomeModel; usdRate: number | null }) {
  const [selectedYear, setSelectedYear] = useState(model.referenceYear);
  const activeYear = model.years.find(({ year }) => year === selectedYear) ?? model.years[0];
  return <div className="page-stack">
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label={`Meses cobertos em ${activeYear.year}`} value={`${activeYear.metrics.coveredMonths} de 12`} icon={<CalendarCheck2 size={19} />} helper="Com ao menos um vencimento" accent="green" />
      <MetricCard label="Meses a completar" value={String(activeYear.metrics.missingMonths)} icon={<Target size={19} />} helper={`Meta da escada de ${activeYear.year}`} accent="amber" />
      <MetricCard label={`Total projetado em ${activeYear.year}`} value={formatBrl(activeYear.metrics.projectedNetAmount)} secondaryValue={formatUsdFromBrl(activeYear.metrics.projectedNetAmount, usdRate)} icon={<CircleDollarSign size={19} />} helper={`${activeYear.metrics.assetCount} vencimentos no ano`} accent="violet" />
    </section>
    <Section title={`Escada de vencimentos de ${activeYear.year}`} subtitle="Selecione o ano para conferir os ativos existentes e os meses que ainda precisam de compra" action={<FixedIncomeYearSelector years={model.years.map(({ year }) => year)} value={activeYear.year} onChange={setSelectedYear} />}>
      <div className="maturity-ladder">{activeYear.months.map((month) => <article key={month.month} className={`maturity-month ${month.covered ? "maturity-month--covered" : "maturity-month--missing"}`}>
        <header><span className="maturity-month__number">{String(month.month + 1).padStart(2, "0")}</span><span><strong>{month.label}</strong><small>{month.covered ? `${month.investments.length} ${month.investments.length === 1 ? "ativo" : "ativos"}` : "Nenhum vencimento"}</small></span>{month.covered ? <CalendarCheck2 size={19} /> : <CalendarPlus size={19} />}</header>
        {month.covered ? <div className="maturity-assets">{month.investments.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.type} · vence em {formatDate(item.maturityDate)}</small></span><span><strong>{formatBrl(item.netAmount)}</strong><small className="currency-conversion">{formatUsdFromBrl(item.netAmount, usdRate)}</small></span></div>)}</div> : <div className="maturity-missing"><Target size={18} /><span><strong>Falta comprar</strong><small>Inclua um ativo com vencimento em {month.label.toLocaleLowerCase("pt-BR")} de {activeYear.year}.</small></span></div>}
        <footer><span><CircleDollarSign size={14} /><span>Líquido projetado <strong>{formatBrl(month.projectedNetAmount)}</strong><small className="currency-conversion">{formatUsdFromBrl(month.projectedNetAmount, usdRate)}</small></span></span><span><TrendingUp size={14} /><span>Lucro projetado <strong>{formatBrl(month.projectedProfit)}</strong><small className="currency-conversion">{formatUsdFromBrl(month.projectedProfit, usdRate)}</small></span></span></footer>
      </article>)}</div>
    </Section>
  </div>;
}
