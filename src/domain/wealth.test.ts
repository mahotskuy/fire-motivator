import { describe, expect, it } from "vitest";
import { calculateMonthsToTarget, getFireProgress, getFireRules, getGoalProgress } from "./calc";
import { createDefaultState } from "./defaults";
import { FIRE_GOAL_ID, createFireGoal } from "./goals";
import type { AppState, Asset, GenericAsset } from "./types";
import { computeWealth, getGoalBalance } from "./wealth";

const fx = {
  rates: { EUR: { rate: 0.5, date: "2026-11-02" }, UAH: { rate: 40, date: "2026-11-01" }, GBP: { rate: 0.8, date: "2026-11-02" } },
  fetchedAt: "2026-11-02T00:00:00.000Z",
};

const stock = (ticker: string, goalId: string, shares: number, price: number, cost = price): Asset => ({
  ticker,
  shares,
  avgBuyPrice: cost,
  marketPrice: price,
  goalId,
});

const generic = (id: string, currency: GenericAsset["currency"], amount: number, goalId: string): GenericAsset => ({
  id,
  name: id,
  currency,
  amount,
  goalId,
  createdAt: "",
  updatedAt: "",
});

const stateWith = (patch: Partial<AppState>): AppState => ({
  ...createDefaultState(),
  goals: [createFireGoal(), { id: "g-v", name: "Vacation", targetAmount: 1000, targetDate: "2027-01-01" }],
  assets: [],
  genericAssets: [],
  fx,
  ...patch,
});

describe("computeWealth", () => {
  it("computeWealth_MixedCurrenciesAndStocks_SumsEverythingInUsd", () => {
    const w = computeWealth(
      stateWith({
        assets: [stock("VOO", FIRE_GOAL_ID, 2, 100, 80), stock("SCHD", "g-v", 1, 50, 40)],
        genericAssets: [generic("eur", "EUR", 100, FIRE_GOAL_ID), generic("uah", "UAH", 4000, "g-v"), generic("usd", "USD", 25, "g-v")],
      }),
    );
    expect(w.stocks).toEqual({ totalMarketValue: 250, totalCostBasis: 200 });
    expect(w.fireStocks).toEqual({ totalMarketValue: 200, totalCostBasis: 160 });
    expect(w.genericValue).toBeCloseTo(200 + 100 + 25, 8);
    expect(w.fireGenericValue).toBeCloseTo(200, 8);
    expect(w.combinedWealth).toBeCloseTo(575, 8);
    expect(w.missingCurrencies).toEqual([]);
  });

  it("computeWealth_RateMissingForOneCurrency_MarksDependentTotalsUnavailableNotZero", () => {
    const w = computeWealth(
      stateWith({
        fx: { rates: { EUR: fx.rates.EUR }, fetchedAt: "" },
        genericAssets: [generic("eur", "EUR", 100, FIRE_GOAL_ID), generic("uah", "UAH", 4000, "g-v")],
      }),
    );
    expect(w.missingCurrencies).toEqual(["UAH"]);
    expect(w.genericValue).toBeNull();
    expect(w.combinedWealth).toBeNull();
    expect(w.fireGenericValue).toBeCloseTo(200, 8);
  });

  it("computeWealth_StockPnlUnaffectedByGenericAssets_KeepsStockOnlyCostBasis", () => {
    const withGeneric = computeWealth(stateWith({ assets: [stock("VOO", FIRE_GOAL_ID, 1, 120, 100)], genericAssets: [generic("g", "USD", 999, FIRE_GOAL_ID)] }));
    expect(withGeneric.stocks).toEqual({ totalMarketValue: 120, totalCostBasis: 100 });
  });
});

describe("getGoalBalance", () => {
  it("getGoalBalance_StocksAndGenericAssets_SumsOnlyAssetsAssignedToThatGoal", () => {
    const state = stateWith({
      assets: [stock("VOO", FIRE_GOAL_ID, 1, 100), stock("SCHD", "g-v", 2, 50)],
      genericAssets: [generic("uah", "UAH", 4000, "g-v"), generic("eur", "EUR", 10, FIRE_GOAL_ID)],
    });
    expect(getGoalBalance("g-v", state)).toBeCloseTo(200, 8);
    expect(getGoalBalance(FIRE_GOAL_ID, state)).toBeCloseTo(120, 8);
  });

  it("getGoalBalance_TransactionsPresent_AreIgnored", () => {
    const state = stateWith({
      genericAssets: [generic("usd", "USD", 70, "g-v")],
      transactions: [{ date: "2026-09-05", goalName: "Vacation", goalId: "g-v", amount: 500, note: "" }],
    });
    expect(getGoalBalance("g-v", state)).toBe(70);
  });

  it("getGoalBalance_RateMissingForLinkedAsset_ReturnsNull", () => {
    const state = stateWith({ fx: null, genericAssets: [generic("uah", "UAH", 4000, "g-v")] });
    expect(getGoalBalance("g-v", state)).toBeNull();
  });
});

describe("getGoalProgress", () => {
  it("getGoalProgress_HalfFundedByAssets_ReportsFiftyPercentAndMonthlyNeed", () => {
    const goal = { id: "g", name: "G", targetAmount: 1000, targetDate: "2027-01-01" };
    const p = getGoalProgress(goal, 500, new Date("2026-11-01"));
    expect(p.saved).toBe(500);
    expect(p.pct).toBe(50);
    expect(p.monthlyNeed).toBeGreaterThan(0);
  });
});

describe("calculateMonthsToTarget", () => {
  it("calculateMonthsToTarget_StaticCapitalCounts_ReachesTargetEarlier", () => {
    expect(calculateMonthsToTarget(0, 5000, 500, 0, 4000)).toBe(2);
  });

  it("calculateMonthsToTarget_StaticCapitalDoesNotCompound_NeedsSecondMonth", () => {
    // 100 compounding at 12%/yr + 100 static: month 1 = 201, month 2 = 202.01. Compounding both would hit 202 in month 1.
    expect(calculateMonthsToTarget(100, 201.5, 0, 0.12, 100)).toBe(2);
  });
});

describe("getFireProgress", () => {
  const rules = getFireRules(createDefaultState().settings);

  it("getFireProgress_GenericFireCapital_CountsTowardTargetButNotDividends", () => {
    const stocksOnly = getFireProgress(rules, { totalMarketValue: 30000, totalCostBasis: 25000 }, new Date("2026-11-01"));
    const withGeneric = getFireProgress(rules, { totalMarketValue: 30000, totalCostBasis: 25000 }, new Date("2026-11-01"), 30000);
    expect(withGeneric.monthlyDividends).toBe(stocksOnly.monthlyDividends);
    expect(withGeneric.monthlyTotalGrowth).toBe(stocksOnly.monthlyTotalGrowth);
    expect(withGeneric.firePct).toBeCloseTo((60000 / rules.targetFireCapital) * 100, 8);
    expect(withGeneric.remainingCapital).toBeCloseTo(rules.targetFireCapital - 60000, 6);
    expect(withGeneric.monthsLeft).toBeLessThan(stocksOnly.monthsLeft);
  });
});
