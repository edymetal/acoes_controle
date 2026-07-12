import type { FixedIncomeData, FixedIncomeInvestment, FixedIncomeMetrics, FixedIncomeModel } from "../types";

const MONTHS = [
  ["Janeiro", "Jan"], ["Fevereiro", "Fev"], ["Março", "Mar"], ["Abril", "Abr"],
  ["Maio", "Mai"], ["Junho", "Jun"], ["Julho", "Jul"], ["Agosto", "Ago"],
  ["Setembro", "Set"], ["Outubro", "Out"], ["Novembro", "Nov"], ["Dezembro", "Dez"],
] as const;

export function calculateFixedIncome(data: FixedIncomeData): FixedIncomeModel {
  const referenceDate = data.generatedAt.slice(0, 10);
  const referenceYear = Number(referenceDate.slice(0, 4));
  const expiredInvestments = data.investments.filter((investment) => investment.maturityDate < referenceDate);
  const investments = data.investments
    .filter((investment) => investment.maturityDate >= referenceDate)
    .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));
  const years = Array.from({ length: 3 }, (_, offset) => {
    const year = referenceYear + offset;
    const yearInvestments = investments.filter((investment) => Number(investment.maturityDate.slice(0, 4)) === year);
    const months = MONTHS.map(([label, shortLabel], month) => {
      const monthInvestments = yearInvestments.filter((investment) => Number(investment.maturityDate.slice(5, 7)) === month + 1);
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
    return { year, investments: yearInvestments, months, metrics: calculateMetrics(yearInvestments, months.filter((month) => month.covered).length) };
  });
  const metrics = calculateMetrics(investments, years[0].metrics.coveredMonths);

  return {
    referenceYear,
    investments,
    years,
    metrics,
    warnings: [
      ...data.integrity.warnings,
      ...(expiredInvestments.length > 0 ? [`${expiredInvestments.length} ${expiredInvestments.length === 1 ? "aplicação vencida foi excluída" : "aplicações vencidas foram excluídas"} dos totais atuais.`] : []),
    ],
  };
}

function calculateMetrics(investments: FixedIncomeInvestment[], coveredMonths: number): FixedIncomeMetrics {
  const investedAmount = investments.reduce((sum, investment) => sum + investment.investedAmount, 0);
  const grossAmount = investments.reduce((sum, investment) => sum + (investment.grossAmount ?? investment.netAmount), 0);
  const netAmount = investments.reduce((sum, investment) => sum + investment.netAmount, 0);
  const profit = investments.reduce((sum, investment) => sum + investment.profit, 0);
  return {
    investedAmount,
    grossAmount,
    netAmount,
    profit,
    returnRate: investedAmount > 0 ? profit / investedAmount : 0,
    assetCount: investments.length,
    coveredMonths,
    missingMonths: 12 - coveredMonths,
  };
}
