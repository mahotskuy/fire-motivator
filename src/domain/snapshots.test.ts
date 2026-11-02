import { describe, expect, it } from "vitest";
import { createDefaultState, normalizeState } from "./defaults";
import { FIRE_GOAL_ID, createFireGoal } from "./goals";
import { buildSnapshot, isLegacySnapshot } from "./snapshots";
import type { AppState } from "./types";

const fx = {
  rates: { EUR: { rate: 0.5, date: "2026-11-02" }, UAH: { rate: 40, date: "2026-11-01" }, GBP: { rate: 0.8, date: "2026-11-02" } },
  fetchedAt: "2026-11-02T00:00:00.000Z",
};

const baseState = (): AppState => ({
  ...createDefaultState(),
  goals: [createFireGoal(), { id: "g-v", name: "Vacation", targetAmount: 1000, targetDate: "2027-01-01" }],
  assets: [
    { ticker: "VOO", shares: 2, avgBuyPrice: 80, marketPrice: 100, goalId: FIRE_GOAL_ID },
    { ticker: "SCHD", shares: 1, avgBuyPrice: 40, marketPrice: 50, goalId: "g-v" },
  ],
  genericAssets: [
    { id: "a-eur", name: "Cash", currency: "EUR", amount: 100, goalId: FIRE_GOAL_ID, createdAt: "", updatedAt: "" },
    { id: "a-uah", name: "Bonds", currency: "UAH", amount: 4000, goalId: "g-v", createdAt: "", updatedAt: "" },
  ],
  fx,
});

const now = new Date("2026-11-02T12:00:00.000Z");

