import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Database,
  HandCoins,
  Landmark,
  LoaderCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  DefaultTooltipContent,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, MetricCard, Section } from "../components/Ui";
import {
  buildEvolutionCalendar,
  calculateEvolution,
  filterEvolutionPeriod,
  getEvolutionCalendarYears,
  getEvolutionMonthContributions,
  type EvolutionInputs,
  type EvolutionPeriod,
} from "../lib/evolution";
import {
  filterEvolutionTooltipEntries,
  shouldShowEvolutionMarker,
  type EvolutionSeriesKey,
} from "../lib/evolutionTooltip";
import { formatCurrency, formatDate, formatPercent } from "../lib/format";
import type { EvolutionCurrency, EvolutionHistoryData } from "../types";
import { EvolutionMonthModal } from "./EvolutionMonthModal";

interface EvolutionProps extends Omit<EvolutionInputs, "history"> {
  history: EvolutionHistoryData | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const PERIODS: Array<{ value: EvolutionPeriod; label: string }> = [
  { value: "30d", label: "30 dias" },
  { value: "6m", label: "6 meses" },
  { value: "ytd", label: "No ano" },
  { value: "1y", label: "1 ano" },
  { value: "max", label: "Máximo" },
];

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const CLASS_COLORS: Record<EvolutionSeriesKey, string> = {
  stocks: "#56d8ff",
  fiis: "#7c8cff",
  crypto: "#f6b94a",
  fixedIncome: "#37dda2",
};
const EVOLUTION_SERIES: Array<{ key: EvolutionSeriesKey; name: string }> = [
  { key: "stocks", name: "Ações" },
  { key: "fiis", name: "FIIs" },
  { key: "crypto", name: "Cripto" },
  { key: "fixedIncome", name: "Renda fixa" },
];
const EVOLUTION_TOOLTIP_STYLE = {
  background: "#101d30",
  border: "1px solid #273851",
  borderRadius: 12,
};

interface EvolutionTooltipProps extends TooltipContentProps {
  hoveredSeries: EvolutionSeriesKey | null;
  formatValue: (value: number) => string;
}

function EvolutionTooltip({
  active,
  payload,
  label,
  hoveredSeries,
  formatValue,
}: EvolutionTooltipProps) {
  if (!active || payload.length === 0) return null;
  const visibleEntries = filterEvolutionTooltipEntries(payload, hoveredSeries);
  if (visibleEntries.length === 0) return null;
  return (
    <DefaultTooltipContent
      contentStyle={EVOLUTION_TOOLTIP_STYLE}
      formatter={(value, name) => [formatValue(Number(value)), String(name)]}
      label={`Data: ${label}`}
      payload={visibleEntries}
    />
  );
}

function EvolutionLoading() {
  return <div className="evolution-state"><LoaderCircle className="spin" size={28} /><strong>Carregando histórico privado…</strong><span>A carteira atual continua disponível durante a leitura.</span></div>;
}

function EvolutionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="evolution-state evolution-state--error">
      <AlertTriangle size={30} />
      <strong>Histórico ainda indisponível</strong>
      <span>{message}</span>
      <button type="button" onClick={onRetry}><RefreshCw size={16} /> Tentar novamente</button>
    </div>
  );
}

