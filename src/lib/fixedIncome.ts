import type { FixedIncomeData, FixedIncomeModel } from "../types";

const MONTHS = [
  ["Janeiro", "Jan"], ["Fevereiro", "Fev"], ["Março", "Mar"], ["Abril", "Abr"],
  ["Maio", "Mai"], ["Junho", "Jun"], ["Julho", "Jul"], ["Agosto", "Ago"],
  ["Setembro", "Set"], ["Outubro", "Out"], ["Novembro", "Nov"], ["Dezembro", "Dez"],
] as const;

export function calculateFixedIncome(data: FixedIncomeData): FixedIncomeModel {
  const referenceDate = data.generatedAt.slice(0, 10);
  const expiredInvestments = data.investments.filter((investment) => investment.maturityDate < referenceDate);
  const investments = data.investments
    .filter((investment) => investment.maturityDate >= referenceDate)
    .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));
  const months = MONTHS.map(([label, shortLabel], month) => {
    const monthInvestments = investments.filter((investment) => new Date(`${investment.maturityDate}T12:00:00`).getMonth() === month);
    return {
      month,
      label,
      shortLabel,
      investments: monthInvestments,
      amountToReceive: monthInvestments.reduce((sum, investment) => sum + investment.netAmount, 0),
      profit: monthInvestments.reduce((sum, investment) => sum + investment.profit, 0),
      covered: monthInvestments.length > 0,
    };
  });
  const investedAmount = investments.reduce((sum, investment) => sum + investment.investedAmount, 0);
  const grossAmount = investments.reduce((sum, investment) => sum + (investment.grossAmount ?? investment.netAmount), 0);
  const netAmount = investments.reduce((sum, investment) => sum + investment.netAmount, 0);
  const profit = investments.reduce((sum, investment) => sum + investment.profit, 0);
  const coveredMonths = months.filter((month) => month.covered).length;

  return {
    investments,
    months,
    metrics: {
      investedAmount,
      grossAmount,
      netAmount,
      profit,
      returnRate: investedAmount > 0 ? profit / investedAmount : 0,
      assetCount: investments.length,
      coveredMonths,
      missingMonths: 12 - coveredMonths,
    },
    warnings: [
      ...data.integrity.warnings,
      ...(expiredInvestments.length > 0 ? [`${expiredInvestments.length} ${expiredInvestments.length === 1 ? "aplicação vencida foi excluída" : "aplicações vencidas foram excluídas"} dos totais atuais.`] : []),
    ],
  };
}