describe("buildSnapshot", () => {
  it("buildSnapshot_MixedAssets_FreezesSeparateStockGenericCombinedAndFireTotals", () => {
    const res = buildSnapshot(baseState(), "2026-11-02", "note", now, true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const s = res.snapshot;
    expect(s.totalMarketValue).toBe(250);
    expect(s.totalCostBasis).toBe(200);
    expect(s.stocksValue).toBe(250);
    expect(s.genericValue).toBe(300);
    expect(s.combinedWealth).toBe(550);
    expect(s.fireValue).toBe(400);
    expect(s.usedCachedRates).toBe(false);
    expect(s.fxRates).toEqual(fx.rates);
    expect(s.genericAssets).toEqual([
      { id: "a-eur", name: "Cash", currency: "EUR", amount: 100, usdValue: 200, goalId: FIRE_GOAL_ID, goalName: "🔥 FIRE" },
      { id: "a-uah", name: "Bonds", currency: "UAH", amount: 4000, usdValue: 100, goalId: "g-v", goalName: "Vacation" },
    ]);
    expect(s.stocks?.map((x) => [x.ticker, x.goalName])).toEqual([
      ["VOO", "🔥 FIRE"],
      ["SCHD", "Vacation"],
    ]);
  });

  it("buildSnapshot_RateMissing_RefusesToBuildAndNamesMissingCurrency", () => {
    const res = buildSnapshot({ ...baseState(), fx: null }, "2026-11-02", "", now, false);
    expect(res).toEqual({ ok: false, missingCurrencies: ["EUR", "UAH"] });
  });

  it("buildSnapshot_CachedRatesInUse_FlagsSnapshotAsUsingCachedRates", () => {
    const res = buildSnapshot(baseState(), "2026-11-02", "", now, false);
    expect(res.ok && res.snapshot.usedCachedRates).toBe(true);
  });

  it("buildSnapshot_OnlyUsdAssetsAndNoRates_StillSucceedsWithoutStaleFlag", () => {
    const state: AppState = {
      ...baseState(),
      fx: null,
      genericAssets: [{ id: "u", name: "USD", currency: "USD", amount: 50, goalId: FIRE_GOAL_ID, createdAt: "", updatedAt: "" }],
    };
    const res = buildSnapshot(state, "2026-11-02", "", now, false);
    expect(res.ok).toBe(true);
    expect(res.ok && res.snapshot.usedCachedRates).toBe(false);
    expect(res.ok && res.snapshot.combinedWealth).toBe(300);
    expect(res.ok && "fxRates" in res.snapshot).toBe(false);
  });

  it("buildSnapshot_LaterAssetEdit_DoesNotChangeAlreadyBuiltSnapshot", () => {
    const state = baseState();
    const res = buildSnapshot(state, "2026-11-02", "", now, true);
    state.genericAssets[0].amount = 999999;
    expect(res.ok && res.snapshot.genericAssets?.[0].amount).toBe(100);
  });
});

describe("isLegacySnapshot", () => {
  it("isLegacySnapshot_StockOnlySampleSnapshot_ReturnsTrue", () => {
    expect(isLegacySnapshot(createDefaultState().snapshots[0])).toBe(true);
  });

  it("isLegacySnapshot_BuiltSnapshot_ReturnsFalse", () => {
    const res = buildSnapshot(baseState(), "2026-11-02", "", now, true);
    expect(res.ok && isLegacySnapshot(res.snapshot)).toBe(false);
  });
});

describe("normalizeState", () => {
  const legacy = {
    settings: {},
    assets: [{ ticker: "VOO", shares: 1, avgBuyPrice: 1, marketPrice: 2 }],
    snapshots: [{ id: "s", date: "2026-01-01", timestamp: "", totalMarketValue: 10, totalCostBasis: 9, positionsSummary: "", note: "" }],
    goals: [{ name: "Trip", targetAmount: 100, targetDate: "2027-01-01" }],
    transactions: [
      { date: "2026-02-01", goalName: "Trip", amount: 5, note: "" },
      { date: "2026-02-02", goalName: "Deleted long ago", amount: 7, note: "" },
    ],
  };

  it("normalizeState_LegacyStocksWithoutGoal_AssignsThemToFire", () => {
    expect(normalizeState(legacy).assets[0].goalId).toBe(FIRE_GOAL_ID);
  });

  it("normalizeState_LegacyGoals_GetStableIdsAndBuiltInFireGoalFirst", () => {
    const a = normalizeState(legacy);
    const b = normalizeState(legacy);
    expect(a.goals[0]).toEqual(createFireGoal());
    expect(a.goals[1].name).toBe("Trip");
    expect(a.goals[1].id).toBe(b.goals[1].id);
  });

  it("normalizeState_LegacyTransactions_LinkByNameOnlyWhenGoalStillExists", () => {
    const s = normalizeState(legacy);
    expect(s.transactions[0].goalId).toBe(s.goals[1].id);
    expect(s.goals.some((g) => g.id === s.transactions[1].goalId)).toBe(false);
    expect(s.transactions[1].goalName).toBe("Deleted long ago");
  });

  it("normalizeState_TransactionWithDeletedGoalId_StaysOrphanedEvenIfNameReused", () => {
    const s = normalizeState({ ...legacy, transactions: [{ date: "", goalName: "Trip", goalId: "old-id", amount: 1, note: "" }] });
    expect(s.goals.some((g) => g.id === s.transactions[0].goalId)).toBe(false);
  });

  it("normalizeState_OrphanedHistoryThenGoalRecreatedWithSameName_NeverReconnectsAcrossReloads", () => {
    const once = normalizeState(legacy);
    const recreated = { ...once, goals: [...once.goals, { id: "goal-new", name: "Deleted long ago", targetAmount: 1, targetDate: "2027-01-01" }] };
    const twice = normalizeState(JSON.parse(JSON.stringify(recreated)));
    expect(twice.transactions[1].goalId).not.toBe("goal-new");
    expect(twice.transactions[1].goalId).toBe(once.transactions[1].goalId);
  });

  it("normalizeState_AnyTransaction_HasDefinedGoalIdBecauseFirestoreRejectsUndefined", () => {
    const s = normalizeState(legacy);
    expect(s.transactions.every((t) => typeof t.goalId === "string")).toBe(true);
  });

  it("normalizeState_LegacySnapshots_ArePreservedUnchangedAndStayLegacy", () => {
    const s = normalizeState(legacy);
    expect(s.snapshots).toEqual(legacy.snapshots);
    expect(isLegacySnapshot(s.snapshots[0])).toBe(true);
  });

  it("normalizeState_EmptyAssetsArray_IsNotRepopulatedWithSamples", () => {
    expect(normalizeState({ ...legacy, assets: [] }).assets).toEqual([]);
  });

  it("normalizeState_SavedStateRoundTrip_KeepsGenericAssetsFxAndAuditFields", () => {
    const state = baseState();
    state.genericAssets.forEach((a) => {
      a.createdAt = "2026-10-01T00:00:00.000Z";
      a.updatedAt = "2026-10-02T00:00:00.000Z";
    });
    const restored = normalizeState(JSON.parse(JSON.stringify(state)));
    expect(restored.genericAssets).toEqual(state.genericAssets);
    expect(restored.fx).toEqual(state.fx);
    expect(restored.assets).toEqual(state.assets);
  });

  it("normalizeState_InvalidGenericAssets_AreDropped", () => {
    const state = { ...baseState(), genericAssets: [{ id: "x", name: "Bad", currency: "JPY", amount: 1, goalId: "fire" }, { id: "y", name: "Neg", currency: "USD", amount: -1, goalId: "fire" }] };
    expect(normalizeState(state).genericAssets).toEqual([]);
  });

  it("normalizeState_GenericAssetPointingToUnknownGoal_FallsBackToFire", () => {
    const state = { ...baseState(), genericAssets: [{ id: "x", name: "N", currency: "USD", amount: 1, goalId: "gone", createdAt: "c", updatedAt: "u" }] };
    expect(normalizeState(state).genericAssets[0].goalId).toBe(FIRE_GOAL_ID);
  });
});
