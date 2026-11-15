import { describe, expect, it } from "vitest";
import { getFireRules } from "./calc";
import { createDefaultState, normalizeState } from "./defaults";
import { getYearInvested, localDateString, parseAmount, planDeposit, type DepositContext } from "./deposits";
import { FIRE_GOAL_ID } from "./goals";
import { buildLevels } from "./levels";
import type { AppState, Deposit, GenericAsset } from "./types";

const rules = getFireRules(createDefaultState().settings);
const levels = buildLevels(rules);
const now = new Date(2026, 10, 15, 12, 0, 0);

const fx = {
  rates: { EUR: { rate: 0.9, date: "2026-11-02" }, UAH: { rate: 40, date: "2026-11-01" }, GBP: { rate: 0.8, date: "2026-11-02" } },
  fetchedAt: "",
};

const generic = (id: string, currency: GenericAsset["currency"], amount: number, goalId: string): GenericAsset => ({
  id,
  name: id,
  currency,
  amount,
  goalId,
  createdAt: "",
  updatedAt: "",
});

const ctx = (patch: Partial<DepositContext> = {}): DepositContext => ({
  assets: [
    { ticker: "VOO", shares: 10, avgBuyPrice: 600, marketPrice: 700, goalId: FIRE_GOAL_ID },
    { ticker: "SCHD", shares: 20, avgBuyPrice: 80, marketPrice: 90, goalId: "g-cushion" },
  ],
  genericAssets: [generic("cash", "USD", 100, FIRE_GOAL_ID), generic("uah", "UAH", 40000, "g-cushion")],
  fx,
  ...patch,
});

describe("planDeposit", () => {
  it("stockLine_AddsSharesAndRecordsUsdValue", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "stock", ticker: "VOO", shares: 2, price: 700 }], now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assets.find((a) => a.ticker === "VOO")!.shares).toBe(12);
    expect(r.deposit.totalUsd).toBe(1400);
    expect(r.deposit.fireUsd).toBe(1400);
    expect(r.deposit.items).toEqual([{ kind: "stock", ticker: "VOO", shares: 2, price: 700, usd: 1400, fire: true }]);
  });

  it("stockLine_RecomputesAverageBuyPrice", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "stock", ticker: "VOO", shares: 10, price: 800 }], now);
    if (!r.ok) throw new Error("expected ok");
    expect(r.assets.find((a) => a.ticker === "VOO")!.avgBuyPrice).toBe(700);
  });

  it("genericLineInForeignCurrency_AddsAmountAndConvertsToUsd", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "generic", assetId: "uah", amount: 4000 }], now);
    if (!r.ok) throw new Error("expected ok");
    expect(r.genericAssets.find((a) => a.id === "uah")!.amount).toBe(44000);
    expect(r.deposit.totalUsd).toBe(100);
  });

  it("depositToNonFireGoal_CountsInTotalButNotInFireNumbers", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "generic", assetId: "uah", amount: 4000 }], now);
    if (!r.ok) throw new Error("expected ok");
    expect(r.deposit.totalUsd).toBe(100);
    expect(r.deposit.fireUsd).toBe(0);
    expect(r.deposit.daysCloser).toBe(0);
    expect(r.deposit.monthlyDividends).toBe(0);
    expect(r.deposit.levelAfter).toBe(r.deposit.levelBefore);
  });

  it("fireStockDeposit_MovesFireCloserAndReportsDividends", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "stock", ticker: "VOO", shares: 1, price: 700 }], now);
    if (!r.ok) throw new Error("expected ok");
    expect(r.deposit.daysCloser).toBeGreaterThan(0);
    expect(r.deposit.monthlyDividends).toBeCloseTo((700 * 0.04) / 12, 2);
    expect(r.deposit.projectedUsd).toBeGreaterThan(700);
    expect(r.deposit.freedomDays).toBeCloseTo(700 / ((1000 * 12) / 365), 5);
  });

  it("bigDeposit_ReportsLevelsCrossed", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "stock", ticker: "VOO", shares: 30, price: 700 }], now);
    if (!r.ok) throw new Error("expected ok");
    expect(r.deposit.levelAfter).toBeGreaterThan(r.deposit.levelBefore);
  });

  it("noPositiveLines_ReturnsEmpty", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "stock", ticker: "VOO", shares: 0, price: 700 }], now);
    expect(r).toEqual({ ok: false, reason: "empty", missingCurrencies: [] });
  });

  it("missingRateForFireAsset_FailsInsteadOfGuessing", () => {
    const r = planDeposit(
      ctx({ fx: null, genericAssets: [generic("uah", "UAH", 40000, FIRE_GOAL_ID)] }),
      rules,
      levels,
      [{ kind: "stock", ticker: "VOO", shares: 1, price: 700 }],
      now,
    );
    expect(r).toEqual({ ok: false, reason: "rates", missingCurrencies: ["UAH"] });
  });

  it("unknownGenericAssetOnly_ReturnsEmpty", () => {
    const r = planDeposit(ctx(), rules, levels, [{ kind: "generic", assetId: "nope", amount: 10 }], now);
    expect(r.ok).toBe(false);
  });

  it("doesNotMutateInputLists", () => {
    const c = ctx();
    const snapshot = JSON.stringify(c);
    planDeposit(c, rules, levels, [{ kind: "stock", ticker: "VOO", shares: 1, price: 700 }], now);
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});

