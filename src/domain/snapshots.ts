import { convertToUsd, type Currency } from "./currency";
import type { AppState, Snapshot } from "./types";
import { computeWealth } from "./wealth";

export type BuildSnapshotResult = { ok: true; snapshot: Snapshot } | { ok: false; missingCurrencies: Currency[] };

const cents = (n: number) => Number(n.toFixed(2));

export function isLegacySnapshot(s: Snapshot): boolean {
  return s.combinedWealth === undefined;
}

// `ratesFresh` — курси щойно отримані з мережі; інакше використано кеш і знімок про це попереджає
export function buildSnapshot(
  state: AppState,
  date: string,
  note: string,
  now: Date = new Date(),
  ratesFresh = true,
): BuildSnapshotResult {
  const wealth = computeWealth(state);
  if (wealth.genericValue === null || wealth.fireGenericValue === null || wealth.combinedWealth === null) {
    return { ok: false, missingCurrencies: wealth.missingCurrencies };
  }
  const goalName = (id: string) => state.goals.find((g) => g.id === id)?.name ?? id;
  const usesForeign = state.genericAssets.some((a) => a.currency !== "USD");

  return {
    ok: true,
    snapshot: {
      id: "snap-" + now.getTime(),
      date,
      timestamp: now.toISOString(),
      totalMarketValue: cents(wealth.stocks.totalMarketValue),
      totalCostBasis: cents(wealth.stocks.totalCostBasis),
      positionsSummary: state.assets.map((a) => `${a.ticker} (${a.shares})`).join(", "),
      note,
      stocksValue: cents(wealth.stocks.totalMarketValue),
      genericValue: cents(wealth.genericValue),
      combinedWealth: cents(wealth.combinedWealth),
      fireValue: cents(wealth.fireStocks.totalMarketValue + wealth.fireGenericValue),
      stocks: state.assets.map((a) => ({
        ticker: a.ticker,
        shares: a.shares,
        value: cents((Number(a.shares) || 0) * (Number(a.marketPrice) || 0)),
        goalId: a.goalId,
        goalName: goalName(a.goalId),
      })),
      genericAssets: state.genericAssets.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        amount: a.amount,
        usdValue: cents(convertToUsd(a.amount, a.currency, state.fx?.rates) ?? 0),
        goalId: a.goalId,
        goalName: goalName(a.goalId),
      })),
      ...(state.fx ? { fxRates: structuredClone(state.fx.rates) } : {}),
      usedCachedRates: usesForeign && !ratesFresh,
    },
  };
}
