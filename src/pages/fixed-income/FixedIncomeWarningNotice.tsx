import { useEffect, useState } from "react";
import { AlertTriangle, CircleHelp, FileSpreadsheet, ShieldCheck, X } from "lucide-react";
import {
  parseFixedIncomeSupplementalWarning,
  type FixedIncomeSupplementalWarning,
} from "../../lib/fixedIncomeWarnings";

interface FixedIncomeWarningNoticeProps {
  warnings: string[];
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

export function FixedIncomeWarningNotice({ warnings }: FixedIncomeWarningNoticeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const parsedWarnings = warnings.map(parseFixedIncomeSupplementalWarning);
  const supplementalWarnings = parsedWarnings.filter(
    (warning): warning is FixedIncomeSupplementalWarning => warning !== null,
  );
  const supplementalMessages = new Set(supplementalWarnings.map(({ original }) => original));
  const otherWarnings = warnings.filter((warning) => !supplementalMessages.has(warning));

  useEffect(() => {
    if (!showDetails) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDetails(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showDetails]);

  if (warnings.length === 0) return null;
  if (supplementalWarnings.length === 0) {
    return (
      <div className="refresh-message refresh-message--warning" role="status">
        {warnings.length === 1 ? warnings[0] : `${warnings.length} avisos foram identificados na renda fixa.`}
      </div>
    );
  }

  const affectedRows = supplementalWarnings.map(({ row }) => row).join(", ");
  const shortMessage = supplementalWarnings.length === 1
    ? `Os valores bruto, imposto e líquido não fecham na linha ${affectedRows} da renda fixa.`
    : `Os valores bruto, imposto e líquido não fecham em ${supplementalWarnings.length} linhas da renda fixa.`;

  return (
    <>
      <div className="refresh-message refresh-message--warning fixed-income-warning-notice" role="status">
        <span className="fixed-income-warning-notice__summary">
          <AlertTriangle size={19} aria-hidden="true" />
          <span>
            <strong>{shortMessage}</strong>
            <small>O investimento foi mantido, mas os campos inconsistentes foram desconsiderados.</small>
          </span>
        </span>
        <button type="button" onClick={() => setShowDetails(true)} aria-haspopup="dialog">
          <CircleHelp size={16} aria-hidden="true" />
          Ver detalhes
        </button>
      </div>

      {otherWarnings.length > 0 && (
        <div className="refresh-message refresh-message--warning data-health-notice" role="status">
          {otherWarnings.map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      )}

      {showDetails && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowDetails(false);
        }}>
          <section
            className="asset-modal fixed-income-warning-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fixed-income-warning-title"
          >
            <header className="asset-modal__header">
              <div>
                <span className="fixed-income-warning-modal__icon"><AlertTriangle size={22} /></span>
                <span>
                  <small>VERIFICAÇÃO DA PLANILHA</small>
                  <h2 id="fixed-income-warning-title">Valores da renda fixa não conferem</h2>
                </span>
              </div>
              <button type="button" onClick={() => setShowDetails(false)} aria-label="Fechar detalhes">
                <X size={19} />
              </button>
            </header>

            <p className="fixed-income-warning-modal__intro">
              O sistema encontrou uma divergência entre os valores bruto, de imposto e líquido.
              Confira os registros abaixo na aba <strong>Fixa Hist</strong>.
            </p>

            <div className="fixed-income-warning-modal__issues">
              {supplementalWarnings.map(({ original, reason, row }) => (
                <article key={original}>
                  <span className="fixed-income-warning-modal__location">
                    <FileSpreadsheet size={18} />
                    Aba Fixa Hist · linha {row}
                  </span>
                  <strong>Problema detectado</strong>
                  <p>{capitalize(reason)}.</p>
                </article>
              ))}
            </div>

            <section className="fixed-income-warning-modal__section">
              <h3>Células que devem ser conferidas</h3>
              <div className="fixed-income-warning-modal__cells">
                <span><code>M{affectedRows.split(", ")[0]}</code><strong>Valor bruto</strong></span>
                <span><code>N{affectedRows.split(", ")[0]}</code><strong>Valor do imposto</strong></span>
                <span><code>O{affectedRows.split(", ")[0]}</code><strong>Alíquota do imposto</strong></span>
                <span><code>P{affectedRows.split(", ")[0]}</code><strong>Valor líquido</strong></span>
              </div>
              {supplementalWarnings.length > 1 && (
                <p className="fixed-income-warning-modal__rows">
                  Repita a conferência nas linhas: {affectedRows}.
                </p>
              )}
            </section>

            <section className="fixed-income-warning-modal__section">
              <h3>Como corrigir</h3>
              <ol>
                <li>Confira se o valor bruto é igual ou maior que o valor líquido.</li>
                <li>Garanta que <code>valor líquido = valor bruto − imposto</code>. A tolerância de arredondamento é de R$ 0,02.</li>
                <li>Se não houver imposto, deixe o imposto vazio ou zerado e mantenha o bruto igual ao líquido.</li>
                <li>Salve a planilha e use o botão de atualização do sistema para validar novamente.</li>
              </ol>
            </section>

            <p className="fixed-income-warning-modal__impact">
              <ShieldCheck size={18} />
              <span>
                <strong>Impacto no sistema</strong>
                O investimento continua na carteira. Somente valor bruto, imposto e alíquota foram ignorados;
                valor aplicado, valor líquido e lucro continuam sendo utilizados.
              </span>
            </p>
          </section>
        </div>
      )}
    </>
  );
}
