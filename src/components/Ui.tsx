import type { ReactNode } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { StrategySignal } from "../types";
import { toneForValue } from "../lib/format";

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
