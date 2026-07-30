import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Database,
  LineChart as LineChartIcon,
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
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, MetricCard, Section } from "../components/Ui";
import {
  benchmarkSeries,
  calculateEvolution,
  filterEvolutionPeriod,
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
const BENCHMARK_COLORS = ["#f8799b", "#b584ff", "#8ca5c7", "#ffb86b"];
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
  const benchmarks = useMemo(
    () => history ? benchmarkSeries(history, visiblePoints.map((point) => point.date)) : [],
    [history, visiblePoints],
  );
  const benchmarkData = useMemo(() => {
    if (chartData.length === 0) return [];
    const totalBase = chartData[0].total;
    const byDate = new Map(chartData.map((item) => [item.date, {
      date: item.date,
      label: item.label,
      carteira: totalBase > 0 ? item.total / totalBase * 100 : 0,
    } as Record<string, string | number>]));
    for (const benchmark of benchmarks) {
      for (const point of benchmark.points) {
        const item = byDate.get(point.date);
        if (item) item[benchmark.symbol] = point.value;
      }
    }
    return [...byDate.values()];
  }, [benchmarks, chartData]);

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

  return (
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
          <div className="evolution-chart" onMouseLeave={() => setHoveredSeries(null)}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tickFormatter={(value) => formatValue(Number(value), true)} tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} width={75} />
                <Tooltip content={(props) => <EvolutionTooltip {...props} hoveredSeries={hoveredSeries} formatValue={formatValue} />} />
                {EVOLUTION_SERIES.map((series) => (
                  <Area key={series.key} type="monotone" dataKey={series.key} name={series.name} stackId="classes" stroke={CLASS_COLORS[series.key]} fill={CLASS_COLORS[series.key]} fillOpacity={0.28} activeDot={false} onMouseEnter={() => setHoveredSeries(series.key)} onMouseLeave={() => setHoveredSeries(null)} onClick={() => setHoveredSeries(series.key)} />
                ))}
                {EVOLUTION_SERIES.map((series) => (
                  <Line key={`marker-${series.key}`} type="monotone" dataKey={series.key} stroke="transparent" strokeWidth={1} dot={false} activeDot={shouldShowEvolutionMarker(hoveredSeries, series.key) ? { r: 5, fill: CLASS_COLORS[series.key], stroke: "#f7fbff", strokeWidth: 2 } : false} tooltipType="none" legendType="none" isAnimationActive={false} pointerEvents="none" />
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

      <Section title="Comparação de variação" subtitle="Séries patrimoniais normalizadas em 100 no início do período" className="evolution-chart-panel">
        {benchmarks.length > 0 && benchmarkData.length > 0 ? (
          <div className="evolution-chart evolution-chart--benchmark">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={benchmarkData} margin={{ top: 12, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tickFormatter={(value) => String(Math.round(Number(value)))} tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} pontos`, String(name)]} contentStyle={{ background: "#101d30", border: "1px solid #273851", borderRadius: 12 }} />
                <Line type="monotone" dataKey="carteira" name="Carteira" stroke="#56d8ff" strokeWidth={2.5} dot={false} />
                {benchmarks.map((benchmark, index) => <Line key={benchmark.symbol} type="monotone" dataKey={benchmark.symbol} name={benchmark.symbol} stroke={BENCHMARK_COLORS[index % BENCHMARK_COLORS.length]} strokeWidth={2} dot={false} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="evolution-benchmark-empty">
            <LineChartIcon size={27} />
            <div><strong>Benchmarks preparados, aguardando dados</strong><span>Quando o coletor receber séries de referência, elas aparecerão aqui sem alterar o patrimônio.</span></div>
          </div>
        )}
      </Section>

      <div className="evolution-disclaimer">
        <AlertTriangle size={17} />
        <p><strong>Leitura patrimonial.</strong> A variação inclui o efeito de compras e vendas e ainda não representa TWR ou XIRR. A renda fixa usa o principal aplicado, sem antecipar o lucro projetado.</p>
      </div>
    </div>
  );
}
