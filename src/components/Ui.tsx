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
