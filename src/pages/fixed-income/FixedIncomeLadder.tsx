import { CalendarCheck2, CalendarPlus, CircleDollarSign, Target, TrendingUp } from "lucide-react";
import { MetricCard, Section } from "../../components/Ui";
import { formatBrl, formatDate, formatUsdFromBrl } from "../../lib/format";
import type { FixedIncomeModel } from "../../types";

export function FixedIncomeLadder({ model, usdRate }: { model: FixedIncomeModel; usdRate: number | null }) {
  return <div className="page-stack">
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label="Meses cobertos" value={`${model.metrics.coveredMonths} de 12`} icon={<CalendarCheck2 size={19} />} helper="Com ao menos um vencimento" accent="green" />
      <MetricCard label="Meses a completar" value={String(model.metrics.missingMonths)} icon={<Target size={19} />} helper="Meta da escada anual" accent="amber" />
      <MetricCard label="Total a receber" value={formatBrl(model.metrics.netAmount)} secondaryValue={formatUsdFromBrl(model.metrics.netAmount, usdRate)} icon={<CircleDollarSign size={19} />} helper="Somando todos os vencimentos" accent="violet" />
    </section>
    <Section title="Escada anual de vencimentos" subtitle="O ano completo, com os ativos existentes e os meses que ainda precisam de compra">
      <div className="maturity-ladder">{model.months.map((month) => <article key={month.month} className={`maturity-month ${month.covered ? "maturity-month--covered" : "maturity-month--missing"}`}>
        <header><span className="maturity-month__number">{String(month.month + 1).padStart(2, "0")}</span><span><strong>{month.label}</strong><small>{month.covered ? `${month.investments.length} ${month.investments.length === 1 ? "ativo" : "ativos"}` : "Nenhum vencimento"}</small></span>{month.covered ? <CalendarCheck2 size={19} /> : <CalendarPlus size={19} />}</header>
        {month.covered ? <div className="maturity-assets">{month.investments.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.type} · vence em {formatDate(item.maturityDate)}</small></span><span><strong>{formatBrl(item.netAmount)}</strong><small>{formatUsdFromBrl(item.netAmount, usdRate)}</small></span></div>)}</div> : <div className="maturity-missing"><Target size={18} /><span><strong>Falta comprar</strong><small>Inclua um ativo com vencimento em {month.label.toLocaleLowerCase("pt-BR")}.</small></span></div>}
        <footer><span><CircleDollarSign size={14} /><span>A receber <strong>{formatBrl(month.amountToReceive)}</strong><small>{formatUsdFromBrl(month.amountToReceive, usdRate)}</small></span></span><span><TrendingUp size={14} /><span>Lucro <strong>{formatBrl(month.profit)}</strong><small>{formatUsdFromBrl(month.profit, usdRate)}</small></span></span></footer>
      </article>)}</div>
    </Section>
  </div>;
}
