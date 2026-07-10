import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatDateTime } from "../lib/format";

export type PageId = "dashboard" | "portfolio" | "history" | "strategy";

const pages: Array<{ id: PageId; label: string; description: string; icon: ReactNode }> = [
  { id: "dashboard", label: "Dashboard", description: "Visão consolidada da sua carteira", icon: <LayoutDashboard size={19} /> },
  { id: "portfolio", label: "Carteira", description: "Posições e resultado em aberto", icon: <BriefcaseBusiness size={19} /> },
  { id: "history", label: "Movimentações", description: "Histórico completo de compras e vendas", icon: <Clock3 size={19} /> },
  { id: "strategy", label: "Estratégia anual", description: "Sinais pela faixa de preço de 12 meses", icon: <Sparkles size={19} /> },
];

interface ShellProps {
  page: PageId;
  onPageChange: (page: PageId) => void;
  updatedAt: string;
  children: ReactNode;
}

export function Shell({ page, onPageChange, updatedAt, children }: ShellProps) {
  const current = pages.find((item) => item.id === page) ?? pages[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark"><BarChart3 size={23} /></span>
          <span><strong>Atlas</strong><small>Equity Intelligence</small></span>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <span className="main-nav__label">ANÁLISE</span>
          {pages.map((item) => (
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
        </nav>
        <div className="sidebar__footer">
          <div className="security-note"><ShieldCheck size={18} /><span><strong>Dados protegidos</strong><small>Somente leitura</small></span></div>
          <p>Indicadores para acompanhamento. Não constituem recomendação de investimento.</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <span className="eyebrow"><Activity size={14} /> MERCADO AMERICANO</span>
            <h1>{current.label}</h1>
            <p>{current.description}</p>
          </div>
          <div className="sync-status">
            <span className="sync-status__dot" aria-hidden="true" />
            <span><small>Atualizado em</small><strong>{formatDateTime(updatedAt)}</strong></span>
            <button type="button" onClick={() => window.location.reload()} aria-label="Atualizar página" title="Atualizar página"><RefreshCw size={17} /></button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

