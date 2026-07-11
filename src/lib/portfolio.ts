import type {
  Asset,
  PortfolioData,
  PortfolioModel,
  Position,
  ProcessedTransaction,
  StrategySettings,
  StrategySignal,
  Transaction,
} from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "./settings";

const EPSILON = 0.0000001;

interface TickerState {
  quantity: number;
  cost: number;
  realized: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function calculatePortfolio(data: PortfolioData): PortfolioModel {
  const states = new Map<string, TickerState>();
  const warnings = [...data.integrity.warnings];
  const transactions = [...data.purchases, ...data.sales].sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date);
    if (dateOrder !== 0) return dateOrder;
    if (a.type !== b.type) return a.type === "buy" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  const processedTransactions: ProcessedTransaction[] = [];

  for (const transaction of transactions) {
    const state = states.get(transaction.ticker) ?? { quantity: 0, cost: 0, realized: 0 };

    if (transaction.type === "buy") {
      state.quantity += transaction.quantity;
      state.cost += transaction.total;
      states.set(transaction.ticker, state);
      processedTransactions.push({
        ...transaction,
        costBasis: transaction.total,
        realizedProfit: null,
      });
      continue;
    }

    const matchedQuantity = Math.min(state.quantity, transaction.quantity);
    if (matchedQuantity + EPSILON < transaction.quantity) {
      warnings.push(
        `Venda de ${transaction.ticker} em ${transaction.date} excede a posição disponível.`,
      );
    }
    if (matchedQuantity <= EPSILON || state.quantity <= EPSILON) {
      states.set(transaction.ticker, state);
      processedTransactions.push({ ...transaction, costBasis: null, realizedProfit: null });
      continue;
    }

    const averageCost = state.cost / state.quantity;
    const disposedCost = averageCost * matchedQuantity;
    const matchedRevenue = transaction.total * (matchedQuantity / transaction.quantity);
    state.realized += matchedRevenue - disposedCost;
    processedTransactions.push({
      ...transaction,
      costBasis: disposedCost,
      realizedProfit: matchedRevenue - disposedCost,
    });
    state.quantity -= matchedQuantity;
    state.cost -= disposedCost;

    if (state.quantity <= EPSILON) {
      state.quantity = 0;
      state.cost = 0;
    }
    states.set(transaction.ticker, state);
  }

  const assetByTicker = new Map(data.assets.map((asset) => [asset.ticker, asset]));
  const provisionalPositions: Position[] = [];

  for (const [symbol, state] of states) {
    if (state.quantity <= EPSILON) continue;
    const asset = assetByTicker.get(symbol);
    if (!asset) warnings.push(`Cotação não encontrada para a posição ${symbol}.`);
    const currentPrice = asset?.currentPrice ?? 0;
    const marketValue = state.quantity * currentPrice;
    const unrealized = marketValue - state.cost;

    provisionalPositions.push({
      ticker: symbol,
      name: asset?.name ?? symbol,
      sector: asset?.sector ?? "Não informado",
      exchange: asset?.exchange ?? "Não informada",
      quantity: state.quantity,
      averageCost: state.cost / state.quantity,
      costBasis: state.cost,
      currentPrice,
      marketValue,
      unrealized,
      unrealizedPercent: state.cost > EPSILON ? unrealized / state.cost : 0,
      realized: state.realized,
      allocation: 0,
      annual: asset?.annual ?? null,
    });
  }

  const marketValue = provisionalPositions.reduce((sum, position) => sum + position.marketValue, 0);
  const positions = provisionalPositions
    .map((position) => ({
      ...position,
      allocation: marketValue > EPSILON ? position.marketValue / marketValue : 0,
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
  const openCost = positions.reduce((sum, position) => sum + position.costBasis, 0);
  const unrealizedProfit = positions.reduce((sum, position) => sum + position.unrealized, 0);
  const realizedProfit = [...states.values()].reduce((sum, state) => sum + state.realized, 0);
  const historicalPurchases = data.purchases.reduce((sum, item) => sum + item.total, 0);
  const historicalSales = data.sales.reduce((sum, item) => sum + item.total, 0);

  return {
    positions,
    transactions: [...processedTransactions].reverse(),
    metrics: {
      historicalPurchases,
      historicalSales,
      openCost,
      marketValue,
      realizedProfit,
      unrealizedProfit,
      totalProfit: realizedProfit + unrealizedProfit,
      openReturn: openCost > EPSILON ? unrealizedProfit / openCost : 0,
      totalReturnOnPurchases:
        historicalPurchases > EPSILON ? (realizedProfit + unrealizedProfit) / historicalPurchases : 0,
      openPositions: positions.length,
      assetCount: data.assets.length,
    },
    warnings: [...new Set(warnings)],
  };
}

export function getStrategySignal(asset: Asset, settings: StrategySettings = DEFAULT_STRATEGY_SETTINGS): StrategySignal {
  const annual = asset.annual;
  if (!annual || annual.min <= 0 || annual.average <= 0 || annual.max <= 0) {
    return {
      kind: "unavailable",
      label: "Dados insuficientes",
      description: "Não há histórico anual válido para calcular o sinal.",
      strength: 0,
      distanceToAverage: null,
      distanceToHigh: null,
    };
  }

  const price = asset.currentPrice;
  const distanceToAverage = (price - annual.average) / annual.average;
  const distanceToHigh = (price - annual.max) / annual.max;
  const sellDistance = settings.sellDistanceFromHighPercent / 100;
  const buyDistance = settings.buyDistanceBelowAveragePercent / 100;
  const strongBreakoutDistance = settings.strongBreakoutAboveHighPercent / 100;

  if (price > annual.max) {
    const strength = 0.7 + clamp(distanceToHigh / Math.max(strongBreakoutDistance, EPSILON)) * 0.3;
    return {
      kind: "breakout",
      label: distanceToHigh >= strongBreakoutDistance ? "Rompimento forte" : "Rompimento",
      description: `Cotação ${Math.abs(distanceToHigh * 100).toFixed(1)}% acima da máxima anual.`,
      strength,
      distanceToAverage,
      distanceToHigh,
    };
  }

  if (price >= annual.max * (1 - sellDistance)) {
    const proximity = clamp((price - annual.max * (1 - sellDistance)) / (annual.max * sellDistance));
    return {
      kind: "sell",
      label: "Venda",
      description: `Faltam ${Math.abs(distanceToHigh * 100).toFixed(1)}% para a máxima anual.`,
      strength: 0.45 + proximity * 0.25,
      distanceToAverage,
      distanceToHigh,
    };
  }

  if (price < annual.average && Math.abs(distanceToAverage) >= buyDistance) {
    const interval = annual.average - annual.min;
    const strength = interval > EPSILON ? clamp((annual.average - price) / interval) : 1;
    const label = strength >= 0.75 ? "Compra forte" : strength >= 0.4 ? "Compra" : "Abaixo da média";
    return {
      kind: "buy",
      label,
      description: `Cotação ${Math.abs(distanceToAverage * 100).toFixed(1)}% abaixo da média anual.`,
      strength,
      distanceToAverage,
      distanceToHigh,
    };
  }

  return {
    kind: "neutral",
    label: "Faixa neutra",
    description: "Cotação entre a média anual e a zona de máxima.",
    strength: 0.2,
    distanceToAverage,
    distanceToHigh,
  };
}

export function getTransactionsByTicker(transactions: Transaction[], ticker: string) {
  return ticker ? transactions.filter((transaction) => transaction.ticker === ticker) : transactions;
}
