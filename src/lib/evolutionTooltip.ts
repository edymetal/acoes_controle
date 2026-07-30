export type EvolutionSeriesKey = "stocks" | "fiis" | "crypto" | "fixedIncome";

interface EvolutionTooltipEntry {
  dataKey?: unknown;
}

export function filterEvolutionTooltipEntries<T extends EvolutionTooltipEntry>(
  entries: ReadonlyArray<T>,
  hoveredSeries: EvolutionSeriesKey | null,
) {
  if (hoveredSeries === null) return entries;
  return entries.filter((entry) => entry.dataKey === hoveredSeries);
}

export function shouldShowEvolutionMarker(
  hoveredSeries: EvolutionSeriesKey | null,
  series: EvolutionSeriesKey,
) {
  return hoveredSeries === null || hoveredSeries === series;
}
