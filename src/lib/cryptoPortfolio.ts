import type { CryptoData, PortfolioModel } from "../types";
import { calculatePortfolio } from "./portfolio";

export function calculateCryptoPortfolio(data: CryptoData): PortfolioModel {
  return calculatePortfolio(data);
}
