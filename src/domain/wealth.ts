import { getPortfolioTotals, type PortfolioTotals } from "./calc";
import { convertToUsd, type Currency } from "./currency";
import { FIRE_GOAL_ID } from "./goals";
import type { AppState } from "./types";

type WealthInput = Pick<AppState, "assets" | "genericAssets" | "fx">;

export interface Wealth {
  stocks: PortfolioTotals;
  fireStocks: PortfolioTotals;
  genericValue: number | null;
  fireGenericValue: number | null;
  combinedWealth: number | null;
  missingCurrencies: Currency[];
}

// null означає, що курсу немає: недоступну суму не можна рахувати як нуль
function sumGeneric(state: WealthInput, goalId?: string): number | null {
  let total = 0;
  for (const a of state.genericAssets) {
    if (goalId !== undefined && a.goalId !== goalId) continue;
    const usd = convertToUsd(a.amount, a.currency, state.fx?.rates);
    if (usd === null) return null;
    total += usd;
  }
  return total;
}

export function computeWealth(state: WealthInput): Wealth {
  const stocks = getPortfolioTotals(state.assets);
  const genericValue = sumGeneric(state);
  const missing = new Set<Currency>();
  for (const a of state.genericAssets) {
    if (convertToUsd(a.amount, a.currency, state.fx?.rates) === null) missing.add(a.currency);
  }
  return {
    stocks,
    fireStocks: getPortfolioTotals(state.assets.filter((a) => a.goalId === FIRE_GOAL_ID)),
    genericValue,
    fireGenericValue: sumGeneric(state, FIRE_GOAL_ID),
    combinedWealth: genericValue === null ? null : stocks.totalMarketValue + genericValue,
    missingCurrencies: [...missing],
  };
}

export function getGoalBalance(goalId: string, state: WealthInput): number | null {
  const generic = sumGeneric(state, goalId);
  if (generic === null) return null;
  const stocks = getPortfolioTotals(state.assets.filter((a) => a.goalId === goalId));
  return stocks.totalMarketValue + generic;
}
