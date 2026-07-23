import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export type SortDirection = "ascending" | "descending";
export type SortValue = boolean | number | string | null | undefined;

export interface SortConfig<Key extends string> {
  key: Key;
  direction: SortDirection;
}

interface SortableHeaderProps<Key extends string> {
  children: ReactNode;
  sortKey: Key;
  sortConfig: SortConfig<Key> | null;
  onSort: (key: Key) => void;
}

function compareValues(left: SortValue, right: SortValue) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left).localeCompare(String(right), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function getNextSortConfig<Key extends string>(
  current: SortConfig<Key> | null,
  key: Key,
): SortConfig<Key> {
  return {
    key,
    direction: current?.key === key && current.direction === "ascending"
      ? "descending"
      : "ascending",
  };
}

export function sortRows<Row, Key extends string>(
  rows: Row[],
  sortConfig: SortConfig<Key> | null,
  getSortValue: (row: Row, key: Key) => SortValue,
) {
  if (!sortConfig) return rows;

  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sortConfig.key);
    const rightValue = getSortValue(right, sortConfig.key);
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;

    const comparison = compareValues(leftValue, rightValue);
    return sortConfig.direction === "ascending" ? comparison : -comparison;
  });
}

export function useSortableTable<Row, Key extends string>(
  rows: Row[],
  getSortValue: (row: Row, key: Key) => SortValue,
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<Key> | null>(null);
  const sortedRows = useMemo(
    () => sortRows(rows, sortConfig, getSortValue),
    [getSortValue, rows, sortConfig],
  );
  const requestSort = useCallback((key: Key) => {
    setSortConfig((current) => getNextSortConfig(current, key));
  }, []);
  const resetSort = useCallback(() => setSortConfig(null), []);

  return { requestSort, resetSort, sortedRows, sortConfig };
}

export function SortableHeader<Key extends string>({
  children,
  sortKey,
  sortConfig,
  onSort,
}: SortableHeaderProps<Key>) {
  const activeDirection = sortConfig?.key === sortKey ? sortConfig.direction : null;
  const nextDirection = activeDirection === "ascending" ? "decrescente" : "crescente";

  return (
    <th aria-sort={activeDirection ?? "none"}>
      <button
        className={`sortable-header ${activeDirection ? "sortable-header--active" : ""}`}
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Ordenar ${nextDirection}`}
      >
        <span>{children}</span>
        {activeDirection === "ascending"
          ? <ArrowUp aria-hidden="true" size={14} />
          : activeDirection === "descending"
            ? <ArrowDown aria-hidden="true" size={14} />
            : <ChevronsUpDown aria-hidden="true" size={14} />}
      </button>
    </th>
  );
}
