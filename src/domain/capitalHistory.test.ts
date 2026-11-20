import { describe, expect, it } from "vitest";
import { getEtfAllocation } from "./allocation";
import type { FireRules } from "./calc";
import { buildCapitalHistory, buildPlanHistory } from "./capitalHistory";
import type { Snapshot } from "./types";
import type { Wealth } from "./wealth";

const snap = (date: string, over: Partial<Snapshot> = {}): Snapshot => ({
  id: `snap-${date}`,
  date,
  timestamp: `${date}T10:00:00.000Z`,
  totalMarketValue: 1000,
  totalCostBasis: 800,
  positionsSummary: "",
  note: "",
  stocksValue: 1000,
  genericValue: 500,
  combinedWealth: 1500,
  ...over,
});

const legacy = (date: string): Snapshot => ({
  id: `old-${date}`,
  date,
  timestamp: `${date}T10:00:00.000Z`,
  totalMarketValue: 600,
  totalCostBasis: 550,
  positionsSummary: "",
  note: "",
});

const wealth: Wealth = {
  stocks: { totalMarketValue: 2000, totalCostBasis: 1500 },
  fireStocks: { totalMarketValue: 2000, totalCostBasis: 1500 },
  genericValue: 300,
  fireGenericValue: 300,
  combinedWealth: 2300,
  missingCurrencies: [],
};

describe("buildCapitalHistory", () => {
  it("buildCapitalHistory_WealthScope_CountsCashAsInvestedAndAppendsLivePoint", () => {
    const pts = buildCapitalHistory([snap("2026-10-01")], wealth, "wealth", "all", "2026-11-20");
    expect(pts).toEqual([
      { date: "2026-10-01", capital: 1500, invested: 1300, live: false },
      { date: "2026-11-20", capital: 2300, invested: 1800, live: true },
    ]);
  });

  it("buildCapitalHistory_WealthScope_SkipsLegacySnapshots", () => {
    const pts = buildCapitalHistory([legacy("2026-01-01"), snap("2026-10-01")], null, "wealth", "all", "2026-11-20");
    expect(pts.map((p) => p.date)).toEqual(["2026-10-01"]);
  });

  it("buildCapitalHistory_StocksScope_IncludesLegacySnapshots", () => {
    const pts = buildCapitalHistory([snap("2026-10-01"), legacy("2026-01-01")], null, "stocks", "all", "2026-11-20");
    expect(pts).toEqual([
      { date: "2026-01-01", capital: 600, invested: 550, live: false },
      { date: "2026-10-01", capital: 1000, invested: 800, live: false },
    ]);
  });

  it("buildCapitalHistory_SameDaySnapshots_KeepsLatestAndLiveReplacesToday", () => {
    const pts = buildCapitalHistory(
      [
        snap("2026-10-01", { combinedWealth: 1 }),
        snap("2026-10-01", { combinedWealth: 2, timestamp: "2026-10-01T20:00:00.000Z" }),
        snap("2026-11-20"),
      ],
      wealth,
      "wealth",
      "all",
      "2026-11-20",
    );
    expect(pts.map((p) => [p.date, p.capital, p.live])).toEqual([
      ["2026-10-01", 2, false],
      ["2026-11-20", 2300, true],
    ]);
  });

  it("buildCapitalHistory_Period_DropsPointsBeforeCutoff", () => {
    const pts = buildCapitalHistory([snap("2026-05-19"), snap("2026-05-20")], null, "wealth", "6m", "2026-11-20");
    expect(pts.map((p) => p.date)).toEqual(["2026-05-20"]);
  });

  it("buildCapitalHistory_MissingRates_OmitsLivePointForWealthOnly", () => {
    const noRates = { ...wealth, genericValue: null, combinedWealth: null };
    expect(buildCapitalHistory([], noRates, "wealth", "all", "2026-11-20")).toEqual([]);
    expect(buildCapitalHistory([], noRates, "stocks", "all", "2026-11-20")).toHaveLength(1);
  });
});

describe("buildPlanHistory", () => {
  const rules = {
    targetMonthlyPassive: 1000,
    mandatoryMonthlySave: 1000,
    growthDecimal: 0.07,
    divDecimal: 0,
    totalAnnualReturn: 0,
    targetFireCapital: 300_000,
    currentAge: 30,
    planStartDate: "2026-01-01",
  } as unknown as FireRules;

  it("buildPlanHistory_SnapshotsAndLive_PairsFireCapitalWithPlanForThatDate", () => {
    const pts = buildPlanHistory([snap("2026-04-10", { fireValue: 3500 }), legacy("2026-02-01")], wealth, rules, "all", "2026-11-20");
    expect(pts).toEqual([
      { date: "2026-04-10", capital: 3500, plan: 3000, live: false },
      { date: "2026-11-20", capital: 2300, plan: 10_000, live: true },
    ]);
  });
});

describe("getEtfAllocation", () => {
  it("getEtfAllocation_Positions_SortsByValueWithShares", () => {
    const res = getEtfAllocation([
      { ticker: "SCHD", shares: 10, avgBuyPrice: 1, marketPrice: 25, goalId: "fire" },
      { ticker: "VOO", shares: 1, avgBuyPrice: 1, marketPrice: 750, goalId: "fire" },
      { ticker: "OLD", shares: 0, avgBuyPrice: 1, marketPrice: 10, goalId: "fire" },
    ]);
    expect(res.map((s) => [s.ticker, s.value, s.share])).toEqual([
      ["VOO", 750, 0.75],
      ["SCHD", 250, 0.25],
    ]);
  });
});
