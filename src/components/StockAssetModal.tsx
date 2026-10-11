import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowDownRight, ArrowDownToLine, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, ArrowUpToLine, BadgeDollarSign, Banknote, CalendarDays, ChartCandlestick, ChartNoAxesCombined, Clock3, Database, ExternalLink, Minus, RotateCcw, TrendingDown, TrendingUp, Wallet, X, type LucideIcon } from "lucide-react";
import { EmptyState, StockLogo, Value } from "./Ui";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, formatTransactionDate, toneForValue } from "../lib/format";
import { loadAppLanguage } from "../lib/i18n";
import { getStockActivity, getStockMarketLinks, STOCK_CHART_PERIODS, type StockChartPeriod } from "../lib/stockDetails";
import type { Asset, PortfolioModel } from "../types";

const PAGE_SIZE = 10;

type CardTone = "blue" | "violet" | "amber" | "green" | "rose" | "neutral";

function StockMetricCard({ label, value, helper, icon: Icon, tone, featured = false, unavailable = false }: {
  label: string;
  value: ReactNode;
  helper: ReactNode;
  icon: LucideIcon;
  tone: CardTone;
  featured?: boolean;
  unavailable?: boolean;
}) {
  return (
    <article className={`stock-metric-card stock-metric-card--${unavailable ? "neutral" : tone}${featured ? " stock-metric-card--featured" : ""}`}>
      <div className="stock-metric-card__header"><span className="stock-metric-card__icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span><span className="stock-metric-card__label">{label}</span></div>
      <strong className={`stock-metric-card__value privacy-value${unavailable ? " stock-metric-card__value--unavailable" : ""}`}>{value}</strong>
      <div className="stock-metric-card__helper">{helper}</div>
    </article>
  );
}

function resultCardTone(value: number | null): CardTone {
  const tone = value === null ? "neutral" : toneForValue(value);
  return tone === "positive" ? "green" : tone === "negative" ? "rose" : "neutral";
}

