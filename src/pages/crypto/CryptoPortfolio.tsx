import { useMemo, useState } from "react";
import { BriefcaseBusiness, Search, SlidersHorizontal, TrendingUp, WalletCards } from "lucide-react";
import { CryptoLogo, EmptyState, MetricCard, Section, Value } from "../../components/Ui";
import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";
import type { PortfolioModel } from "../../types";

export function CryptoPortfolio({ model }: { model: PortfolioModel }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("market-desc");
  const positions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return model.positions.filter((item) => !query || item.ticker.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)).sort((a, b) => {
      if (sort === "pnl-desc") return b.unrealizedPercent - a.unrealizedPercent;
      if (sort === "pnl-asc") return a.unrealizedPercent - b.unrealizedPercent;
      if (sort === "ticker") return a.ticker.localeCompare(b.ticker);
      return b.marketValue - a.marketValue;
    });
  }, [model.positions, search, sort]);

  return <div className="page-stack">
    <section className="metrics-grid metrics-grid--three">
      <MetricCard label="Custo das posições" value={formatCurrency(model.metrics.openCost)} icon={<WalletCards size={19} />} helper="Base de custo em dólar" accent="blue" />
      <MetricCard label="Valor de mercado" value={formatCurrency(model.metrics.marketValue)} icon={<BriefcaseBusiness size={19} />} helper={`${model.metrics.openPositions} criptos na carteira`} accent="violet" />
      <MetricCard label="Resultado em aberto" value={formatCurrency(model.metrics.unrealizedProfit)} icon={<TrendingUp size={19} />} helper={formatPercent(model.metrics.openReturn)} change={model.metrics.unrealizedProfit} accent="green" />
    </section>
    <Section title="Posições em cripto" subtitle="Custo médio móvel e cotação atual em dólares">
      <div className="toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar Bitcoin, Ethereum ou BNB" /></label>
        <label className="select-field"><SlidersHorizontal size={16} /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="market-desc">Maior posição</option><option value="pnl-desc">Maior rentabilidade</option><option value="pnl-asc">Menor rentabilidade</option><option value="ticker">Código A–Z</option></select></label>
      </div>
      {positions.length ? <div className="table-wrap"><table className="portfolio-table"><thead><tr><th>Cripto</th><th>Quantidade</th><th>Preço médio</th><th>Cotação</th><th>Custo</th><th>Valor atual</th><th>Participação</th><th>Resultado aberto</th></tr></thead><tbody>
        {positions.map((position) => <tr key={position.ticker}><td><div className="asset-cell"><CryptoLogo ticker={position.ticker} /><span><strong>{position.ticker}</strong><small>{position.name}</small></span></div></td><td>{formatNumber(position.quantity, 8)}</td><td>{formatCurrency(position.averageCost)}</td><td>{formatCurrency(position.currentPrice)}</td><td>{formatCurrency(position.costBasis)}</td><td><strong>{formatCurrency(position.marketValue)}</strong></td><td><div className="allocation-cell"><span>{formatPercent(position.allocation)}</span><span className="mini-progress"><i style={{ width: `${Math.max(3, position.allocation * 100)}%` }} /></span></div></td><td><Value value={position.unrealized}><strong>{formatCurrency(position.unrealized)}</strong><small>{formatPercent(position.unrealizedPercent)}</small></Value></td></tr>)}
      </tbody></table></div> : <EmptyState title="Nenhuma cripto encontrada" description="Ajuste a busca para visualizar Bitcoin, Ethereum ou BNB." />}
    </Section>
  </div>;
}
