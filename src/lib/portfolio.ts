import type {
  Asset,
  CryptoData,
  FiiData,
  PortfolioData,
  PortfolioModel,
  Position,
  ProcessedTransaction,
  StrategySettings,
  StrategySignal,
  Transaction,
} from "../types";
import { DEFAULT_STRATEGY_SETTINGS, getStrategyLevelValues } from "./settings";

const EPSILON = 0.0000001;

interface TickerState {
  quantity: number;
  cost: number;
  realized: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function compareExplicitTransactionOrder(a: Transaction, b: Transaction) {
  if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
  if (
    a.sourceOrder !== undefined
    && b.sourceOrder !== undefined
    && a.sourceOrder !== b.sourceOrder
  ) {
    return a.sourceOrder - b.sourceOrder;
  }
  return null;
}

export function getAnnualRealizedProfit(transactions: ProcessedTransaction[]) {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    const year = transaction.date.slice(0, 4);
    if (!/^\d{4}$/.test(year)) continue;
    totals.set(year, (totals.get(year) ?? 0) + (transaction.realizedProfit ?? 0));
  }

  return [...totals.entries()]
    .sort(([yearA], [yearB]) => yearA.localeCompare(yearB))
    .map(([year, value]) => ({ year, value }));
}

export function calculatePortfolio(data: PortfolioData | FiiData | CryptoData): PortfolioModel {
  const states = new Map<string, TickerState>();
  const warnings = [...data.integrity.warnings];
  const transactions = [...data.purchases, ...data.sales].sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date);
    if (dateOrder !== 0) return dateOrder;
    const explicitOrder = compareExplicitTransactionOrder(a, b);
    if (explicitOrder !== null) return explicitOrder;
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
  const missingQuoteTickers: string[] = [];

  for (const [symbol, state] of states) {
    if (state.quantity <= EPSILON) continue;
    const asset = assetByTicker.get(symbol);
    const quoteAvailable = Boolean(asset && asset.currentPrice > 0);
    if (!quoteAvailable) {
      missingQuoteTickers.push(symbol);
      warnings.push(`Cotação não encontrada para a posição ${symbol}.`);
    }
    const currentPrice = quoteAvailable ? asset!.currentPrice : 0;
    const marketValue = quoteAvailable ? state.quantity * currentPrice : 0;
    const unrealized = quoteAvailable ? marketValue - state.cost : 0;

    provisionalPositions.push({
      ticker: symbol,
      name: asset?.name ?? symbol,
      sector: asset?.sector ?? "Não informado",
      exchange: asset?.exchange ?? "Não informada",
      quantity: state.quantity,
      averageCost: state.cost / state.quantity,
      costBasis: state.cost,
      currentPrice,
      quoteAvailable,
      accountingReliable: true,
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
  const staleAnnualTickers = data.assets
    .filter((asset) => asset.annual?.isFallback)
    .map((asset) => asset.ticker);
  const staleAnnualAsOf = data.assets
    .flatMap((asset) => asset.annual?.isFallback && asset.annual.asOf ? [asset.annual.asOf] : [])
    .sort()[0] ?? null;

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
    health: {
      valuation: missingQuoteTickers.length > 0 ? "partial" : "complete",
      accounting: "complete",
      ambiguousTransactionKeys: [],
      ambiguousTransactionTickers: [],
      missingQuoteTickers: [...new Set(missingQuoteTickers)].sort(),
      staleAnnualTickers: [...new Set(staleAnnualTickers)].sort(),
      staleAnnualAsOf,
    },
    warnings: [...new Set(warnings)],
  };
}

export function getStrategySignal(
  asset: Asset,
  settings: StrategySettings = DEFAULT_STRATEGY_SETTINGS,
  positionValue = 0,
  positionCost = positionValue,
  accountingReliable = true,
): StrategySignal {
  const annual = asset.annual;
  const remainingToMaximum = Math.max(0, settings.maximumPositionValue - positionCost);
  if (!accountingReliable) {
    return {
      kind: "unavailable",
      label: "Ordem ambígua",
      description: "Existe compra e venda no mesmo dia sem horário ou sequência confiável; o sinal fica suspenso até a ordem ser informada.",
      strength: 0,
      distanceToAverage: null,
      distanceToHigh: null,
      rangePositionPercent: null,
      positionValue,
      positionCost,
      targetPositionValue: null,
      actionAmount: 0,
      remainingToTarget: 0,
      remainingToMaximum,
      actionPercent: null,
    };
  }
  if (annual?.isFallback) {
    return {
      kind: "unavailable",
      label: "Dados desatualizados",
      description: "As estatísticas anuais foram reaproveitadas de uma atualização anterior; o sinal fica suspenso até a próxima leitura válida.",
      strength: 0,
      distanceToAverage: null,
      distanceToHigh: null,
      rangePositionPercent: null,
      positionValue,
      positionCost,
      targetPositionValue: null,
      actionAmount: 0,
      remainingToTarget: 0,
      remainingToMaximum,
      actionPercent: null,
    };
  }
  if (!annual || annual.min <= 0 || annual.average <= 0 || annual.max <= annual.min) {
    return {
      kind: "unavailable",
      label: "Dados insuficientes",
      description: "Não há histórico anual válido para calcular o sinal.",
      strength: 0,
      distanceToAverage: null,
      distanceToHigh: null,
      rangePositionPercent: null,
      positionValue,
      positionCost,
      targetPositionValue: null,
      actionAmount: 0,
      remainingToTarget: 0,
      remainingToMaximum,
      actionPercent: null,
    };
  }

  const price = asset.currentPrice;
  const distanceToAverage = (price - annual.average) / annual.average;
  const distanceToHigh = (price - annual.max) / annual.max;
  const rangePositionPercent = ((price - annual.min) / (annual.max - annual.min)) * 100;
  const sellDistance = settings.sellDistanceFromHighPercent / 100;
  const allocationRange = Math.max(0, settings.maximumPositionValue - settings.minimumPositionValue);
  const sellableValue = Math.max(0, positionValue - settings.minimumPositionValue);
  const levelValues = getStrategyLevelValues(settings);
  const base = {
    distanceToAverage,
    distanceToHigh,
    rangePositionPercent,
    positionValue,
    positionCost,
    targetPositionValue: null,
    remainingToTarget: 0,
    remainingToMaximum,
  };

  if (price > annual.max) {
    const scheduledAmount = allocationRange * (settings.breakoutSellPercent / 100);
    const newExcess = Math.max(0, positionValue - settings.maximumPositionValue);
    const actionAmount = Math.min(sellableValue, Math.max(scheduledAmount, newExcess));
    const canSell = actionAmount + EPSILON >= settings.minimumSaleAmount && actionAmount > EPSILON;
    return {
      kind: "breakout",
      label: canSell ? "Vender no rompimento" : "Rompimento",
      description: canSell
        ? `Venda da parcela final de ${settings.breakoutSellPercent}% sem deixar a posição abaixo de ${formatStrategyMoney(settings.minimumPositionValue)}.`
        : `Máxima anual rompida, mas ainda não há ${formatStrategyMoney(settings.minimumSaleAmount)} disponíveis para venda.`,
      strength: 0.75 + clamp(distanceToHigh / 0.1) * 0.25,
      ...base,
      actionAmount: canSell ? actionAmount : 0,
      actionPercent: settings.breakoutSellPercent,
    };
  }

  if (price >= annual.max * (1 - sellDistance)) {
    const proximity = clamp((price - annual.max * (1 - sellDistance)) / (annual.max * sellDistance));
    const scheduledAmount = allocationRange * (settings.initialSellPercent / 100);
    const newExcess = Math.max(0, positionValue - settings.maximumPositionValue);
    const actionAmount = Math.min(sellableValue, Math.max(scheduledAmount, newExcess));
    const canSell = actionAmount + EPSILON >= settings.minimumSaleAmount && actionAmount > EPSILON;
    return {
      kind: "sell",
      label: canSell ? `Vender ${settings.initialSellPercent}%` : "Próxima da máxima",
      description: canSell
        ? `Faltam ${Math.abs(distanceToHigh * 100).toFixed(1)}% para a máxima anual; preserve o piso de ${formatStrategyMoney(settings.minimumPositionValue)}.`
        : `Zona de venda atingida, mas a posição não permite vender ${formatStrategyMoney(settings.minimumSaleAmount)} sem romper o piso.`,
      strength: 0.45 + proximity * 0.25,
      ...base,
      actionAmount: canSell ? actionAmount : 0,
      actionPercent: settings.initialSellPercent,
    };
  }

  const buySignal = (targetPositionValue: number, label: string, description: string, strength: number): StrategySignal => {
    const remainingToTarget = Math.max(0, targetPositionValue - positionCost);
    const actionAmount = Math.min(remainingToTarget, remainingToMaximum);
    const canBuy = actionAmount > EPSILON;
    return {
      kind: canBuy ? "buy" : "neutral",
      label: canBuy ? label : "Nível completo",
      description: canBuy
        ? `${description} Objetivo acumulado: ${formatStrategyMoney(targetPositionValue)}.`
        : `O valor comprado já atingiu o objetivo de ${formatStrategyMoney(targetPositionValue)} deste nível.`,
      strength,
      ...base,
      targetPositionValue,
      remainingToTarget,
      actionAmount: canBuy ? actionAmount : 0,
      actionPercent: null,
    };
  };

  if (price < annual.min) {
    return buySignal(levelValues.breakdownBuyPositionValue, "Comprar no rompimento", "Cotação abaixo da mínima anual.", 1);
  }

  if (rangePositionPercent >= settings.buyZoneMiddlePercent && rangePositionPercent <= settings.buyZoneUpperPercent) {
    return buySignal(levelValues.moderateBuyPositionValue, "Comprar", `Cotação entre ${settings.buyZoneMiddlePercent}% e ${settings.buyZoneUpperPercent}% do intervalo anual.`, 0.55);
  }

  if (rangePositionPercent >= settings.buyZoneLowerPercent && rangePositionPercent < settings.buyZoneMiddlePercent) {
    return buySignal(levelValues.strongBuyPositionValue, "Compra forte", `Cotação entre ${settings.buyZoneLowerPercent}% e ${settings.buyZoneMiddlePercent}% do intervalo anual.`, 0.8);
  }

  return {
    kind: "neutral",
    label: "Faixa neutra",
    description: "Cotação fora das faixas configuradas para compra e venda.",
    strength: 0.2,
    ...base,
    actionAmount: 0,
    actionPercent: null,
  };
}

function formatStrategyMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
}

export function getTransactionsByTicker(transactions: Transaction[], ticker: string) {
  return ticker ? transactions.filter((transaction) => transaction.ticker === ticker) : transactions;
}