export function StockAssetModal({ asset, model, generatedAt, contextLabel, onClose }: {
  asset: Asset;
  model: PortfolioModel;
  generatedAt: string;
  contextLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(1);
  const [chartRevision, setChartRevision] = useState(0);
  const [chartPeriod, setChartPeriod] = useState<StockChartPeriod>("1y");
  const selectedPeriod = STOCK_CHART_PERIODS.find((item) => item.id === chartPeriod)!;
  const activity = useMemo(() => getStockActivity(model, asset.ticker), [model, asset.ticker]);
  const links = getStockMarketLinks(asset, loadAppLanguage(), chartPeriod);
  const { position, accountingReliable } = activity;
  const quoteAvailable = asset.currentPrice > 0;
  const openResultAvailable = accountingReliable && (!position || position.quoteAvailable);
  const openResult = openResultAvailable ? position?.unrealized ?? 0 : null;
  const OpenResultIcon = openResult === null || toneForValue(openResult) === "neutral" ? Minus : openResult > 0 ? TrendingUp : TrendingDown;
  const OpenChangeIcon = openResult === null || toneForValue(openResult) === "neutral" ? Minus : openResult < 0 ? ArrowDownRight : ArrowUpRight;
  const annual = asset.annual;
  const totalPages = Math.max(1, Math.ceil(activity.transactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleTransactions = activity.transactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  return (
    <dialog className="asset-modal stock-asset-modal" ref={dialogRef} aria-labelledby="stock-asset-title" onCancel={onClose} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
      <header className="asset-modal__header">
        <div><StockLogo ticker={asset.ticker} /><span><small>{contextLabel} · {asset.exchange}</small><h2 id="stock-asset-title">{asset.ticker} · {asset.name}</h2></span></div>
        <button type="button" aria-label="Fechar detalhes do ativo" autoFocus onClick={onClose}><X size={21} /></button>
      </header>

      <section className="stock-market-chart" aria-labelledby="stock-market-chart-title">
        <header>
          <div><h3 id="stock-market-chart-title">Histórico de cotações</h3><p>{selectedPeriod.description} · preços e variação do ativo</p></div>
          <a className="stock-market-link" href={links.googleFinanceUrl} target="_blank" rel="noopener noreferrer">Google Finance <ExternalLink size={15} /></a>
        </header>
        {links.chartUrl ? <>
          <div className="stock-chart-periods" role="group" aria-label="Período do gráfico">
            {STOCK_CHART_PERIODS.map((period) => <button key={period.id} type="button" className={chartPeriod === period.id ? "active" : ""} aria-pressed={chartPeriod === period.id} onClick={() => setChartPeriod(period.id)}>{period.label}</button>)}
          </div>
          <iframe
            key={`${chartPeriod}-${chartRevision}`}
            className="stock-market-chart__frame"
            src={links.chartUrl}
            title={`Gráfico de cotação de ${asset.ticker}: ${selectedPeriod.description.toLowerCase()}`}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
          <footer><a href={links.tradingViewUrl!} target="_blank" rel="noopener noreferrer">Gráfico por TradingView <ExternalLink size={13} /></a><button type="button" className="text-button" onClick={() => setChartRevision((value) => value + 1)}><RotateCcw size={14} /> Recarregar gráfico</button></footer>
          <p className="stock-market-chart__note">As cotações do gráfico podem ter atraso e diferir da planilha. Se o gráfico estiver indisponível, consulte o ativo no Google Finance.</p>
        </> : <p className="asset-modal__note">A bolsa deste ativo não está disponível no gráfico integrado. Consulte o histórico pelo link do Google Finance.</p>}
      </section>

      <section className="stock-price-summary" aria-labelledby="stock-prices-title">
        <header className="stock-summary-heading"><div><ChartNoAxesCombined size={19} aria-hidden="true" /><h3 id="stock-prices-title">Preços do ativo</h3></div><span>USD · referência anual</span></header>
        <div className="stock-annual-stats">
          <StockMetricCard label="Cotação na planilha" icon={ChartCandlestick} tone="blue" featured unavailable={!quoteAvailable} value={quoteAvailable ? formatCurrency(asset.currentPrice) : "Indisponível"} helper="Última cotação informada" />
          <StockMetricCard label="Mínima anual" icon={ArrowDownToLine} tone="amber" unavailable={!annual} value={annual ? formatCurrency(annual.min) : "Indisponível"} helper="Menor fechamento em 12 meses" />
          <StockMetricCard label="Média anual" icon={ChartNoAxesCombined} tone="violet" unavailable={!annual} value={annual ? formatCurrency(annual.average) : "Indisponível"} helper="Média dos fechamentos diários" />
          <StockMetricCard label="Máxima anual" icon={ArrowUpToLine} tone="green" unavailable={!annual} value={annual ? formatCurrency(annual.max) : "Indisponível"} helper="Maior fechamento em 12 meses" />
        </div>
        {annual?.source === "massive" && <div className="stock-history-meta">
          <div className="stock-history-meta__source"><Database size={16} aria-hidden="true" /><div><span>Histórico por <a href="https://massive.com/" target="_blank" rel="noopener noreferrer">Massive</a> · {annual.observations} pregões</span><small>Fechamentos diários ajustados por desdobramentos</small></div></div>
          <div className="stock-history-meta__dates"><span><CalendarDays size={14} aria-hidden="true" />{formatDate(annual.periodStart!)} a {formatDate(annual.periodEnd!)}</span><span><Clock3 size={14} aria-hidden="true" />Atualizado em {formatDateTime(annual.asOf!)}</span></div>
        </div>}
        {!annual && <p className="stock-details-updated">Histórico anual indisponível. A integração Massive preenche esses preços na próxima atualização válida.</p>}
        <p className="stock-details-updated"><RotateCcw size={13} aria-hidden="true" /><span>Planilha atualizada em {formatDateTime(generatedAt)}.{annual?.isFallback && ` Preços anuais preservados da última leitura válida${annual.asOf ? ` de ${formatDateTime(annual.asOf)}` : ""}.`}</span></p>
      </section>

      <section className="stock-activity" aria-labelledby="stock-activity-title">
        <header className="stock-summary-heading"><div><Wallet size={19} aria-hidden="true" /><h3 id="stock-activity-title">Sua posição e movimentações</h3></div></header>
        {!accountingReliable && <p className="asset-modal__note">Os resultados e a posição estão indisponíveis porque a ordem das operações deste ativo precisa ser esclarecida.</p>}
        <div className="stock-activity__group" role="group" aria-labelledby="stock-position-title">
          <div className="stock-activity__group-heading"><h4 id="stock-position-title">Posição em carteira</h4><span>Valores atuais</span></div>
          <div className="stock-activity__metrics">
            <StockMetricCard label="Posição atual" icon={Wallet} tone="blue" featured unavailable={!accountingReliable} value={accountingReliable ? `${formatNumber(position?.quantity ?? 0, 6)} ações` : "Indisponível"} helper={<span className="privacy-value">{openResultAvailable ? `${formatCurrency(position?.marketValue ?? 0)} em valor de mercado` : "Valor de mercado indisponível"}</span>} />
            <StockMetricCard label="Custo em aberto" icon={Banknote} tone="violet" unavailable={!accountingReliable} value={accountingReliable ? formatCurrency(position?.costBasis ?? 0) : "Indisponível"} helper={<span className="privacy-value">{accountingReliable && position ? `Preço médio ${formatCurrency(position.averageCost)}` : accountingReliable ? "Sem posição em aberto" : "Custo indisponível"}</span>} />
            <StockMetricCard label="Resultado em aberto" icon={OpenResultIcon} tone={resultCardTone(openResult)} unavailable={!openResultAvailable} value={openResult !== null ? <Value value={openResult}>{formatCurrency(openResult)}</Value> : "Indisponível"} helper={openResultAvailable && position ? <span className="stock-metric-card__change privacy-value"><OpenChangeIcon size={14} aria-hidden="true" />{formatPercent(position.unrealizedPercent)} sobre o custo</span> : openResultAvailable ? "Sem posição em aberto" : "Resultado indisponível"} />
          </div>
        </div>
        <div className="stock-activity__group" role="group" aria-labelledby="stock-totals-title">
          <div className="stock-activity__group-heading"><h4 id="stock-totals-title"><ArrowLeftRight size={14} aria-hidden="true" />Movimentações acumuladas</h4><span>Todo o histórico</span></div>
          <div className="stock-activity__metrics">
            <StockMetricCard label="Total comprado" icon={ArrowDownLeft} tone="blue" value={formatCurrency(activity.purchaseTotal)} helper={<span className="stock-metric-card__count privacy-value">{activity.purchaseCount} {activity.purchaseCount === 1 ? "compra registrada" : "compras registradas"}</span>} />
            <StockMetricCard label="Total vendido" icon={ArrowUpRight} tone="amber" value={formatCurrency(activity.saleTotal)} helper={<span className="stock-metric-card__count privacy-value">{activity.saleCount} {activity.saleCount === 1 ? "venda registrada" : "vendas registradas"}</span>} />
            <StockMetricCard label="Lucro realizado" icon={BadgeDollarSign} tone={resultCardTone(activity.realizedProfit)} unavailable={activity.realizedProfit === null} value={activity.realizedProfit !== null ? <Value value={activity.realizedProfit}>{formatCurrency(activity.realizedProfit)}</Value> : "Indisponível"} helper="Resultado das vendas concluídas" />
          </div>
        </div>
        {visibleTransactions.length ? <>
          <div className="stock-activity__heading"><h4>Histórico de operações</h4><span>{activity.transactions.length} operações · todo o histórico</span></div>
          <div className="table-wrap table-wrap--stock-history">
            <table className="history-table stock-activity__table">
              <caption>Compras e vendas de {asset.ticker}, das mais recentes às mais antigas</caption>
              <thead><tr><th scope="col">Data</th><th scope="col">Tipo</th><th scope="col">Quantidade</th><th scope="col">Preço unitário</th><th scope="col">Valor total</th><th scope="col">Lucro realizado</th></tr></thead>
              <tbody>{visibleTransactions.map((item) => <tr key={item.id}>
                <td>{formatTransactionDate(item.date, item.time)}</td>
                <td><span className={`transaction-type transaction-type--${item.type}`}>{item.type === "buy" ? "Compra" : "Venda"}</span></td>
                <td className="privacy-value">{formatNumber(item.quantity, 8)}</td><td>{formatCurrency(item.unitPrice)}</td><td><strong>{formatCurrency(item.total)}</strong></td>
                <td>{item.type === "sell" ? accountingReliable && item.realizedProfit !== null ? <Value value={item.realizedProfit}><strong>{formatCurrency(item.realizedProfit)}</strong></Value> : <span className="data-unavailable">Indisponível</span> : <span className="table-dash">—</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {totalPages > 1 && <footer className="pagination"><span>Página {currentPage} de {totalPages}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={16} /> Anterior</button><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Próxima <ArrowRight size={16} /></button></div></footer>}
        </> : <EmptyState title="Nenhuma movimentação registrada" description="Este ativo ainda não possui compras ou vendas na planilha." />}
      </section>
    </dialog>
  );
}
