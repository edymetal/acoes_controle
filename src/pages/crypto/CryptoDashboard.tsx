import { ArrowRight, BadgeDollarSign, Bitcoin, CircleDollarSign, Layers3, TrendingUp, WalletCards } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PageId } from "../../components/Shell";
import { CryptoLogo, DataHealthNotice, MetricCard, Section, Value } from "../../components/Ui";
import { formatCurrency, formatNumber, formatPercent, formatTransactionDate } from "../../lib/format";
import type { PortfolioModel } from "../../types";

const CHART_COLORS = ["#f6b94a", "#7c8cff"];

export function CryptoDashboard({ model, onNavigate }: { model: PortfolioModel; onNavigate: (page: PageId) => void }) {
  const { metrics, positions, transactions } = model;
  const quotedPositions = positions.filter((position) => position.quoteAvailable && position.accountingReliable);
  const valuationComplete = model.health.valuation === "complete";
  const accountingComplete = model.health.accounting === "complete";
  const financialResultsComplete = valuationComplete && accountingComplete;
  const allocation = quotedPositions.map((position) => ({ name: position.ticker, value: position.marketValue }));
  const additionalWarnings = model.warnings.filter(
    (warning) =>
      !model.health.missingQuoteTickers.some((ticker) => warning.includes(ticker) && warning.includes("Cotação"))
      && !model.health.ambiguousTransactionTickers.some((ticker) => warning.includes(ticker) && warning.includes("Compra e venda")),
  );

  return (
    <div className="page-stack">
      <DataHealthNotice model={model} showAnnual={false} />
      {additionalWarnings.length > 0 && <div className="refresh-message refresh-message--warning crypto-data-warning" role="status">{additionalWarnings.length === 1 ? additionalWarnings[0] : `${additionalWarnings.length} avisos adicionais de integridade foram identificados na carteira de cripto.`}</div>}
      <section className="hero-card hero-card--crypto">
        <div>
          <span className="eyebrow">{financialResultsComplete ? "VALOR ATUAL DA CARTEIRA DE CRIPTO" : "VALOR CONHECIDO DA CARTEIRA DE CRIPTO (PARCIAL)"}</span>
          <strong>{formatCurrency(metrics.marketValue)}</strong>
          {financialResultsComplete ? <p><Value value={metrics.unrealizedProfit}>{formatCurrency(metrics.unrealizedProfit)} ({formatPercent(metrics.openReturn)})</Value><span> de resultado nas posições abertas</span></p> : <p>Resultado em aberto indisponível enquanto faltam cotações ou a ordem real das operações.</p>}
        </div>
        <div className="hero-card__summary">
          <span><small>Custo atual</small><strong>{accountingComplete ? formatCurrency(metrics.openCost) : "Indisponível"}</strong></span>
          <span><small>Posições</small><strong>{metrics.openPositions}</strong></span>
          <span><small>Criptos monitoradas</small><strong>{metrics.assetCount}</strong></span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Total histórico comprado" value={formatCurrency(metrics.historicalPurchases)} icon={<WalletCards size={19} />} helper="Aportes acumulados em cripto" accent="blue" />
        <MetricCard label="Lucro realizado" value={accountingComplete ? formatCurrency(metrics.realizedProfit) : "Indisponível"} icon={<BadgeDollarSign size={19} />} helper={accountingComplete ? "Em criptos vendidas" : "Ordem das operações ambígua"} change={accountingComplete ? metrics.realizedProfit : undefined} accent="green" />
        <MetricCard label="Resultado em aberto" value={financialResultsComplete ? formatCurrency(metrics.unrealizedProfit) : "Indisponível"} icon={<TrendingUp size={19} />} helper={financialResultsComplete ? formatPercent(metrics.openReturn) : "Base financeira incompleta"} change={financialResultsComplete ? metrics.unrealizedProfit : undefined} accent="violet" />
        <MetricCard label="Resultado total" value={financialResultsComplete ? formatCurrency(metrics.totalProfit) : "Indisponível"} icon={<CircleDollarSign size={19} />} helper={financialResultsComplete ? `${formatPercent(metrics.totalReturnOnPurchases)} sobre compras` : "Base financeira incompleta"} change={financialResultsComplete ? metrics.totalProfit : undefined} accent="amber" />
      </section>

      <section className="dashboard-grid dashboard-grid--lower">
        <Section title="Distribuição das criptos" subtitle="Participação por valor de mercado" className="chart-panel">
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
              <div className="donut-center"><Layers3 size={17} /><strong>{quotedPositions.length}</strong><small>cotadas</small></div>
            </div>
            <div className="chart-legend chart-legend--crypto">
              {quotedPositions.map((position) => <div key={position.ticker}><CryptoLogo ticker={position.ticker} size="small" /><span className="crypto-legend__asset"><strong>{position.name}</strong><small>{position.ticker}</small></span><span>{formatPercent(position.allocation)}</span></div>)}
            </div>
          </div>
        </Section>

        <Section title="Movimentações recentes" subtitle={`${transactions.length} registros de cripto processados`} sensitiveSubtitle action={<button className="text-button" type="button" onClick={() => onNavigate("crypto-history")}>Ver histórico <ArrowRight size={15} /></button>}>
          <div className="compact-table">
            {transactions.slice(0, 6).map((item) => <div key={item.id}><CryptoLogo ticker={item.ticker} size="compact" /><span><strong>{item.ticker}</strong><small>{item.type === "buy" ? "Compra" : "Venda"} · {formatTransactionDate(item.date, item.time)}</small></span><span><strong>{formatCurrency(item.total)}</strong><small>{formatNumber(item.quantity, 8)} moedas</small></span></div>)}
          </div>
          <div className="source-strip"><Bitcoin size={15} /> Cotações de Bitcoin, Ethereum e BNB provenientes da aba Cripto Base</div>
        </Section>
      </section>
    </div>
  );
}
