import type { ProcessedTransaction } from "../types";

export interface MonthlyActivity {
  month: number;
  purchases: number;
  sales: number;
  realizedProfit: number | null;
  transactionCount: number;
}

export function getMonthlyActivity(transactions: ProcessedTransaction[], year: number, accountingReliable = true): MonthlyActivity[] {
  const months = Array.from({ length: 12 }, (_, month) => ({
    month: month + 1,
    purchases: 0,
    sales: 0,
    realizedProfit: accountingReliable ? 0 : null,
    transactionCount: 0,
  }));

  for (const transaction of transactions) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(transaction.date);
    if (!match || Number(match[1]) !== year) continue;
    const month = months[Number(match[2]) - 1];
    month.transactionCount += 1;
    if (transaction.type === "buy") {
      month.purchases += transaction.total;
    } else {
      month.sales += transaction.total;
      month.realizedProfit = month.realizedProfit === null || transaction.realizedProfit === null
        ? null
        : month.realizedProfit + transaction.realizedProfit;
    }
  }

  return months;
}
