import { ArrowRight, Bitcoin, Building2, CircleDollarSign, Landmark, Layers3, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CSSProperties } from "react";
import type { PageId } from "../components/Shell";
import { Value } from "../components/Ui";
import { formatBrl, formatCurrency, formatPercent } from "../lib/format";
import type { FixedIncomeModel, PortfolioModel } from "../types";

interface OverviewProps {
  stockModel: PortfolioModel;
  fiiModel: PortfolioModel | null;
  cryptoModel: PortfolioModel | null;
  fixedIncomeModel: FixedIncomeModel | null;
  brlPerUsd: number | null;
  errors: { fiis: string | null; crypto: string | null; fixedIncome: string | null };
  onNavigate: (page: PageId) => void;
}

const TOPICS = [
  { key: "stocks", label: "Ações", currency: "USD", color: "#56d8ff", icon: <TrendingUp size={22} />, page: "dashboard" as PageId },
  { key: "fiis", label: "FIIs", currency: "BRL", color: "#7c8cff", icon: <Building2 size={22} />, page: "fii-dashboard" as PageId },
  { key: "crypto", label: "Cripto", currency: "USD", color: "#f6b94a", icon: <Bitcoin size={22} />, page: "crypto-dashboard" as PageId },
  { key: "fixedIncome", label: "Renda fixa", currency: "BRL", color: "#37dda2", icon: <Landmark size={22} />, page: "fixed-income-dashboard" as PageId },
] as const;

