import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, RotateCcw, X } from "lucide-react";
import { EmptyState, StockLogo, Value } from "../components/Ui";
import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatTransactionDate } from "../lib/format";
import { loadAppLanguage } from "../lib/i18n";
import { getStockActivity, getStockMarketLinks } from "../lib/stockDetails";
import type { Asset, PortfolioModel } from "../types";

const PAGE_SIZE = 10;

export function StrategyAssetModal({ asset, model, generatedAt, onClose }: {
  asset: Asset;
  model: PortfolioModel;
  generatedAt: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(1);
  const [chartRevision, setChartRevision] = useState(0);
  const activity = useMemo(() => getStockActivity(model, asset.ticker), [model, asset.ticker]);
  const links = getStockMarketLinks(asset, loadAppLanguage());
  const { position, accountingReliable } = activity;
  const quoteAvailable = asset.currentPrice > 0;
  const openResultAvailable = accountingReliable && (!position || position.quoteAvailable);
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
    <dialog className="asset-modal strategy-asset-modal" ref={dialogRef} aria-labelledby="strategy-asset-title" onCancel={onClose} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
      <header className="asset-modal__header">
        <div><StockLogo ticker={asset.ticker} /><span><small>ESTRATÉGIA ANUAL · {asset.exchange}</small><h2 id="strategy-asset-title">{asset.ticker} · {asset.name}</h2></span></div>
        <button type="button" aria-label="Fechar detalhes do ativo" autoFocus onClick={onClose}><X size={21} /></button>
      </header>

      <section className="stock-market-chart" aria-labelledby="stock-market-chart-title">
        <header>
          <div><h3 id="stock-market-chart-title">Cotação nos últimos 12 meses</h3><p>Gráfico interativo de preços e variação do ativo</p></div>
          <a className="stock-market-link" href={links.googleFinanceUrl} target="_blank" rel="noopener noreferrer">Google Finance <ExternalLink size={15} /></a>
        </header>
        {links.chartUrl ? <>
          <iframe
            key={chartRevision}
            className="stock-market-chart__frame"
            src={links.chartUrl}
            title={`Gráfico de cotação de ${asset.ticker} no período de um ano`}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
          <footer><a href={links.tradingViewUrl!} target="_blank" rel="noopener noreferrer">Gráfico por TradingView <ExternalLink size={13} /></a><button type="button" className="text-button" onClick={() => setChartRevision((value) => value + 1)}><RotateCcw size={14} /> Recarregar gráfico</button></footer>
          <p className="stock-market-chart__note">As cotações do gráfico podem ter atraso e diferir da planilha. Se o gráfico estiver indisponível, consulte o ativo no Google Finance.</p>
        </> : <p className="asset-modal__note">A bolsa deste ativo não está disponível no gráfico integrado. Consulte o histórico pelo link do Google Finance.</p>}
      </section>

      <section className="stock-annual-stats" aria-label="Preços anuais da planilha">
        <article><small>Cotação na planilha</small><strong className="privacy-value">{quoteAvailable ? formatCurrency(asset.currentPrice) : "Indisponível"}</strong></article>
        <article><small>Mínima anual</small><strong className="privacy-value">{annual ? formatCurrency(annual.min) : "Indisponível"}</strong></article>
        <article><small>Média anual</small><strong className="privacy-value">{annual ? formatCurrency(annual.average) : "Indisponível"}</strong></article>
        <article><small>Máxima anual</small><strong className="privacy-value">{annual ? formatCurrency(annual.max) : "Indisponível"}</strong></article>
      </section>
      <p className="stock-details-updated">Planilha atualizada em {formatDateTime(generatedAt)}.{annual?.isFallback && ` Preços anuais preservados da última leitura válida${annual.asOf ? ` de ${formatDateTime(annual.asOf)}` : ""}.`}</p>

      <section className="stock-activity" aria-labelledby="stock-activity-title">
        <h3 id="stock-activity-title">Sua posição e movimentações</h3>
        {!accountingReliable && <p className="asset-modal__note">Os resultados e a posição estão indisponíveis porque a ordem das operações deste ativo precisa ser esclarecida.</p>}
        <div className="stock-activity__metrics">
          <article><small>Posição atual</small><strong>{accountingReliable ? `${formatNumber(position?.quantity ?? 0, 6)} ações` : "Indisponível"}</strong><em>{openResultAvailable ? `${formatCurrency(position?.marketValue ?? 0)} em valor de mercado` : "Valor de mercado indisponível"}</em></article>
          <article><small>Custo em aberto</small><strong>{accountingReliable ? formatCurrency(position?.costBasis ?? 0) : "Indisponível"}</strong><em>{accountingReliable && position ? `Preço médio ${formatCurrency(position.averageCost)}` : ""}</em></article>
          <article><small>Resultado em aberto</small>{openResultAvailable ? <Value value={position?.unrealized ?? 0}><strong>{formatCurrency(position?.unrealized ?? 0)}</strong></Value> : <strong>Indisponível</strong>}<em>{openResultAvailable && position ? formatPercent(position.unrealizedPercent) : ""}</em></article>
          <article><small>Total comprado</small><strong>{formatCurrency(activity.purchaseTotal)}</strong><em>{activity.purchaseCount} {activity.purchaseCount === 1 ? "compra" : "compras"}</em></article>
          <article><small>Total vendido</small><strong>{formatCurrency(activity.saleTotal)}</strong><em>{activity.saleCount} {activity.saleCount === 1 ? "venda" : "vendas"}</em></article>
          <article><small>Lucro realizado</small>{activity.realizedProfit !== null ? <Value value={activity.realizedProfit}><strong>{formatCurrency(activity.realizedProfit)}</strong></Value> : <strong>Indisponível</strong>}<em>Resultado das vendas concluídas</em></article>
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