describe("getYearInvested", () => {
  const dep = (date: string, fireUsd: number): Deposit => ({
    id: date,
    date,
    timestamp: "",
    items: [],
    totalUsd: fireUsd,
    fireUsd,
    daysCloser: 0,
    projectedUsd: 0,
    monthlyDividends: 0,
    freedomDays: 0,
    levelBefore: 0,
    levelAfter: 0,
  });

  it("sumsOnlyDepositsOfThatYearPlusPriorAmount", () => {
    const deposits = [dep("2025-12-30", 999), dep("2026-01-05", 500), dep("2026-11-15", 700)];
    expect(getYearInvested(deposits, { "2026": 3000 }, 2026)).toBe(4200);
  });

  it("noDepositsAndNoPrior_IsZero", () => {
    expect(getYearInvested([], {}, 2026)).toBe(0);
  });
});

describe("helpers", () => {
  it("localDateString_UsesLocalCalendarDate", () => {
    expect(localDateString(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
  });

  it("parseAmount_AcceptsCommaAndRejectsGarbageAndNegatives", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount(" 12 ")).toBe(12);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("-3")).toBe(0);
    expect(parseAmount("")).toBe(0);
  });
});

describe("normalizeState deposits", () => {
  it("oldSaveWithoutDeposits_GetsEmptyDefaults", () => {
    const s = normalizeState({});
    expect(s.deposits).toEqual([]);
    expect(s.priorInvested).toEqual({});
  });

  it("roundTrip_KeepsDepositsAndPriorInvested", () => {
    const base: AppState = createDefaultState();
    const r = planDeposit(
      { assets: base.assets, genericAssets: base.genericAssets, fx: base.fx },
      rules,
      levels,
      [{ kind: "stock", ticker: "VOO", shares: 1, price: 700 }],
      now,
    );
    if (!r.ok) throw new Error("expected ok");
    const saved = JSON.parse(JSON.stringify({ ...base, deposits: [r.deposit], priorInvested: { "2026": 1234 } }));
    const loaded = normalizeState(saved);
    expect(loaded.deposits).toEqual([r.deposit]);
    expect(loaded.priorInvested).toEqual({ "2026": 1234 });
  });

  it("corruptDepositData_IsDroppedOrCleaned", () => {
    const s = normalizeState({
      deposits: [null, { id: 1 }, { id: "ok", date: "2026-01-01", items: [{ kind: "bogus" }, { kind: "stock", ticker: "VOO", shares: 1, price: 2, usd: 2 }], totalUsd: "x" }],
      priorInvested: { "2026": 500, abc: 5, "2025": -3 },
    });
    expect(s.deposits).toHaveLength(1);
    expect(s.deposits[0].items).toHaveLength(1);
    expect(s.deposits[0].totalUsd).toBe(0);
    expect(s.priorInvested).toEqual({ "2026": 500 });
  });
});
