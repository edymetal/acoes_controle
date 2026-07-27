import { ArrowRight, BadgeDollarSign, Building2, CircleDollarSign, Layers3, TrendingUp, WalletCards } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PageId } from "../../components/Shell";
import { DataHealthNotice, MetricCard, Section, Value } from "../../components/Ui";
import { formatBrl, formatDate, formatNumber, formatPercent, formatUsdFromBrl } from "../../lib/format";
import type { PortfolioModel } from "../../types";

const CHART_COLORS = ["#56d8ff", "#7c8cff", "#37dda2", "#b584ff", "#ffb86b", "#f8799b", "#4eb6a5", "#8ca5c7"];

export function FiiDashboard({ model, usdRate, onNavigate }: { model: PortfolioModel; usdRate: number | null; onNavigate: (page: PageId) => void }) {
  const { metrics, positions, transactions } = model;
  const quotedPositions = positions.filter((position) => position.quoteAvailable);
  const valuationComplete = model.health.valuation === "complete";
  const allocation = quotedPositions.slice(0, 7).map((position) => ({ name: position.ticker, value: position.marketValue }));
  const additionalWarnings = model.warnings.filter(
    (warning) => !model.health.missingQuoteTickers.some((ticker) => warning.includes(ticker) && warning.includes("Cotação")),
  );

  return (
    <div className="page-stack">
      <DataHealthNotice model={model} showAnnual={false} />
      {additionalWarnings.length > 0 && <div className="refresh-message refresh-message--warning fii-data-warning" role="status">{additionalWarnings.length === 1 ? additionalWarnings[0] : `${additionalWarnings.length} avisos adicionais de integridade foram identificados na carteira de FIIs.`}</div>}
      <section className="hero-card hero-card--fii">
        <div>
          <span className="eyebrow">{valuationComplete ? "VALOR ATUAL DA CARTEIRA DE FIIs" : "VALOR CONHECIDO DA CARTEIRA DE FIIs (PARCIAL)"}</span>
          <strong>{formatBrl(metrics.marketValue)}</strong>
          <small className="hero-card__converted currency-conversion">{formatUsdFromBrl(metrics.marketValue, usdRate)}</small>
          {valuationComplete ? <p><Value value={metrics.unrealizedProfit}>{formatBrl(metrics.unrealizedProfit)} ({formatPercent(metrics.openReturn)})</Value><span> de resultado nas cotas abertas</span></p> : <p>Resultado em aberto indisponível enquanto faltam cotações.</p>}
        </div>
        <div className="hero-card__summary">
          <span><small>Custo atual</small><strong>{formatBrl(metrics.openCost)}</strong></span>
          <span><small>Posições</small><strong>{metrics.openPositions}</strong></span>
          <span><small>Fundos monitorados</small><strong>{metrics.assetCount}</strong></span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Total histórico comprado" value={formatBrl(metrics.historicalPurchases)} secondaryValue={formatUsdFromBrl(metrics.historicalPurchases, usdRate)} icon={<WalletCards size={19} />} helper="Aportes acumulados em FIIs" accent="blue" />
        <MetricCard label="Lucro realizado" value={formatBrl(metrics.realizedProfit)} secondaryValue={formatUsdFromBrl(metrics.realizedProfit, usdRate)} icon={<BadgeDollarSign size={19} />} helper="Em cotas vendidas" change={metrics.realizedProfit} accent="green" />
        <MetricCard label="Resultado em aberto" value={valuationComplete ? formatBrl(metrics.unrealizedProfit) : "Indisponível"} secondaryValue={valuationComplete ? formatUsdFromBrl(metrics.unrealizedProfit, usdRate) : undefined} icon={<TrendingUp size={19} />} helper={valuationComplete ? formatPercent(metrics.openReturn) : "Aguardando cotações"} change={valuationComplete ? metrics.unrealizedProfit : undefined} accent="violet" />
        <MetricCard label="Resultado total" value={valuationComplete ? formatBrl(metrics.totalProfit) : "Indisponível"} secondaryValue={valuationComplete ? formatUsdFromBrl(metrics.totalProfit, usdRate) : undefined} icon={<CircleDollarSign size={19} />} helper={valuationComplete ? `${formatPercent(metrics.totalReturnOnPurchases)} sobre compras` : "Aguardando cotações"} change={valuationComplete ? metrics.totalProfit : undefined} accent="amber" />
      </section>

      <section className="dashboard-grid dashboard-grid--lower">
        <Section title="Distribuição dos FIIs" subtitle="Participação por valor de mercado" className="chart-panel">
          <div className="donut-layout">
            <div className="chart-box chart-box--donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocation} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
                    {allocation.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatBrl(Number(value))} contentStyle={{ background: "#101d30", border: "1px solid #273851", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><Layers3 size={17} /><strong>{quotedPositions.length}</strong><small>cotados</small></div>
            </div>
            <div className="chart-legend">
              {quotedPositions.slice(0, 7).map((position, index) => <div key={position.ticker}><span className="legend-dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><strong>{position.ticker}</strong><span>{formatPercent(position.allocation)}</span></div>)}
            </div>
          </div>
        </Section>

        <Section title="Movimentações recentes" subtitle={`${transactions.length} registros de FIIs processados`} sensitiveSubtitle action={<button className="text-button" type="button" onClick={() => onNavigate("fii-history")}>Ver histórico <ArrowRight size={15} /></button>}>
          <div className="compact-table">
            {transactions.slice(0, 6).map((item) => <div key={item.id}><span className={`transaction-icon transaction-icon--${item.type}`}>{item.type === "buy" ? "+" : "−"}</span><span><strong>{item.ticker}</strong><small>{formatDate(item.date)}</small></span><span><strong>{formatBrl(item.total)}</strong><small>{formatNumber(item.quantity, 4)} cotas</small></span></div>)}
          </div>
          <div className="source-strip"><Building2 size={15} /> Cotações de FIIs provenientes da aba FII BASE</div>
        </Section>
      </section>
    </div>
  );
}
