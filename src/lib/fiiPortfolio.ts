import type { FiiData, PortfolioModel } from "../types";
import { calculatePortfolio } from "./portfolio";

export function calculateFiiPortfolio(data: FiiData): PortfolioModel {
  return calculatePortfolio(data);
}
