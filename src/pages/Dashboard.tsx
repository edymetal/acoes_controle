import { ArrowRight, BadgeDollarSign, CircleDollarSign, Landmark, Layers3, TrendingUp, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PageId } from "../components/Shell";
import { EmptyState, MetricCard, Section, SignalBadge, StockLogo, Value } from "../components/Ui";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "../lib/format";
import { getAnnualRealizedProfit, getStrategySignal } from "../lib/portfolio";
import type { PortfolioData, PortfolioModel, StrategySettings } from "../types";

const CHART_COLORS = ["#56d8ff", "#7c8cff", "#37dda2", "#b584ff", "#ffb86b", "#f8799b", "#4eb6a5", "#8ca5c7"];

interface DashboardProps {
  data: PortfolioData;
  model: PortfolioModel;
  settings: StrategySettings;
  onNavigate: (page: PageId) => void;
}

export function Dashboard({ data, model, settings, onNavigate }: DashboardProps) {
  const { metrics, positions, transactions } = model;
  const allocation = positions.slice(0, 7).map((position) => ({ name: position.ticker, value: position.marketValue }));
  const pnl = [...positions]
    .sort((a, b) => Math.abs(b.unrealized) - Math.abs(a.unrealized))
    .slice(0, 7)
    .map((position) => ({ ticker: position.ticker, value: position.unrealized }));
  const annualRealizedProfit = getAnnualRealizedProfit(transactions);
  const positionsByTicker = new Map(positions.map((position) => [position.ticker, position]));
  const strategy = data.assets.map((asset) => {
    const position = positionsByTicker.get(asset.ticker);
    return { asset, signal: getStrategySignal(asset, settings, position?.marketValue ?? 0, position?.costBasis ?? 0) };
  });
  const buySignals = strategy.filter((item) => item.signal.kind === "buy").sort((a, b) => b.signal.strength - a.signal.strength);
  const breakoutSignals = strategy.filter((item) => item.signal.kind === "breakout" || item.signal.kind === "sell");

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <span className="eyebrow">VALOR ATUAL DA CARTEIRA</span>
          <strong>{formatCurrency(metrics.marketValue)}</strong>
          <p>
            <Value value={metrics.unrealizedProfit}>{formatCurrency(metrics.unrealizedProfit)} ({formatPercent(metrics.openReturn)})</Value>
            <span> de resultado nas posições abertas</span>
          </p>
        </div>
        <div className="hero-card__summary">
          <span><small>Custo atual</small><strong>{formatCurrency(metrics.openCost)}</strong></span>
          <span><small>Posições</small><strong>{metrics.openPositions}</strong></span>
          <span><small>Ativos monitorados</small><strong>{metrics.assetCount}</strong></span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Total histórico comprado" value={formatCurrency(metrics.historicalPurchases)} icon={<WalletCards size={19} />} helper="Aportes acumulados" accent="blue" />
        <MetricCard label="Lucro realizado" value={formatCurrency(metrics.realizedProfit)} icon={<BadgeDollarSign size={19} />} helper="Em operações encerradas" change={metrics.realizedProfit} accent="green" />
        <MetricCard label="Resultado em aberto" value={formatCurrency(metrics.unrealizedProfit)} icon={<TrendingUp size={19} />} helper={formatPercent(metrics.openReturn)} change={metrics.unrealizedProfit} accent="violet" />
        <MetricCard label="Resultado total" value={formatCurrency(metrics.totalProfit)} icon={<CircleDollarSign size={19} />} helper={`${formatPercent(metrics.totalReturnOnPurchases)} sobre compras`} change={metrics.totalProfit} accent="amber" />
      </section>

      <section className="dashboard-grid">
        <Section title="Distribuição da carteira" subtitle="Participação por valor de mercado" className="chart-panel">
          <div className="donut-layout">
            <div className="chart-box chart-box--donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
                    {allocation.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: "#101d30", border: "1px solid #273851", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><Layers3 size={17} /><strong>{positions.length}</strong><small>posições</small></div>
            </div>
            <div className="chart-legend">
              {positions.slice(0, 7).map((position, index) => (
                <div key={position.ticker}>
                  <span className="legend-dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <strong>{position.ticker}</strong><span>{formatPercent(position.allocation)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Resultado por posição" subtitle="Maiores impactos no resultado em aberto" className="chart-panel">
          <div className="chart-box chart-box--bar">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnl} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#203149" strokeDasharray="4 5" />
                <XAxis dataKey="ticker" axisLine={false} tickLine={false} tick={{ fill: "#a5b5c9", fontSize: 14 }} />
                <YAxis axisLine={false} tickLine={false} width={58} tick={{ fill: "#8296ae", fontSize: 13 }} tickFormatter={(value) => `$${Math.round(Number(value))}`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "rgba(255,255,255,.025)" }} contentStyle={{ background: "#101d30", border: "1px solid #273851", borderRadius: 12 }} />
                <Bar dataKey="value" radius={[5, 5, 3, 3]}>
                  {pnl.map((item) => <Cell key={item.ticker} fill={item.value >= 0 ? "#37dda2" : "#f8799b"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Lucro realizado por ano" subtitle="Resultado consolidado das vendas concluídas em cada ano" className="chart-panel chart-panel--wide">
          {annualRealizedProfit.length ? <div className="chart-box chart-box--annual">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualRealizedProfit} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#203149" strokeDasharray="4 5" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#a5b5c9", fontSize: 14 }} />
                <YAxis axisLine={false} tickLine={false} width={58} tick={{ fill: "#8296ae", fontSize: 13 }} tickFormatter={(value) => `$${Math.round(Number(value))}`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "rgba(255,255,255,.025)" }} contentStyle={{ background: "#101d30", border: "1px solid #273851", borderRadius: 12 }} />
                <Bar dataKey="value" maxBarSize={72} radius={[5, 5, 3, 3]}>
                  {annualRealizedProfit.map((item) => <Cell key={item.year} fill={item.value >= 0 ? "#37dda2" : "#f8799b"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div> : <EmptyState title="Nenhum ano disponível" description="As movimentações anuais aparecerão quando houver dados processados." />}
        </Section>
      </section>

      <section className="dashboard-grid dashboard-grid--lower">
        <Section
          title="Sinais em destaque"
          subtitle={`${buySignals.length} sinais de compra · ${breakoutSignals.length} sinais de venda ou rompimento`}
          sensitiveSubtitle
          action={<button className="text-button" type="button" onClick={() => onNavigate("strategy")}>Ver estratégia <ArrowRight size={15} /></button>}
        >
          <div className="signal-list">
            {[...buySignals.slice(0, 3), ...breakoutSignals.slice(0, 2)].slice(0, 5).map(({ asset, signal }) => (
              <div className="signal-row" key={asset.ticker}>
                <StockLogo ticker={asset.ticker} />
                <span className="signal-row__name"><strong>{asset.ticker}</strong><small>{asset.name}</small></span>
                <SignalBadge signal={signal} />
                <span className="signal-row__price">
                  <strong>{signal.actionAmount > 0 ? `${signal.kind === "buy" ? "Comprar" : "Vender"} ${formatCurrency(signal.actionAmount)}` : formatCurrency(asset.currentPrice)}</strong>
                  <small>{signal.kind === "buy" ? `Alvo do nível ${formatCurrency(signal.targetPositionValue ?? 0)}` : signal.description}</small>
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Movimentações recentes"
          subtitle={`${transactions.length} registros processados`}
          sensitiveSubtitle
          action={<button className="text-button" type="button" onClick={() => onNavigate("history")}>Ver histórico <ArrowRight size={15} /></button>}
        >
          <div className="compact-table">
            {transactions.slice(0, 6).map((item) => (
              <div key={item.id}>
                <span className={`transaction-icon transaction-icon--${item.type}`}>{item.type === "buy" ? "+" : "−"}</span>
                <span><strong>{item.ticker}</strong><small>{formatDate(item.date)}</small></span>
                <span><strong>{formatCurrency(item.total)}</strong><small>{formatNumber(item.quantity)} ações</small></span>
              </div>
            ))}
          </div>
          <div className="source-strip"><Landmark size={15} /> Cotações atuais provenientes da planilha Google Sheets</div>
        </Section>
      </section>
    </div>
  );
}
