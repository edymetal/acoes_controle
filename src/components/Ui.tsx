import type { ReactNode } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { StrategySignal } from "../types";
import { toneForValue } from "../lib/format";

const stockLogoDomains: Record<string, string> = {
  AAPL: "apple.com", ADBE: "adobe.com", AMZN: "amazon.com", AZN: "astrazeneca.com", BAC: "bankofamerica.com",
  "BRK.B": "berkshirehathaway.com", CAT: "caterpillar.com", CSCO: "cisco.com", CVX: "chevron.com", DIS: "disney.com",
  GE: "ge.com", GOOGL: "google.com", IBM: "ibm.com", INTC: "intel.com", JNJ: "jnj.com",
  JPM: "jpmorganchase.com", KO: "coca-cola.com", LLY: "lilly.com", MA: "mastercard.com", MCD: "mcdonalds.com",
  META: "meta.com", MSFT: "microsoft.com", NKE: "nike.com", NVDA: "nvidia.com", NVS: "novartis.com",
  ORCL: "oracle.com", PEP: "pepsico.com", PFE: "pfizer.com", PG: "pg.com", SPCX: "spacex.com",
  T: "att.com", TM: "toyota.com", TSLA: "tesla.com", UNH: "unitedhealthgroup.com", UPS: "ups.com",
  V: "visa.com", VOD: "vodafone.com", XOM: "exxonmobil.com",
};

export function StockLogo({ ticker }: { ticker: string }) {
  const domain = stockLogoDomains[ticker];

  if (ticker === "GOOGL") {
    return <span className="ticker-avatar stock-logo stock-logo--google" title={ticker} role="img" aria-label="Logo da Google"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6 29.2 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5Z" /><path fill="#FF3D00" d="M6.3 14.7 12.9 19.5C14.7 15.1 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6 29.2 4 24 4c-7.7 0-14.4 4.4-17.7 10.7Z" /><path fill="#4CAF50" d="M24 44c5.1 0 9.9-2 13.5-5.3l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.5 16.2 44 24 44Z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.5l.1-.1 6.2 5.2C37.2 39 44 34 44 24c0-1.2-.1-2.3-.4-3.5Z" /></svg></span>;
  }

  if (ticker === "CSCO") {
    return <span className="ticker-avatar stock-logo stock-logo--cisco" title={ticker} role="img" aria-label="Logo da Cisco"><svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#049FD9"><path d="M7 7h2v15H7zM12 4h2v18h-2zM17 2h2v20h-2zM22 1h2v21h-2zM27 2h2v20h-2zM32 4h2v18h-2zM37 7h2v15h-2z" /><path d="M8.4 31.5c0-2.9 1.7-4.7 4.4-4.7 1.2 0 2.2.4 3 1.1l-1.2 1.5c-.5-.5-1.1-.8-1.8-.8-1.5 0-2.5 1.1-2.5 2.8s1 2.8 2.5 2.8c.8 0 1.4-.3 1.9-.8l1.2 1.4c-.8.8-1.8 1.2-3.1 1.2-2.7 0-4.4-1.8-4.4-4.5ZM17 27h2v8.8h-2zM20.4 34.4l1.2-1.4c.7.7 1.5 1.1 2.4 1.1.8 0 1.3-.3 1.3-.8 0-.6-.7-.8-1.7-1.1-1.5-.5-2.8-1-2.8-2.8 0-1.6 1.3-2.7 3.2-2.7 1.3 0 2.5.5 3.2 1.3L26 29.3c-.6-.5-1.3-.9-2.1-.9-.7 0-1.1.3-1.1.8 0 .5.7.7 1.7 1.1 1.5.5 2.8 1 2.8 2.8 0 1.7-1.4 2.8-3.4 2.8-1.5 0-2.8-.5-3.5-1.5ZM28.4 31.5c0-2.9 1.7-4.7 4.4-4.7 1.2 0 2.2.4 3 1.1l-1.2 1.5c-.5-.5-1.1-.8-1.8-.8-1.5 0-2.5 1.1-2.5 2.8s1 2.8 2.5 2.8c.8 0 1.4-.3 1.9-.8l1.2 1.4c-.8.8-1.8 1.2-3.1 1.2-2.7 0-4.4-1.8-4.4-4.5Z" /></g></svg></span>;
  }

  return (
    <span className="ticker-avatar stock-logo" title={ticker}>
      <span className="stock-logo__fallback" aria-hidden="true">{ticker.slice(0, 2)}</span>
      {domain && <img src={`https://cdn.tickerlogos.com/${domain}`} data-fallback={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`} alt={`Logo de ${ticker}`} onError={(event) => {
        const fallback = event.currentTarget.dataset.fallback;
        if (fallback) {
          event.currentTarget.src = fallback;
          delete event.currentTarget.dataset.fallback;
          return;
        }
        event.currentTarget.style.display = "none";
      }} />}
    </span>
  );
}

export function CryptoLogo({ ticker, size = "default" }: { ticker: string; size?: "default" | "compact" | "small" }) {
  const symbol = ticker.toUpperCase();

  if (symbol === "BTC") {
    return <span className={`crypto-logo crypto-logo--${size}`} role="img" aria-label="Bitcoin"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#f7931a" /><text x="16" y="22" fill="#fff" fontSize="18" fontWeight="800" textAnchor="middle">₿</text></svg></span>;
  }

  if (symbol === "ETH") {
    return <span className={`crypto-logo crypto-logo--${size}`} role="img" aria-label="Ethereum"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#627eea" /><path fill="#fff" fillOpacity=".92" d="M16 4.5 9.2 16 16 20l6.8-4L16 4.5Z" /><path fill="#fff" fillOpacity=".66" d="m16 21.3-6.8-4L16 27.5l6.8-10.2-6.8 4Z" /><path fill="#cbd5ff" d="M16 4.5V20l6.8-4L16 4.5Zm0 16.8v6.2l6.8-10.2-6.8 4Z" /></svg></span>;
  }

  return <span className={`ticker-avatar ticker-avatar--crypto crypto-logo--${size}`} title={ticker}>{symbol.slice(0, 2)}</span>;
}

interface MetricCardProps {
  label: string;
  value: string;
  secondaryValue?: string;
  icon: ReactNode;
  helper?: string;
  change?: number;
  accent?: "blue" | "green" | "violet" | "amber";
}

export function MetricCard({ label, value, secondaryValue, icon, helper, change, accent = "blue" }: MetricCardProps) {
  const tone = change === undefined ? "neutral" : toneForValue(change);
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__top">
        <span>{label}</span>
        <span className="metric-card__icon">{icon}</span>
      </div>
      <div className="metric-card__value"><strong>{value}</strong>{secondaryValue && <small className="currency-conversion">{secondaryValue}</small>}</div>
      {(helper || change !== undefined) && (
        <div className={`metric-card__helper value--${tone}`}>
          {change !== undefined && (tone === "positive" ? <ArrowUpRight size={15} /> : tone === "negative" ? <ArrowDownRight size={15} /> : <Minus size={15} />)}
          <span>{helper}</span>
        </div>
      )}
    </article>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, subtitle, action, children, className = "" }: SectionProps) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SignalBadge({ signal }: { signal: StrategySignal }) {
  return <span className={`signal-badge signal-badge--${signal.kind}`}>{signal.label}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <AlertCircle size={25} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function Value({ value, children }: { value: number; children: ReactNode }) {
  return <span className={`value--${toneForValue(value)}`}>{children}</span>;
}