export function Overview({ stockModel, fiiModel, cryptoModel, fixedIncomeModel, brlPerUsd, errors, onNavigate }: OverviewProps) {
  const rate = brlPerUsd && brlPerUsd > 0 ? brlPerUsd : null;
  const topicData = {
    stocks: { value: stockModel.metrics.marketValue, consolidatedValue: stockModel.metrics.marketValue, result: stockModel.metrics.totalProfit, consolidatedResult: stockModel.metrics.totalProfit, rate: stockModel.metrics.openReturn, count: stockModel.metrics.openPositions, detail: "posições abertas", ready: true, complete: stockModel.health.valuation === "complete" },
    fiis: { value: fiiModel?.metrics.marketValue ?? 0, consolidatedValue: fiiModel?.metrics.marketValue ?? 0, result: fiiModel?.metrics.totalProfit ?? 0, consolidatedResult: fiiModel?.metrics.totalProfit ?? 0, rate: fiiModel?.metrics.openReturn ?? 0, count: fiiModel?.metrics.openPositions ?? 0, detail: "fundos na carteira", ready: Boolean(fiiModel), complete: fiiModel?.health.valuation === "complete" },
    crypto: { value: cryptoModel?.metrics.marketValue ?? 0, consolidatedValue: cryptoModel?.metrics.marketValue ?? 0, result: cryptoModel?.metrics.totalProfit ?? 0, consolidatedResult: cryptoModel?.metrics.totalProfit ?? 0, rate: cryptoModel?.metrics.openReturn ?? 0, count: cryptoModel?.metrics.openPositions ?? 0, detail: "moedas na carteira", ready: Boolean(cryptoModel), complete: cryptoModel?.health.valuation === "complete" },
    fixedIncome: { value: fixedIncomeModel?.metrics.netAmount ?? 0, consolidatedValue: fixedIncomeModel?.metrics.investedAmount ?? 0, result: fixedIncomeModel?.metrics.profit ?? 0, consolidatedResult: 0, rate: fixedIncomeModel?.metrics.returnRate ?? 0, count: fixedIncomeModel?.metrics.assetCount ?? 0, detail: "aplicações ativas", ready: Boolean(fixedIncomeModel), complete: Boolean(fixedIncomeModel) },
  };
  const toUsd = (value: number, currency: "USD" | "BRL") => currency === "USD" ? value : rate ? value / rate : 0;
  const availableTopics = TOPICS.filter((topic) => topicData[topic.key].ready && (topic.currency === "USD" || rate));
  const totalValue = availableTopics.reduce((sum, topic) => sum + toUsd(topicData[topic.key].consolidatedValue, topic.currency), 0);
  const totalResult = availableTopics.reduce((sum, topic) => sum + toUsd(topicData[topic.key].consolidatedResult, topic.currency), 0);
  const allocation = availableTopics.map((topic) => ({ name: topic.label, value: toUsd(topicData[topic.key].consolidatedValue, topic.currency), color: topic.color }));
  const hasCompleteConsolidation = Boolean(
    fiiModel
    && cryptoModel
    && fixedIncomeModel
    && rate
    && stockModel.health.valuation === "complete"
    && fiiModel.health.valuation === "complete"
    && cryptoModel.health.valuation === "complete",
  );
  const missingQuoteTickers = [
    ...stockModel.health.missingQuoteTickers,
    ...(fiiModel?.health.missingQuoteTickers ?? []),
    ...(cryptoModel?.health.missingQuoteTickers ?? []),
  ];

  return (
    <div className="page-stack overview-page">
      <section className="overview-hero">
        <div>
          <span className="eyebrow">{hasCompleteConsolidation ? "PATRIMÔNIO CONSOLIDADO" : "PATRIMÔNIO CONHECIDO (PARCIAL)"}</span>
          <strong>{formatCurrency(totalValue)}</strong>
          {hasCompleteConsolidation
            ? <p><Value value={totalResult}>{formatCurrency(totalResult)}</Value><span> de resultado acumulado, sem projeções futuras</span></p>
            : <p>Resultado consolidado indisponível enquanto as bases estão incompletas.</p>}
          <small className="overview-hero__notice">Renda fixa entra no patrimônio pelo valor aplicado; o valor futuro permanece separado no cartão da classe.</small>
          {!hasCompleteConsolidation && <small className="overview-hero__notice">Total parcial enquanto todas as bases, cotações dos ativos e cotação do dólar são carregadas.{missingQuoteTickers.length > 0 ? ` Sem cotação: ${missingQuoteTickers.join(", ")}.` : ""}</small>}
        </div>
        <div className="overview-hero__stats">
          <span><Layers3 size={18} /><small>Classes acompanhadas</small><strong>{TOPICS.filter((topic) => topicData[topic.key].ready).length}/4</strong></span>
          <span><CircleDollarSign size={18} /><small>Câmbio usado</small><strong>{rate ? formatBrl(rate) : "Indisponível"}</strong></span>
        </div>
      </section>

      <section className="overview-topic-grid" aria-label="Resumo por classe de investimento">
        {TOPICS.map((topic) => {
          const item = topicData[topic.key];
          const error = topic.key === "fiis" ? errors.fiis : topic.key === "crypto" ? errors.crypto : topic.key === "fixedIncome" ? errors.fixedIncome : null;
          return (
            <article className="overview-topic-card" key={topic.key} style={{ "--topic-color": topic.color } as CSSProperties}>
              <header><span className="overview-topic-card__icon">{topic.icon}</span><span><strong>{topic.label}</strong><small>{topic.currency === "USD" ? "Valores em dólar" : "Valores em reais"}</small></span></header>
              {item.ready ? <>
                <div className="overview-topic-card__value"><small>{topic.key === "fixedIncome" ? "Valor líquido a receber" : item.complete ? "Valor atual" : "Valor conhecido (parcial)"}</small><strong>{topic.currency === "USD" ? formatCurrency(item.value) : formatBrl(item.value)}</strong></div>
                {item.complete
                  ? <div className="overview-topic-card__result"><span><small>Resultado</small><Value value={item.result}>{topic.currency === "USD" ? formatCurrency(item.result) : formatBrl(item.result)}</Value></span><span><small>Rentabilidade</small><Value value={item.result}>{formatPercent(item.rate)}</Value></span></div>
                  : <div className="overview-topic-card__result overview-topic-card__result--unavailable"><span><small>Resultado</small><strong>Indisponível</strong></span><span><small>Rentabilidade</small><strong>Indisponível</strong></span></div>}
                <p>{item.count} {item.detail}</p>
              </> : <div className={`overview-topic-card__state ${error ? "overview-topic-card__state--error" : ""}`}><strong>{error ? "Dados indisponíveis" : "Carregando dados…"}</strong><small>{error ?? "Esta classe aparecerá assim que a base estiver pronta."}</small></div>}
              <button type="button" onClick={() => onNavigate(topic.page)} disabled={!item.ready}>Ver detalhes <ArrowRight size={16} /></button>
            </article>
          );
        })}
      </section>

      {allocation.length > 0 && <section className="panel overview-allocation">
        <header className="panel__header"><div><h2>Distribuição entre as classes</h2><p>Participação no patrimônio {hasCompleteConsolidation ? "consolidado" : "conhecido (parcial)"} em dólar</p></div></header>
        <div className="overview-allocation__content">
          <div className="overview-allocation__chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={3} stroke="none">{allocation.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: "#101d30", border: "1px solid #273851", borderRadius: 12 }} /></PieChart></ResponsiveContainer><div><strong>{formatCurrency(totalValue, true)}</strong><small>total</small></div></div>
          <div className="overview-allocation__legend">{allocation.map((item) => <div key={item.name}><i style={{ background: item.color }} /><span><strong>{item.name}</strong><small>{totalValue > 0 ? formatPercent(item.value / totalValue) : "0,0%"}</small></span><b>{formatCurrency(item.value)}</b></div>)}</div>
        </div>
      </section>}
    </div>
  );
}
