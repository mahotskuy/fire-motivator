import { describe, expect, it } from "vitest";
import { createGenericAsset, removeGenericAsset, updateGenericAsset } from "./genericAssets";
import { FIRE_GOAL_ID, canDeleteGoal, createFireGoal, isDeletedGoalTransaction } from "./goals";
import type { Asset, GenericAsset, Goal } from "./types";

const goals: Goal[] = [
  createFireGoal(),
  { id: "g-vacation", name: "Vacation", targetAmount: 1000, targetDate: "2027-08-01" },
];
const t0 = new Date("2026-11-01T10:00:00.000Z");
const t1 = new Date("2026-11-02T10:00:00.000Z");

const cash = (): GenericAsset => ({
  id: "a1",
  name: "Bank cash",
  currency: "EUR",
  amount: 500,
  goalId: "g-vacation",
  createdAt: t0.toISOString(),
  updatedAt: t0.toISOString(),
});

describe("createGenericAsset", () => {
  it("createGenericAsset_ValidInput_StampsCreatedAndUpdatedAtWithGeneratedId", () => {
    const res = createGenericAsset({ name: " Bank cash ", currency: "EUR", amount: 500, goalId: "g-vacation" }, goals, t0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.asset).toMatchObject({
      name: "Bank cash",
      currency: "EUR",
      amount: 500,
      goalId: "g-vacation",
      createdAt: t0.toISOString(),
      updatedAt: t0.toISOString(),
    });
    expect(res.asset.id).toBeTruthy();
  });

  it("createGenericAsset_ZeroAmount_IsAccepted", () => {
    expect(createGenericAsset({ name: "Empty", currency: "USD", amount: 0, goalId: FIRE_GOAL_ID }, goals, t0).ok).toBe(true);
  });

  it("createGenericAsset_NegativeOrNonFiniteAmount_IsRejected", () => {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(createGenericAsset({ name: "X", currency: "USD", amount, goalId: FIRE_GOAL_ID }, goals, t0).ok).toBe(false);
    }
  });

  it("createGenericAsset_BlankNameOrUnknownGoalOrCurrency_IsRejected", () => {
    expect(createGenericAsset({ name: "  ", currency: "USD", amount: 1, goalId: FIRE_GOAL_ID }, goals, t0).ok).toBe(false);
    expect(createGenericAsset({ name: "X", currency: "USD", amount: 1, goalId: "nope" }, goals, t0).ok).toBe(false);
    expect(createGenericAsset({ name: "X", currency: "JPY" as never, amount: 1, goalId: FIRE_GOAL_ID }, goals, t0).ok).toBe(false);
  });
});

describe("updateGenericAsset", () => {
  it("updateGenericAsset_AmountChanged_BumpsUpdatedAtAndKeepsCreatedAt", () => {
    const [updated] = updateGenericAsset([cash()], "a1", { amount: 750 }, goals, t1);
    expect(updated.amount).toBe(750);
    expect(updated.updatedAt).toBe(t1.toISOString());
    expect(updated.createdAt).toBe(t0.toISOString());
  });

  it("updateGenericAsset_SameValues_LeavesUpdatedAtUntouched", () => {
    const [updated] = updateGenericAsset([cash()], "a1", { amount: 500, name: "Bank cash" }, goals, t1);
    expect(updated.updatedAt).toBe(t0.toISOString());
  });

  it("updateGenericAsset_InvalidAmountOrUnknownGoal_IgnoresThePatch", () => {
    const [updated] = updateGenericAsset([cash()], "a1", { amount: -5, goalId: "nope", name: "" }, goals, t1);
    expect(updated).toEqual(cash());
  });

  it("updateGenericAsset_GoalReassigned_MovesAssetToNewGoal", () => {
    const [updated] = updateGenericAsset([cash()], "a1", { goalId: FIRE_GOAL_ID }, goals, t1);
    expect(updated.goalId).toBe(FIRE_GOAL_ID);
    expect(updated.updatedAt).toBe(t1.toISOString());
  });
});

describe("removeGenericAsset", () => {
  it("removeGenericAsset_ExistingId_DropsOnlyThatAsset", () => {
    const other = { ...cash(), id: "a2" };
    expect(removeGenericAsset([cash(), other], "a1")).toEqual([other]);
  });
});

describe("canDeleteGoal", () => {
  const stock: Asset = { ticker: "VOO", shares: 1, avgBuyPrice: 1, marketPrice: 1, goalId: "g-vacation" };

  it("canDeleteGoal_GenericAssetLinked_BlocksDeletion", () => {
    expect(canDeleteGoal("g-vacation", [], [cash()], goals)).toEqual({ ok: false, reason: "linked", count: 1 });
  });

  it("canDeleteGoal_StockLinked_BlocksDeletion", () => {
    expect(canDeleteGoal("g-vacation", [stock], [], goals)).toEqual({ ok: false, reason: "linked", count: 1 });
  });

  it("canDeleteGoal_NoLinkedAssetsAfterReassignment_AllowsDeletion", () => {
    const moved = { ...cash(), goalId: FIRE_GOAL_ID };
    expect(canDeleteGoal("g-vacation", [], [moved], goals)).toEqual({ ok: true });
  });

  it("canDeleteGoal_BuiltInFireGoal_IsAlwaysBlocked", () => {
    expect(canDeleteGoal(FIRE_GOAL_ID, [], [], goals)).toEqual({ ok: false, reason: "builtin", count: 0 });
  });
});

describe("isDeletedGoalTransaction", () => {
  const base = { date: "2026-09-05", amount: 10, note: "" };

  it("isDeletedGoalTransaction_GoalStillExists_ReturnsFalse", () => {
    expect(isDeletedGoalTransaction({ ...base, goalName: "Vacation", goalId: "g-vacation" }, goals)).toBe(false);
  });

  it("isDeletedGoalTransaction_RecreatedGoalWithSameName_StillReturnsTrue", () => {
    expect(isDeletedGoalTransaction({ ...base, goalName: "Vacation", goalId: "g-old-vacation" }, goals)).toBe(true);
  });

  it("isDeletedGoalTransaction_NoGoalId_ReturnsTrue", () => {
    expect(isDeletedGoalTransaction({ ...base, goalName: "Gone" }, goals)).toBe(true);
  });
});
