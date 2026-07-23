import type { Position } from "../types";
import {
  SortableHeader,
  type SortConfig,
  type SortValue,
} from "./SortableTable";

export type PositionSortKey =
  | "allocation"
  | "averageCost"
  | "costBasis"
  | "currentPrice"
  | "marketValue"
  | "quantity"
  | "ticker"
  | "unrealized";

export function getPositionSortValue(position: Position, key: PositionSortKey): SortValue {
  return position[key];
}

export function PortfolioTableHead({
  assetLabel,
  quantityLabel,
  sortConfig,
  onSort,
}: {
  assetLabel: string;
  quantityLabel: string;
  sortConfig: SortConfig<PositionSortKey> | null;
  onSort: (key: PositionSortKey) => void;
}) {
  return (
    <thead>
      <tr>
        <SortableHeader sortKey="ticker" sortConfig={sortConfig} onSort={onSort}>{assetLabel}</SortableHeader>
        <SortableHeader sortKey="quantity" sortConfig={sortConfig} onSort={onSort}>{quantityLabel}</SortableHeader>
        <SortableHeader sortKey="averageCost" sortConfig={sortConfig} onSort={onSort}>Preço médio</SortableHeader>
        <SortableHeader sortKey="currentPrice" sortConfig={sortConfig} onSort={onSort}>Cotação</SortableHeader>
        <SortableHeader sortKey="costBasis" sortConfig={sortConfig} onSort={onSort}>Custo</SortableHeader>
        <SortableHeader sortKey="marketValue" sortConfig={sortConfig} onSort={onSort}>Valor atual</SortableHeader>
        <SortableHeader sortKey="allocation" sortConfig={sortConfig} onSort={onSort}>Participação</SortableHeader>
        <SortableHeader sortKey="unrealized" sortConfig={sortConfig} onSort={onSort}>Resultado aberto</SortableHeader>
      </tr>
    </thead>
  );
}
