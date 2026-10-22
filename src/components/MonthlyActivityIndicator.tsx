import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChartNoAxesCombined } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, toneForValue } from "../lib/format";
import { loadAppLanguage } from "../lib/i18n";
import { getMonthlyActivity } from "../lib/monthlyActivity";
import type { PortfolioModel } from "../types";
import { EmptyState, Section } from "./Ui";

export function MonthlyActivityIndicator({ model }: { model: PortfolioModel }) {
  const currentYear = new Date().getFullYear();
  const years = [...new Set([currentYear, ...model.transactions.map((item) => Number(item.date.slice(0, 4)))])]
    .filter((year) => Number.isInteger(year) && year > 0)
    .sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const year = years.includes(selectedYear) ? selectedYear : currentYear;
  const language = loadAppLanguage();
  const months = useMemo(() => getMonthlyActivity(model.transactions, year, model.health.accounting === "complete").map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat(language, { month: "short" }).format(new Date(year, item.month - 1, 1)).replace(/\.$/, ""),
    fullLabel: new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }).format(new Date(year, item.month - 1, 1)),
  })), [model.transactions, model.health.accounting, year, language]);
  const purchases = months.reduce((sum, item) => sum + item.purchases, 0);
  const sales = months.reduce((sum, item) => sum + item.sales, 0);
  const profit = months.some((item) => item.realizedProfit === null) ? null : months.reduce((sum, item) => sum + (item.realizedProfit ?? 0), 0);
  const hasActivity = months.some((item) => item.transactionCount > 0);
  const profitLabel = (value: number | null) => value === null ? "Indisponível" : formatCurrency(value);

  return <Section
    title="Atividade mensal"
    subtitle="Compras, vendas e lucro realizado em cada mês · USD"
    className="monthly-activity"
    action={<label className="monthly-activity__year"><CalendarDays size={17} aria-hidden="true" /><span>Ano</span>
      <select aria-label="Ano da atividade mensal de ações" value={year} onChange={(event) => setSelectedYear(Number(event.target.value))}>
        {years.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>}
  >
    <div className="monthly-activity__summary">
      <article className="monthly-activity__purchases"><span><ArrowDownLeft size={18} aria-hidden="true" />Compras no ano</span><strong className="privacy-value">{formatCurrency(purchases)}</strong><small>Capital aplicado em ações</small></article>
      <article className="monthly-activity__sales"><span><ArrowUpRight size={18} aria-hidden="true" />Vendas no ano</span><strong className="privacy-value">{formatCurrency(sales)}</strong><small>Valor recebido nas vendas</small></article>
      <article className="monthly-activity__profit"><span><ChartNoAxesCombined size={18} aria-hidden="true" />Lucro realizado no ano</span><strong className={`privacy-value value--${profit === null ? "neutral" : toneForValue(profit)}`}>{profitLabel(profit)}</strong><small>Resultado das ações vendidas</small></article>
    </div>

    <div className="monthly-activity__legend" aria-label="Legenda do gráfico">
      <span><i className="monthly-activity__key--purchases" />Compras</span>
      <span><i className="monthly-activity__key--sales" />Vendas</span>
      <span><i className="monthly-activity__key--profit" />Lucro realizado</span>
    </div>
    {hasActivity ? <div className="monthly-activity__chart-scroll">
      <div className="chart-box monthly-activity__chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={months} margin={{ top: 12, right: 16, left: 4, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#203149" strokeDasharray="3 6" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tickMargin={12} tick={{ fill: "#a5b5c9", fontSize: 12 }} height={42} />
            <YAxis axisLine={false} tickLine={false} width={72} tick={{ fill: "#8296ae", fontSize: 11 }} tickFormatter={(value) => formatCurrency(Number(value), true)} />
            <ReferenceLine y={0} stroke="#45627f" />
            <Tooltip cursor={{ fill: "rgba(124,140,255,.06)" }} content={({ active, payload }) => {
              const item = payload?.[0]?.payload as typeof months[number] | undefined;
              return active && item ? <div className="monthly-activity__tooltip">
                <strong>{item.fullLabel}</strong>
                <span>Compras<b>{formatCurrency(item.purchases)}</b></span>
                <span>Vendas<b>{formatCurrency(item.sales)}</b></span>
                <span>Lucro realizado<b className={`value--${item.realizedProfit === null ? "neutral" : toneForValue(item.realizedProfit)}`}>{profitLabel(item.realizedProfit)}</b></span>
              </div> : null;
            }} />
            <Bar name="Compras" dataKey="purchases" fill="#56d8ff" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar name="Vendas" dataKey="sales" fill="#b584ff" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line name="Lucro realizado" dataKey="realizedProfit" type="linear" stroke="#37dda2" strokeWidth={2.5} dot={{ r: 3, fill: "#0d1828", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div> : <EmptyState title={`Nenhuma movimentação em ${year}`} description="Selecione outro ano ou sincronize suas compras e vendas para acompanhar os resultados." />}

    <div className="monthly-activity__table-wrap" tabIndex={0} role="region" aria-label={`Valores mensais de ações em ${year}`}>
      <table className="monthly-activity__table">
        <caption>Compras, vendas e lucro realizado por mês em {year}, em dólares americanos</caption>
        <thead><tr><th scope="col">Indicador</th>{months.map((item) => <th scope="col" key={item.month}>{item.label}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Compras</th>{months.map((item) => <td key={item.month}><span className="privacy-value">{formatCurrency(item.purchases)}</span></td>)}</tr>
          <tr><th scope="row">Vendas</th>{months.map((item) => <td key={item.month}><span className="privacy-value">{formatCurrency(item.sales)}</span></td>)}</tr>
          <tr><th scope="row">Lucro realizado</th>{months.map((item) => <td key={item.month}><span className={`privacy-value value--${item.realizedProfit === null ? "neutral" : toneForValue(item.realizedProfit)}`}>{profitLabel(item.realizedProfit)}</span></td>)}</tr>
        </tbody>
      </table>
    </div>
    <p className="monthly-activity__note">O lucro considera o valor das vendas menos o custo médio das ações vendidas, inclusive compras de anos anteriores. Meses sem operações têm valores zerados.</p>
    {profit === null && <p className="monthly-activity__warning" role="status">Há vendas sem custo apurado ou com base contábil incompleta. O lucro fica indisponível nos períodos afetados.</p>}
  </Section>;
}
