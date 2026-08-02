import { useEffect } from "react";
import { CalendarDays, HandCoins, Layers3, ListChecks, X } from "lucide-react";
import type {
  EvolutionContributionClass,
  EvolutionMonthContribution,
} from "../lib/evolution";
import { formatCurrency, formatDate, formatNumber } from "../lib/format";
import type { EvolutionCurrency } from "../types";

const CLASS_LABELS: Record<EvolutionContributionClass, string> = {
  stocks: "Ações",
  fiis: "FIIs",
  crypto: "Cripto",
  fixedIncome: "Renda fixa",
};

interface EvolutionMonthModalProps {
  monthLabel: string;
  year: number;
  currency: EvolutionCurrency;
  contributions: EvolutionMonthContribution[];
  onClose: () => void;
}

export function EvolutionMonthModal({
  monthLabel,
  year,
  currency,
  contributions,
  onClose,
}: EvolutionMonthModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const classes = new Set(contributions.map((item) => item.assetClass)).size;
  const totalAvailable = contributions.every((item) => item.value !== null);
  const total = contributions.reduce((sum, item) => sum + (item.value ?? 0), 0);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="asset-modal evolution-contribution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evolution-contribution-modal-title"
        aria-describedby="evolution-contribution-modal-description"
      >
        <header className="asset-modal__header evolution-contribution-modal__header">
          <div>
            <span className="evolution-contribution-modal__icon"><HandCoins size={23} /></span>
            <span>
              <small>APORTES DO MÊS</small>
              <h2 id="evolution-contribution-modal-title">{monthLabel} de {year}</h2>
              <p id="evolution-contribution-modal-description">Compras e aplicações registradas no período</p>
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar aportes do mês" autoFocus>
            <X size={19} />
          </button>
        </header>

        <div className="evolution-contribution-summary" aria-label={`Resumo dos aportes de ${monthLabel}`}>
          <article>
            <HandCoins size={18} />
            <span><small>Total investido</small><strong className="privacy-value">{totalAvailable ? formatCurrency(total, false, currency) : "Indisponível"}</strong></span>
          </article>
          <article>
            <ListChecks size={18} />
            <span><small>Quantidade</small><strong>{contributions.length} {contributions.length === 1 ? "aporte" : "aportes"}</strong></span>
          </article>
          <article>
            <Layers3 size={18} />
            <span><small>Classes</small><strong>{classes} {classes === 1 ? "classe" : "classes"}</strong></span>
          </article>
        </div>

        {contributions.length > 0 ? (
          <div className="evolution-contribution-list" role="list" aria-label="Lista de aportes do mês">
            {contributions.map((contribution) => (
              <article
                className={`evolution-contribution evolution-contribution--${contribution.assetClass}`}
                role="listitem"
                key={contribution.id}
              >
                <div className="evolution-contribution__date">
                  <CalendarDays size={17} />
                  <span><small>Data</small><strong>{formatDate(contribution.date)}</strong></span>
                </div>
                <div className="evolution-contribution__asset">
                  <span className="evolution-contribution__badge">{CLASS_LABELS[contribution.assetClass]}</span>
                  <strong>{contribution.title}</strong>
                  <small>{contribution.subtitle}</small>
                </div>
                <div className="evolution-contribution__details">
                  <small>Detalhes</small>
                  <strong>{contribution.quantity === null || contribution.unitPrice === null
                    ? "Aplicação em renda fixa"
                    : `${formatNumber(contribution.quantity)} × ${formatCurrency(contribution.unitPrice, false, contribution.nativeCurrency)}`}</strong>
                </div>
                <div className="evolution-contribution__amount privacy-value">
                  <small>Valor do aporte</small>
                  <strong>{contribution.value === null ? "Indisponível" : formatCurrency(contribution.value, false, contribution.currency)}</strong>
                  {contribution.nativeCurrency !== contribution.currency && (
                    <em>Original: {formatCurrency(contribution.nativeValue, false, contribution.nativeCurrency)}</em>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="evolution-contribution-empty">
            <span><HandCoins size={27} /></span>
            <strong>Nenhum aporte neste mês</strong>
            <p>Não foram encontradas compras de ativos nem aplicações em renda fixa no período.</p>
          </div>
        )}

        <p className="evolution-contribution-note">
          <HandCoins size={16} />
          <span>O detalhamento considera compras e novas aplicações. Vendas não são contabilizadas como aportes.</span>
        </p>
      </section>
    </div>
  );
}
