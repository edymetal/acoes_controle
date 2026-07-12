import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bitcoin,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  Sparkles,
  Landmark,
} from "lucide-react";
import { formatDateTime } from "../lib/format";

export type PageId = "overview" | "dashboard" | "portfolio" | "history" | "strategy" | "settings" | "fii-dashboard" | "fii-portfolio" | "fii-history" | "crypto-dashboard" | "crypto-portfolio" | "crypto-history" | "fixed-income-dashboard" | "fixed-income-portfolio" | "fixed-income-ladder";

type Topic = "overview" | "stocks" | "fiis" | "crypto" | "fixed-income";
interface PageDefinition { id: PageId; label: string; description: string; icon: ReactNode; topic: Topic }

const overviewPage: PageDefinition = { id: "overview", label: "Visão geral", description: "Panorama consolidado de todos os seus investimentos", icon: <LayoutDashboard size={19} />, topic: "overview" };

const stockPages: PageDefinition[] = [
  { id: "dashboard", label: "Dashboard", description: "Visão consolidada da sua carteira", icon: <LayoutDashboard size={19} />, topic: "stocks" },
  { id: "portfolio", label: "Carteira", description: "Posições e resultado em aberto", icon: <BriefcaseBusiness size={19} />, topic: "stocks" },
  { id: "history", label: "Movimentações", description: "Histórico completo de compras e vendas", icon: <Clock3 size={19} />, topic: "stocks" },
  { id: "strategy", label: "Estratégia anual", description: "Sinais pela faixa de preço de 12 meses", icon: <Sparkles size={19} />, topic: "stocks" },
  { id: "settings", label: "Configurações", description: "Personalize os limites dos sinais", icon: <Settings2 size={19} />, topic: "stocks" },
];

const fiiPages: PageDefinition[] = [
  { id: "fii-dashboard", label: "Visão geral", description: "Resumo exclusivo da sua carteira de fundos imobiliários", icon: <LayoutDashboard size={19} />, topic: "fiis" },
  { id: "fii-portfolio", label: "Carteira de FIIs", description: "Cotas, custos e valores atuais dos fundos", icon: <Building2 size={19} />, topic: "fiis" },
  { id: "fii-history", label: "Movimentações", description: "Histórico separado de compras e vendas de FIIs", icon: <Clock3 size={19} />, topic: "fiis" },
];

const cryptoPages: PageDefinition[] = [
  { id: "crypto-dashboard", label: "Visão geral", description: "Resumo exclusivo da sua carteira de criptomoedas", icon: <LayoutDashboard size={19} />, topic: "crypto" },
  { id: "crypto-portfolio", label: "Carteira de Cripto", description: "Posições, custos e valores atuais de Bitcoin e Ethereum", icon: <Bitcoin size={19} />, topic: "crypto" },
  { id: "crypto-history", label: "Movimentações", description: "Histórico separado de compras e vendas de criptomoedas", icon: <Clock3 size={19} />, topic: "crypto" },
];

const fixedIncomePages: PageDefinition[] = [
  { id: "fixed-income-dashboard", label: "Visão geral", description: "Resumo exclusivo dos seus investimentos de renda fixa", icon: <LayoutDashboard size={19} />, topic: "fixed-income" },
  { id: "fixed-income-portfolio", label: "Carteira de Renda Fixa", description: "Aportes, vencimentos, valores a receber e lucros", icon: <Landmark size={19} />, topic: "fixed-income" },
  { id: "fixed-income-ladder", label: "Escada de vencimentos", description: "Cobertura dos 12 meses e oportunidades para completar a estratégia", icon: <CalendarRange size={19} />, topic: "fixed-income" },
];

const pages = [overviewPage, ...stockPages, ...fiiPages, ...cryptoPages, ...fixedIncomePages];

interface ShellProps {
  page: PageId;
  onPageChange: (page: PageId) => void;
  updatedAt: string;
  isRefreshing: boolean;
  refreshMessage: { kind: "success" | "warning" | "error"; text: string } | null;
  onRefresh: () => void;
  children: ReactNode;
}

export function Shell({ page, onPageChange, updatedAt, isRefreshing, refreshMessage, onRefresh, children }: ShellProps) {
  const current = pages.find((item) => item.id === page) ?? pages[0];
  const currentTopic = current.topic;
  const [openTopic, setOpenTopic] = useState<Topic | null>(currentTopic === "overview" ? null : currentTopic);

  useEffect(() => {
    if (currentTopic !== "overview") setOpenTopic(currentTopic);
  }, [currentTopic]);

  const renderTopic = (topic: Topic, label: string, topicPages: PageDefinition[]) => {
    const isOpen = openTopic === topic;
    const panelId = `nav-topic-${topic}`;

    return (
      <div className={`main-nav__group ${isOpen ? "main-nav__group--open" : ""}`}>
        <button
          type="button"
          className="main-nav__topic"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => {
            setOpenTopic(topic);
            onPageChange(topicPages[0].id);
          }}
        >
          <span>{label}</span><ChevronDown size={17} aria-hidden="true" />
        </button>
        {isOpen && (
          <div className="main-nav__pages" id={panelId}>
            {topicPages.map((item) => (
              <button
                type="button"
                key={item.id}
                className={page === item.id ? "active" : ""}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => onPageChange(item.id)}
              >
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark"><BarChart3 size={23} /></span>
          <span><strong>Controle</strong><small>de Investimentos</small></span>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <button
            type="button"
            className={`main-nav__overview ${page === "overview" ? "active" : ""}`}
            aria-current={page === "overview" ? "page" : undefined}
            onClick={() => onPageChange("overview")}
          >
            {overviewPage.icon}<span>{overviewPage.label}</span>
          </button>
          {renderTopic("stocks", "AÇÕES", stockPages)}
          {renderTopic("fiis", "FIIs", fiiPages)}
          {renderTopic("crypto", "CRIPTO", cryptoPages)}
          {renderTopic("fixed-income", "RENDA FIXA", fixedIncomePages)}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <span className="eyebrow"><Activity size={14} /> {current.topic === "overview" ? "TODOS OS INVESTIMENTOS" : current.topic === "fiis" ? "FUNDOS IMOBILIÁRIOS · B3" : current.topic === "crypto" ? "MERCADO DE CRIPTOMOEDAS · USD" : current.topic === "fixed-income" ? "RENDA FIXA · BRL" : "MERCADO AMERICANO"}</span>
            <h1>{current.label}</h1>
            <p>{current.description}</p>
          </div>
          <div className="sync-status">
            <span className="sync-status__dot" aria-hidden="true" />
            <span><small>Atualizado em</small><strong>{formatDateTime(updatedAt)}</strong></span>
            <button type="button" onClick={onRefresh} disabled={isRefreshing} aria-label="Recarregar dados publicados" title="Recarregar dados publicados"><RefreshCw className={isRefreshing ? "spin" : undefined} size={17} /></button>
          </div>
        </header>
        {refreshMessage && <div className={`refresh-message refresh-message--${refreshMessage.kind}`} role="status">{refreshMessage.text}</div>}
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
