export interface FixedIncomeSupplementalWarning {
  original: string;
  row: number;
  reason: string;
}

const SUPPLEMENTAL_WARNING_PATTERN =
  /^Valores bruto e de imposto inconsistentes em fixed-income-(\d+)(?:: ([^;]+))?; os campos complementares foram ignorados\.$/;

export function parseFixedIncomeSupplementalWarning(
  warning: string,
): FixedIncomeSupplementalWarning | null {
  const match = warning.match(SUPPLEMENTAL_WARNING_PATTERN);
  if (!match) return null;

  return {
    original: warning,
    row: Number(match[1]),
    reason: match[2] ?? "os valores bruto, de imposto e líquido não fecham entre si",
  };
}
