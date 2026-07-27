import type { ProcessedTransaction } from "../types";
import {
  SortableHeader,
  type SortConfig,
  type SortValue,
} from "./SortableTable";

export type TransactionSortKey =
  | "costBasis"
  | "date"
  | "quantity"
  | "realizedProfit"
  | "ticker"
  | "total"
  | "type"
  | "unitPrice";

export function getTransactionSortValue(
  transaction: ProcessedTransaction,
  key: TransactionSortKey,
): SortValue {
  if (key === "type") return transaction.type === "buy" ? "Compra" : "Venda";
  if (key === "date") {
    return `${transaction.date}T${transaction.time ?? ""}-${String(transaction.sourceOrder ?? 0).padStart(8, "0")}`;
  }
  return transaction[key];
}

export function TransactionTableHead({
  assetLabel,
  quantityLabel,
  sortConfig,
  onSort,
}: {
  assetLabel: string;
  quantityLabel: string;
  sortConfig: SortConfig<TransactionSortKey> | null;
  onSort: (key: TransactionSortKey) => void;
}) {
  return (
    <thead>
      <tr>
        <SortableHeader sortKey="date" sortConfig={sortConfig} onSort={onSort}>Data</SortableHeader>
        <SortableHeader sortKey="type" sortConfig={sortConfig} onSort={onSort}>Tipo</SortableHeader>
        <SortableHeader sortKey="ticker" sortConfig={sortConfig} onSort={onSort}>{assetLabel}</SortableHeader>
        <SortableHeader sortKey="quantity" sortConfig={sortConfig} onSort={onSort}>{quantityLabel}</SortableHeader>
        <SortableHeader sortKey="unitPrice" sortConfig={sortConfig} onSort={onSort}>Preço unitário</SortableHeader>
        <SortableHeader sortKey="total" sortConfig={sortConfig} onSort={onSort}>Valor total</SortableHeader>
        <SortableHeader sortKey="costBasis" sortConfig={sortConfig} onSort={onSort}>Custo descontado</SortableHeader>
        <SortableHeader sortKey="realizedProfit" sortConfig={sortConfig} onSort={onSort}>Lucro realizado</SortableHeader>
      </tr>
    </thead>
  );
}