export function Evolution({
  history,
  stocks,
  fiis,
  crypto,
  fixedIncome,
  brlPerUsd,
  isLoading,
  error,
  onRetry,
}: EvolutionProps) {
  const [period, setPeriod] = useState<EvolutionPeriod>("max");
  const [currency, setCurrency] = useState<EvolutionCurrency>("USD");
  const [calendarYear, setCalendarYear] = useState<number | null>(null);
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<number | null>(null);
  const [hoveredSeries, setHoveredSeries] = useState<EvolutionSeriesKey | null>(null);
  const points = useMemo(() => history ? calculateEvolution({
    history,
    stocks,
    fiis,
    crypto,
    fixedIncome,
    brlPerUsd,
  }) : [], [history, stocks, fiis, crypto, fixedIncome, brlPerUsd]);
  const visiblePoints = useMemo(() => filterEvolutionPeriod(points, period), [points, period]);
  const calendarInputs = useMemo(() => ({
    stocks,
    fiis,
    crypto,
    fixedIncome,
    brlPerUsd,
  }), [stocks, fiis, crypto, fixedIncome, brlPerUsd]);
  const calendarYears = useMemo(
    () => getEvolutionCalendarYears(points, calendarInputs),
    [points, calendarInputs],
  );
  const selectedCalendarYear = calendarYear !== null && calendarYears.includes(calendarYear)
    ? calendarYear
    : calendarYears.at(-1) ?? Number(stocks.generatedAt.slice(0, 4));
  const calendarMonths = useMemo(
    () => buildEvolutionCalendar(points, calendarInputs, selectedCalendarYear, currency),
    [points, calendarInputs, selectedCalendarYear, currency],
  );
  const selectedMonthContributions = useMemo(
    () => selectedCalendarMonth === null
      ? []
      : getEvolutionMonthContributions(
          points,
          calendarInputs,
          selectedCalendarYear,
          selectedCalendarMonth,
          currency,
        ),
    [points, calendarInputs, selectedCalendarYear, selectedCalendarMonth, currency],
  );
  const chartData = useMemo(() => visiblePoints.map((point) => {
    const rate = point.brlPerUsd;
    const toDisplay = (value: number, nativeCurrency: EvolutionCurrency) => {
      if (currency === nativeCurrency) return value;
      if (!rate) return 0;
      return nativeCurrency === "USD" ? value * rate : value / rate;
    };
    return {
      date: point.date,
      label: formatDate(point.date),
      stocks: toDisplay(point.stocksUsd, "USD"),
      fiis: toDisplay(point.fiisBrl, "BRL"),
      crypto: toDisplay(point.cryptoUsd, "USD"),
      fixedIncome: toDisplay(point.fixedIncomeBrl, "BRL"),
      total: currency === "USD" ? point.totalUsd : point.totalBrl,
      complete: point.complete,
      isLive: point.isLive,
      reconstructed: point.reconstructed,
    };
  }), [visiblePoints, currency]);
  if (isLoading && !history) return <EvolutionLoading />;
  if (error && !history) return <EvolutionError message={error} onRetry={onRetry} />;
  if (!history) return <EvolutionError message="A leitura do histórico ainda não foi iniciada." onRetry={onRetry} />;

  const first = chartData[0] ?? null;
  const last = chartData.at(-1) ?? null;
  const change = first && last ? last.total - first.total : 0;
  const changePercent = first && first.total > 0 ? change / first.total : 0;
  const completeCount = visiblePoints.filter((point) => point.complete).length;
  const coverage = visiblePoints.length > 0 ? completeCount / visiblePoints.length : 0;
  const formatValue = (value: number, compact = false) => formatCurrency(value, compact, currency);
  const hasStoredHistory = history.records.some((record) => record.kind !== "benchmark");
  const reconstructedCount = visiblePoints.filter((point) => point.reconstructed).length;
  const allocationTotal = last
    ? EVOLUTION_SERIES.reduce((total, series) => total + Math.max(0, last[series.key]), 0)
    : 0;
  const allocation = last
    ? EVOLUTION_SERIES.map((series) => ({
        ...series,
        value: Math.max(0, last[series.key]),
        share: allocationTotal > 0 ? Math.max(0, last[series.key]) / allocationTotal : 0,
      }))
    : [];
  const calendarYearIndex = calendarYears.indexOf(selectedCalendarYear);
  const calendarInvested = calendarMonths.reduce(
    (total, month) => total + (month.isFuture ? 0 : month.invested ?? 0),
    0,
  );
  const calendarInvestmentAvailable = calendarMonths
    .filter((month) => !month.isFuture)
    .every((month) => month.invested !== null);
  const calendarLastMonth = calendarMonths.filter((month) => month.patrimony !== null).at(-1) ?? null;
  const calendarLastPatrimony = calendarLastMonth?.patrimony ?? null;
  const calendarDataMonths = calendarMonths.filter((month) => month.patrimony !== null).length;

  return (
    <>
      <div className="page-stack evolution-page">
      <section className="evolution-toolbar panel">
        <div className="evolution-filter" role="group" aria-label="Período da evolução">
          {PERIODS.map((item) => <button type="button" key={item.value} className={period === item.value ? "active" : ""} onClick={() => setPeriod(item.value)}>{item.label}</button>)}
        </div>
        <div className="evolution-filter" role="group" aria-label="Moeda da evolução">
          {(["USD", "BRL"] as const).map((item) => <button type="button" key={item} className={currency === item ? "active" : ""} onClick={() => setCurrency(item)}>{item}</button>)}
        </div>
      </section>

      {reconstructedCount > 0 && (
        <div className="refresh-message refresh-message--warning evolution-coverage-notice" role="status">
          <Database size={17} />
          <span>
            {hasStoredHistory
              ? `A série combina os fechamentos disponíveis com ${reconstructedCount} ponto(s) reconstruído(s) das movimentações da planilha.`
              : `Exibindo ${reconstructedCount} ponto(s) reconstruído(s) das movimentações já registradas nas planilhas históricas.`}
            {" "}Preços entre operações e câmbio histórico são estimados até existirem fechamentos diários.
          </span>
        </div>
      )}
      {!hasStoredHistory && reconstructedCount === 0 && (
        <div className="refresh-message refresh-message--warning evolution-coverage-notice" role="status">
          <Database size={17} />
          <span>Não há movimentações históricas válidas nem fechamentos diários. O ponto atual continuará disponível enquanto a série é iniciada.</span>
        </div>
      )}
      {error && history && (
        <div className="refresh-message refresh-message--error evolution-coverage-notice" role="status">
          <AlertTriangle size={17} />
          <span>{error} O último histórico válido foi mantido.</span>
        </div>
      )}
      {history.integrity.warnings.length > 0 && (
        <div className="refresh-message refresh-message--warning evolution-coverage-notice" role="status">
          <AlertTriangle size={17} />
          <span>{history.integrity.warnings.length} aviso(s) foram encontrados no histórico. Registros válidos continuam sendo exibidos.</span>
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard label="Patrimônio no período" value={last ? formatValue(last.total) : "Indisponível"} icon={<CircleDollarSign size={19} />} helper={last?.isLive ? "Ponto atual calculado agora" : "Último fechamento registrado"} accent="blue" />
        <MetricCard label="Variação patrimonial" value={formatValue(change)} icon={<TrendingUp size={19} />} helper={chartData.length > 1 ? formatPercent(changePercent) : "Aguardando o segundo ponto"} change={chartData.length > 1 ? change : undefined} accent="green" />
        <MetricCard label="Cobertura completa" value={formatPercent(coverage, 0)} icon={<Activity size={19} />} helper={`${completeCount} de ${visiblePoints.length} pontos completos`} accent="violet" />
        <MetricCard label="Período disponível" value={visiblePoints.length > 1 ? `${visiblePoints.length} pontos` : "Iniciando"} icon={<CalendarDays size={19} />} helper={first && last ? `${first.label} — ${last.label}` : "Sem fechamentos anteriores"} accent="amber" />
      </div>

      <Section title="Evolução do patrimônio" subtitle={`Valores históricos consolidados em ${currency}`} className="evolution-chart-panel">
        {chartData.length > 0 ? (
          <div className="evolution-chart" onMouseMoveCapture={() => setHoveredSeries(null)} onMouseLeave={() => setHoveredSeries(null)}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tickFormatter={(value) => formatValue(Number(value), true)} tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} width={75} />
                <Tooltip content={(props) => <EvolutionTooltip {...props} hoveredSeries={hoveredSeries} formatValue={formatValue} />} />
                {EVOLUTION_SERIES.map((series) => (
                  <Area key={`area-${series.key}`} type="monotone" dataKey={series.key} name={series.name} stroke="none" fill={CLASS_COLORS[series.key]} fillOpacity={0.1} activeDot={false} pointerEvents="none" />
                ))}
                {EVOLUTION_SERIES.map((series) => (
                  <Line key={`series-${series.key}`} type="monotone" dataKey={series.key} stroke={CLASS_COLORS[series.key]} strokeWidth={2} dot={false} activeDot={shouldShowEvolutionMarker(hoveredSeries, series.key) ? { r: 5, fill: CLASS_COLORS[series.key], stroke: "#f7fbff", strokeWidth: 2 } : false} tooltipType="none" legendType="none" isAnimationActive={false} pointerEvents="none" />
                ))}
                {EVOLUTION_SERIES.map((series) => (
                  <Line key={`hit-area-${series.key}`} type="monotone" dataKey={series.key} stroke={CLASS_COLORS[series.key]} strokeOpacity={0} strokeWidth={18} dot={false} activeDot={false} tooltipType="none" legendType="none" isAnimationActive={false} pointerEvents="stroke" onMouseEnter={() => setHoveredSeries(series.key)} onMouseMove={() => setHoveredSeries(series.key)} onMouseLeave={() => setHoveredSeries(null)} onClick={() => setHoveredSeries(series.key)} />
                ))}
                <Line type="monotone" dataKey="total" name="Patrimônio" stroke="#f7fbff" strokeWidth={2.5} dot={false} activeDot={hoveredSeries === null ? { r: 5 } : false} onMouseEnter={() => setHoveredSeries(null)} onClick={() => setHoveredSeries(null)} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState title="Nenhum ponto disponível" description="O primeiro ponto aparecerá assim que as bases atuais estiverem prontas." />}
        <div className="evolution-legend" aria-label="Legenda das classes">
          <span><i style={{ background: CLASS_COLORS.stocks }} />Ações</span>
          <span><i style={{ background: CLASS_COLORS.fiis }} />FIIs</span>
          <span><i style={{ background: CLASS_COLORS.crypto }} />Cripto</span>
          <span><i style={{ background: CLASS_COLORS.fixedIncome }} />Renda fixa</span>
        </div>
      </Section>

      <Section title="Composição do patrimônio" subtitle={last ? `Distribuição por classe em ${last.label}` : "Distribuição por classe no ponto mais recente"} className="evolution-allocation-panel">
        {allocation.length > 0 ? (
          <div className="evolution-allocation" role="list" aria-label="Composição patrimonial por classe">
            {allocation.map((item) => (
              <article className="evolution-allocation-item" role="listitem" key={item.key}>
                <div className="evolution-allocation-head">
                  <span><i style={{ background: CLASS_COLORS[item.key] }} />{item.name}</span>
                  <strong>{formatValue(item.value)}</strong>
                </div>
                <div className="evolution-allocation-track" aria-hidden="true">
                  <i style={{ background: CLASS_COLORS[item.key], width: `${Math.min(item.share * 100, 100)}%` }} />
                </div>
                <span className="evolution-allocation-share">{formatPercent(item.share, 1)} do patrimônio</span>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Composição indisponível" description="O detalhamento aparecerá assim que houver um ponto patrimonial válido." />}
      </Section>

      <Section
        title="Calendário patrimonial"
        subtitle={`Aportes e fechamento mensal em ${currency}`}
        className="evolution-calendar-panel"
        action={(
          <div className="evolution-year-selector" role="group" aria-label="Ano do calendário patrimonial">
            <button
              type="button"
              aria-label="Ver ano anterior"
              disabled={calendarYearIndex <= 0}
              onClick={() => setCalendarYear(calendarYears[calendarYearIndex - 1])}
            >
              <ChevronLeft size={18} />
            </button>
            <strong aria-live="polite">{selectedCalendarYear}</strong>
            <button
              type="button"
              aria-label="Ver próximo ano"
              disabled={calendarYearIndex < 0 || calendarYearIndex >= calendarYears.length - 1}
              onClick={() => setCalendarYear(calendarYears[calendarYearIndex + 1])}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      >
        <div className="evolution-year-summary" aria-label={`Resumo de ${selectedCalendarYear}`}>
          <span>
            <HandCoins size={17} />
            <small>Investido no ano</small>
            <strong>{calendarInvestmentAvailable ? formatValue(calendarInvested) : "Indisponível"}</strong>
          </span>
          <span>
            <Landmark size={17} />
            <small>Último patrimônio</small>
            <strong>{calendarLastPatrimony === null ? "Indisponível" : formatValue(calendarLastPatrimony)}</strong>
          </span>
          <span>
            <CalendarDays size={17} />
            <small>Meses com histórico</small>
            <strong>{calendarDataMonths} de 12</strong>
          </span>
        </div>

        <div className="evolution-calendar" role="list" aria-label={`Calendário patrimonial de ${selectedCalendarYear}`}>
          {calendarMonths.map((month) => {
            const monthStatus = month.isFuture
              ? "Aguardando o mês"
              : month.isCurrent
                ? "Mês atual"
                : month.closingDate
                  ? month.complete ? "Fechamento disponível" : "Fechamento parcial"
                  : "Sem fechamento";
            const monthClassName = [
              "evolution-month",
              month.isCurrent ? "evolution-month--current" : "",
              month.isFuture ? "evolution-month--future" : "",
              !month.isFuture && month.patrimony === null ? "evolution-month--missing" : "",
            ].filter(Boolean).join(" ");
            return (
              <article className={monthClassName} role="listitem" key={month.month}>
                <button
                  type="button"
                  className="evolution-month__button"
                  aria-label={`Ver ${month.investmentCount} ${month.investmentCount === 1 ? "aporte" : "aportes"} de ${MONTHS[month.month]} de ${selectedCalendarYear}`}
                  onClick={() => setSelectedCalendarMonth(month.month)}
                >
                  <header>
                    <span className="evolution-month__number">{String(month.month + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{MONTHS[month.month]}</strong>
                      <small>{monthStatus}</small>
                    </span>
                    <ChevronRight className="evolution-month__open" size={19} aria-hidden="true" />
                  </header>
                  <div className="evolution-month__values">
                    <span className="evolution-month__value evolution-month__value--invested">
                      <small><HandCoins size={15} />Investido no mês</small>
                      <strong>{month.isFuture ? "—" : month.invested === null ? "Indisponível" : formatValue(month.invested)}</strong>
                      <em>{month.isFuture ? "Ainda não iniciado" : `${month.investmentCount} ${month.investmentCount === 1 ? "aporte" : "aportes"}`}</em>
                    </span>
                    <span className="evolution-month__value evolution-month__value--patrimony">
                      <small><Landmark size={15} />Patrimônio</small>
                      <strong>{month.patrimony === null ? "—" : formatValue(month.patrimony)}</strong>
                      <em>{month.closingDate ? `Em ${formatDate(month.closingDate)}` : month.isFuture ? "Aguardando fechamento" : "Histórico indisponível"}</em>
                    </span>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </Section>

        <div className="evolution-disclaimer">
          <AlertTriangle size={17} />
          <p><strong>Leitura patrimonial.</strong> A variação inclui o efeito de compras e vendas e ainda não representa TWR ou XIRR. A renda fixa usa o principal aplicado, sem antecipar o lucro projetado.</p>
        </div>
      </div>
      {selectedCalendarMonth !== null && (
        <EvolutionMonthModal
          monthLabel={MONTHS[selectedCalendarMonth]}
          year={selectedCalendarYear}
          currency={currency}
          contributions={selectedMonthContributions}
          onClose={() => setSelectedCalendarMonth(null)}
        />
      )}
    </>
  );
}
