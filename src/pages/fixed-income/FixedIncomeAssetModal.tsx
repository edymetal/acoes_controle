import { useEffect } from "react";
import { Landmark, X } from "lucide-react";
import { formatBrl, formatDate, formatPercent, formatUsdFromBrl } from "../../lib/format";
import type { FixedIncomeInvestment } from "../../types";

interface FixedIncomeAssetModalProps {
  investment: FixedIncomeInvestment;
  usdRate: number | null;
  onClose: () => void;
}

function formatYield(value: number | string) {
  return typeof value === "number" ? formatPercent(value, 2) : value || "Não informado";
}

function FinancialValue({
  amount,
  usdRate,
}: {
  amount: number | null;
  usdRate: number | null;
}) {
  if (amount === null) return <span className="data-unavailable">Indisponível</span>;
  return (
    <span className="privacy-value fixed-income-asset-modal__money">
      <strong>{formatBrl(amount)}</strong>
      <small className="currency-conversion">{formatUsdFromBrl(amount, usdRate)}</small>
    </span>
  );
}

export function FixedIncomeAssetModal({
  investment,
  usdRate,
  onClose,
}: FixedIncomeAssetModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const sheetRow = investment.id.match(/^fixed-income-(\d+)$/)?.[1];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="asset-modal fixed-income-asset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fixed-income-asset-modal-title"
      >
        <header className="asset-modal__header">
          <div>
            <span className="fixed-income-asset-modal__icon"><Landmark size={22} /></span>
            <span>
              <small>DETALHES DO ATIVO</small>
              <h2 id="fixed-income-asset-modal-title">{investment.name}</h2>
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar detalhes do ativo">
            <X size={19} />
          </button>
        </header>

        <div className="fixed-income-asset-modal__sections">
          <section>
            <h3>Identificação e condições</h3>
            <dl className="fixed-income-asset-modal__details">
              <div><dt>Instituição/ativo</dt><dd>{investment.name}</dd></div>
              <div><dt>Tipo</dt><dd>{investment.type}</dd></div>
              <div><dt>Nível de risco</dt><dd>{investment.risk ?? "Não informado"}</dd></div>
              <div><dt>Proteção</dt><dd>{investment.fgcGuarantee ? "Coberto pelo FGC" : "Sem cobertura do FGC"}</dd></div>
              <div><dt>Rendimento</dt><dd className="privacy-value">{formatYield(investment.yield)}</dd></div>
              <div><dt>Origem</dt><dd>{sheetRow ? `Fixa Hist · linha ${sheetRow}` : investment.id}</dd></div>
            </dl>
          </section>

          <section>
            <h3>Datas e prazo</h3>
            <dl className="fixed-income-asset-modal__details">
              <div><dt>Data da compra</dt><dd>{formatDate(investment.purchaseDate)}</dd></div>
              <div><dt>Vencimento</dt><dd>{formatDate(investment.maturityDate)}</dd></div>
              <div><dt>Fim da carência</dt><dd>{investment.lockupDate ? formatDate(investment.lockupDate) : "Não informado"}</dd></div>
              <div><dt>Prazo</dt><dd>{investment.periodMonths === null ? "Não informado" : `${investment.periodMonths} meses`}</dd></div>
            </dl>
          </section>

          <section className="fixed-income-asset-modal__financial-section">
            <h3>Valores projetados</h3>
            <dl className="fixed-income-asset-modal__details fixed-income-asset-modal__details--financial">
              <div><dt>Valor aplicado</dt><dd><FinancialValue amount={investment.investedAmount} usdRate={usdRate} /></dd></div>
              <div><dt>Valor bruto</dt><dd><FinancialValue amount={investment.grossAmount} usdRate={usdRate} /></dd></div>
              <div><dt>Imposto de renda</dt><dd><FinancialValue amount={investment.taxAmount} usdRate={usdRate} /></dd></div>
              <div><dt>Alíquota de IR</dt><dd className="privacy-value">{investment.taxRate === null ? <span className="data-unavailable">Indisponível</span> : formatPercent(investment.taxRate, 2)}</dd></div>
              <div><dt>Valor líquido</dt><dd><FinancialValue amount={investment.netAmount} usdRate={usdRate} /></dd></div>
              <div><dt>Lucro projetado</dt><dd><FinancialValue amount={investment.profit} usdRate={usdRate} /></dd></div>
            </dl>
          </section>
        </div>

        <p className="asset-modal__note">
          Os valores bruto, líquido, imposto e lucro são projeções para o vencimento conforme os dados informados na planilha.
        </p>
      </section>
    </div>
  );
}
