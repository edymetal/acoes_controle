import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatDateTime } from "../lib/format";

export type PageId = "dashboard" | "portfolio" | "history" | "strategy" | "settings";

const pages: Array<{ id: PageId; label: string; description: string; icon: ReactNode }> = [
  { id: "dashboard", label: "Dashboard", description: "Visão consolidada da sua carteira", icon: <LayoutDashboard size={19} /> },
  { id: "portfolio", label: "Carteira", description: "Posições e resultado em aberto", icon: <BriefcaseBusiness size={19} /> },
  { id: "history", label: "Movimentações", description: "Histórico completo de compras e vendas", icon: <Clock3 size={19} /> },
  { id: "strategy", label: "Estratégia anual", description: "Sinais pela faixa de preço de 12 meses", icon: <Sparkles size={19} /> },
  { id: "settings", label: "Configurações", description: "Personalize os limites dos sinais", icon: <Settings2 size={19} /> },
];

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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark"><BarChart3 size={23} /></span>
          <span><strong>Controle</strong><small>de Ações</small></span>
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
            <button type="button" onClick={onRefresh} disabled={isRefreshing} aria-label="Atualizar dados" title="Atualizar dados"><RefreshCw className={isRefreshing ? "spin" : undefined} size={17} /></button>
          </div>
        </header>
        {refreshMessage && <div className={`refresh-message refresh-message--${refreshMessage.kind}`} role="status">{refreshMessage.text}</div>}
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
