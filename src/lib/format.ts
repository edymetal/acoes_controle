export const formatCurrency = (value: number, compact = false, currency = "USD") =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);

export const formatBrl = (value: number, compact = false) => formatCurrency(value, compact, "BRL");

export const formatUsdFromBrl = (value: number, brlPerUsd: number | null) =>
  brlPerUsd && brlPerUsd > 0 ? formatCurrency(value / brlPerUsd) : "US$ —";

export const formatNumber = (value: number, digits = 4) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);

export const formatPercent = (value: number, digits = 1) =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export const toneForValue = (value: number) =>
  value > 0.000001 ? "positive" : value < -0.000001 ? "negative" : "neutral";
