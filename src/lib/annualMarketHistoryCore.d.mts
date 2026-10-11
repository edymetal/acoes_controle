import type { AnnualStats } from "../types";
export const ANNUAL_MARKET_HISTORY_RANGE: string;
export function mapAnnualMarketHistory(rows: ReadonlyArray<ReadonlyArray<unknown>>, generatedAt: string, warnings: string[]): Map<string, AnnualStats>;
