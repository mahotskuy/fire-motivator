import { describe, expect, it } from "vitest";
import { createDefaultState } from "./defaults";
import {
  buyOrUpdateAsset,
  calculateMonthsToTarget,
  compareToSnapshot,
  formatDaysAndHours,
  getBillCoverage,
  getFireRules,
  getPlannedCapitalForToday,
  getPortfolioTotals,
  getTimeBuyer,
} from "./calc";

const rules = getFireRules(createDefaultState().settings);

describe("getFireRules", () => {
  it("defaultSettings_ComputesTargetAndCrossoverCapital", () => {
    expect(rules.targetFireCapital).toBe(300000);
    expect(rules.crossoverCapital).toBeCloseTo(60000, 5);
    expect(rules.totalAnnualReturn).toBeCloseTo(0.1, 10);
  });

  it("zeroDividendYield_ClampsToAvoidInfiniteTarget", () => {
    const r = getFireRules({ ...createDefaultState().settings, expectedDividendYield: 0 });
    expect(Number.isFinite(r.targetFireCapital)).toBe(true);
  });
});

describe("calculateMonthsToTarget", () => {
  it("capitalAlreadyAtTarget_ReturnsZero", () => {
    expect(calculateMonthsToTarget(300000, 300000, 500, 0.1)).toBe(0);
  });

  it("noReturnAndSavings_ReturnsLinearMonths", () => {
    expect(calculateMonthsToTarget(0, 5000, 500, 0)).toBe(10);
  });

  it("unreachableTarget_StopsAtCap", () => {
    expect(calculateMonthsToTarget(0, 1e12, 1, 0)).toBe(1200);
  });
});

describe("getPortfolioTotals", () => {
  it("presetAssets_SumsMarketValueAndCostBasis", () => {
    const totals = getPortfolioTotals([{ ticker: "A", shares: 2, avgBuyPrice: 10, marketPrice: 15 }]);
    expect(totals).toEqual({ totalMarketValue: 30, totalCostBasis: 20 });
  });
});

describe("getPlannedCapitalForToday", () => {
  it("startThisMonth_PlansOneMonthOfSavings", () => {
    const now = new Date(2026, 5, 15);
    const planned = getPlannedCapitalForToday({ ...rules, planStartDate: "2026-06-01" }, now);
    expect(planned).toBe(500);
  });
});

describe("formatDaysAndHours", () => {
  it("lessThanOneDay_ShowsHoursOnly", () => {
    expect(formatDaysAndHours(0.5)).toBe("12 год (0 дн.)");
  });

  it("daysWithFraction_ShowsDaysAndHours", () => {
    expect(formatDaysAndHours(3.5)).toBe("3 дн. 12 год");
  });
});

describe("getBillCoverage", () => {
  it("dividendsCoverFirstTwoBills_UnlocksTwoLevels", () => {
    const { levels, unlockedCount } = getBillCoverage(rules, 100);
    expect(unlockedCount).toBe(2);
    expect(levels[2].covered).toBeCloseTo(0, 5);
  });

  it("higherTargetIncome_ScalesBillCosts", () => {
    const doubled = getFireRules({ ...createDefaultState().settings, targetMonthlyPassive: 2000 });
    expect(getBillCoverage(doubled, 0).levels[0].billCost).toBe(40);
  });
});

describe("getTimeBuyer", () => {
  it("fiveHundredDollars_BuysPerpetualDaysFromDividends", () => {
    const result = getTimeBuyer(rules, 0, 500);
    expect(result.perpetualDaysPerYear).toBeCloseTo((500 * 0.04) / (12000 / 365), 5);
  });

  it("portfolioAboveTarget_CapsCoveredYearAt365", () => {
    expect(getTimeBuyer(rules, 1e7, 0).coveredPct).toBe(100);
  });
});

describe("compareToSnapshot", () => {
  it("cashAddedAndMarketMove_SplitsDeltaIntoCostBasisAndMarket", () => {
    const baseline = {
      id: "s",
      date: "2026-09-30",
      timestamp: "",
      totalMarketValue: 1000,
      totalCostBasis: 900,
      positionsSummary: "",
      note: "",
    };
    const result = compareToSnapshot(
      baseline,
      { totalMarketValue: 1700, totalCostBasis: 1400 },
      new Date("2026-10-30"),
    );
    expect(result.totalDelta).toBe(700);
    expect(result.costBasisDelta).toBe(500);
    expect(result.marketDelta).toBe(200);
    expect(result.daysDiff).toBe(30);
    expect(result.monthlyPace).toBeCloseTo(700, 5);
  });
});

describe("buyOrUpdateAsset", () => {
  it("existingTicker_AveragesCostAndSumsShares", () => {
    const assets = [{ ticker: "VOO", shares: 1, avgBuyPrice: 100, marketPrice: 100 }];
    const [updated] = buyOrUpdateAsset(assets, "VOO", 1, 200);
    expect(updated.shares).toBe(2);
    expect(updated.avgBuyPrice).toBe(150);
    expect(updated.marketPrice).toBe(200);
  });

  it("newTicker_AppendsPosition", () => {
    expect(buyOrUpdateAsset([], "SCHD", 2, 89.2)).toEqual([
      { ticker: "SCHD", shares: 2, avgBuyPrice: 89.2, marketPrice: 89.2 },
    ]);
  });
});
