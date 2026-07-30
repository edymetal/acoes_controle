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
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
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

const CLASS_COLORS = {
  stocks: "#56d8ff",
  fiis: "#7c8cff",
  crypto: "#f6b94a",
  fixedIncome: "#37dda2",
};
const BENCHMARK_COLORS = ["#f8799b", "#b584ff", "#8ca5c7", "#ffb86b"];

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
  const [period, setPeriod] = useState<EvolutionPeriod>("1y");
  const [currency, setCurrency] = useState<EvolutionCurrency>("USD");
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

      {!hasStoredHistory && (
        <div className="refresh-message refresh-message--warning evolution-coverage-notice" role="status">
          <Database size={17} />
          <span>O coletor ainda não registrou fechamentos. O ponto atual já está pronto e a série começará a crescer após a primeira captura diária.</span>
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
          <div className="evolution-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334a" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tickFormatter={(value) => formatValue(Number(value), true)} tick={{ fill: "#8495ad", fontSize: 12 }} axisLine={false} tickLine={false} width={75} />
                <Tooltip formatter={(value, name) => [formatValue(Number(value)), String(name)]} labelFormatter={(label) => `Data: ${label}`} contentStyle={{ background: "#101d30", border: "1px solid #273851", borderRadius: 12 }} />
                <Area type="monotone" dataKey="stocks" name="Ações" stackId="classes" stroke={CLASS_COLORS.stocks} fill={CLASS_COLORS.stocks} fillOpacity={0.28} />
                <Area type="monotone" dataKey="fiis" name="FIIs" stackId="classes" stroke={CLASS_COLORS.fiis} fill={CLASS_COLORS.fiis} fillOpacity={0.28} />
                <Area type="monotone" dataKey="crypto" name="Cripto" stackId="classes" stroke={CLASS_COLORS.crypto} fill={CLASS_COLORS.crypto} fillOpacity={0.28} />
                <Area type="monotone" dataKey="fixedIncome" name="Renda fixa" stackId="classes" stroke={CLASS_COLORS.fixedIncome} fill={CLASS_COLORS.fixedIncome} fillOpacity={0.28} />
                <Line type="monotone" dataKey="total" name="Patrimônio" stroke="#f7fbff" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
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
