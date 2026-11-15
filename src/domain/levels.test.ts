import { describe, expect, it } from "vitest";
import { calculateFractionalMonthsToTarget, calculateMonthsToTarget, getFireRules } from "./calc";
import { createDefaultState } from "./defaults";
import { LEVEL_KIND_LABEL, buildLevels, describeLevel, freedomDaysLabel, getLevelProgress, levelAt } from "./levels";

const rules = getFireRules(createDefaultState().settings);
const levels = buildLevels(rules);

describe("buildLevels", () => {
  it("defaultRules_ProducesManyAscendingLevelsNumberedFromOne", () => {
    expect(levels.length).toBeGreaterThan(40);
    expect(levels[0].n).toBe(1);
    levels.forEach((l, i) => {
      expect(l.n).toBe(i + 1);
      if (i > 0) expect(l.capital).toBeGreaterThan(levels[i - 1].capital);
    });
  });

  it("defaultRules_NeighbouringLevelsAreNotCrowdedTogether", () => {
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].capital).toBeGreaterThan(levels[i - 1].capital * 1.005);
    }
  });

  it("defaultRules_LastLevelIsReachedAtOrBeforeFireCapital", () => {
    expect(levels[levels.length - 1].capital).toBeLessThanOrEqual(rules.targetFireCapital);
  });

  it("higherTargetIncome_ScalesFinalFireLevelUp", () => {
    const bigger = buildLevels(getFireRules({ ...createDefaultState().settings, targetMonthlyPassive: 2000 }));
    const fire = (ls: typeof levels) => ls.find((l) => l.title === "FIRE: дивіденди платять за все")!.capital;
    expect(fire(bigger)).toBeCloseTo(fire(levels) * 2, 5);
  });

  it("defaultRules_NoLargeGapsBetweenLevels", () => {
    // Раніше ланцюжок злиття з'їдав усі рівні між 190k і 300k
    for (let i = 1; i < levels.length; i++) {
      if (levels[i - 1].capital < 5000) continue;
      expect(levels[i].capital / levels[i - 1].capital).toBeLessThan(1.4);
    }
  });

  it("noLevelTitleShowsTwelveMonthsAfterAYear", () => {
    expect(levels.filter((l) => / 12 міс/.test(l.title))).toEqual([]);
  });
});

describe("levelAt", () => {
  it("capitalBelowFirstLevel_ReturnsZero", () => {
    expect(levelAt(levels, 10)).toBe(0);
  });

  it("capitalExactlyOnLevel_CountsThatLevelAsReached", () => {
    expect(levelAt(levels, levels[4].capital)).toBe(5);
  });

  it("capitalAboveAllLevels_ReturnsLevelCount", () => {
    expect(levelAt(levels, rules.targetFireCapital * 10)).toBe(levels.length);
  });
});

describe("getLevelProgress", () => {
  it("halfwayBetweenLevels_ReportsFiftyPercentAndRemaining", () => {
    const a = levels[9];
    const b = levels[10];
    const p = getLevelProgress(levels, (a.capital + b.capital) / 2);
    expect(p.level).toBe(10);
    expect(p.next).toBe(b);
    expect(p.pct).toBeCloseTo(50, 5);
    expect(p.toNext).toBeCloseTo((b.capital - a.capital) / 2, 5);
  });

  it("beyondLastLevel_HasNoNextAndFullBar", () => {
    const p = getLevelProgress(levels, rules.targetFireCapital * 2);
    expect(p.next).toBeNull();
    expect(p.pct).toBe(100);
    expect(p.toNext).toBe(0);
  });
});

describe("freedomDaysLabel", () => {
  it("wholeMonths_UsesMonthWordsWithUkrainianPlural", () => {
    expect(freedomDaysLabel(30)).toBe("1 місяць свободи");
    expect(freedomDaysLabel(60)).toBe("2 місяці свободи");
    expect(freedomDaysLabel(150)).toBe("5 місяців свободи");
  });

  it("overAYear_UsesYearsAndMonths", () => {
    expect(freedomDaysLabel(365)).toBe("1 рік свободи");
    expect(freedomDaysLabel(730)).toBe("2 роки свободи");
    expect(freedomDaysLabel(1186)).toBe("3 роки 3 міс свободи");
    expect(freedomDaysLabel(1460)).toBe("4 роки свободи");
  });
});

describe("level kinds and descriptions", () => {
  it("everyLevel_HasKnownKindAndAlsoList", () => {
    for (const l of levels) {
      expect(Object.keys(LEVEL_KIND_LABEL)).toContain(l.kind);
      expect(Array.isArray(l.also)).toBe(true);
    }
  });

  it("billLevel_ExplainsMonthlyDividendsFromItsCapital", () => {
    const bill = levels.find((l) => l.kind === "bill")!;
    const text = describeLevel(bill, rules).join(" ");
    expect(text).toContain(`$${Math.round((bill.capital * 0.04) / 12)}`);
  });

  it("percentLevel_MentionsFireTargetAndShare", () => {
    const pct = levels.find((l) => l.kind === "percent")!;
    const text = describeLevel(pct, rules).join(" ");
    expect(text).toContain("$300,000");
    expect(text).toContain("%");
  });

  it("mergedMilestones_AreKeptOnTheWinningLevel", () => {
    const merged = levels.find((l) => l.also.length > 0);
    expect(merged).toBeDefined();
    expect(merged!.also).not.toContain(merged!.title);
  });

  it("everyLevel_ProducesAtLeastOneDescriptionLine", () => {
    for (const l of levels) expect(describeLevel(l, rules).length).toBeGreaterThan(0);
  });
});

describe("bill levels follow the configured order", () => {
  const billLevels = (order?: number[]) => buildLevels(rules, order).filter((l) => l.kind === "bill");

  it("defaultOrder_ListsAllSixBillsAscendingWithTheirCost", () => {
    const bills = billLevels();
    expect(bills).toHaveLength(6);
    expect(bills.map((b) => b.billCost)).toEqual([20, 80, 150, 350, 200, 200]);
    expect(bills[bills.length - 1].title).toBe("FIRE: дивіденди платять за все");
  });

  it("reorderedBills_PutTheMovedBillFirstWithItsOwnCapital", () => {
    const bills = billLevels([4, 1, 2, 3, 5, 6]);
    expect(bills[0].billCost).toBe(350);
    expect(bills[0].capital).toBeCloseTo((350 * 12) / 0.04, 5);
    expect(bills[1].billCost).toBe(20);
  });

  it("anyOrder_StillEndsAtTheFireCapital", () => {
    const bills = billLevels([6, 5, 4, 3, 2, 1]);
    expect(bills[bills.length - 1].capital).toBeCloseTo(rules.targetFireCapital, 5);
  });
});

describe("calculateFractionalMonthsToTarget", () => {
  it("integerStepCase_MatchesWholeMonthCalculation", () => {
    expect(calculateFractionalMonthsToTarget(0, 5000, 500, 0)).toBe(10);
  });

  it("withReturn_IsBetweenNeighbouringWholeMonths", () => {
    const whole = calculateMonthsToTarget(12000, 300000, 500, 0.1);
    const frac = calculateFractionalMonthsToTarget(12000, 300000, 500, 0.1);
    expect(frac).toBeGreaterThan(whole - 1);
    expect(frac).toBeLessThanOrEqual(whole);
  });

  it("staticCapitalCoversGap_ReturnsZero", () => {
    expect(calculateFractionalMonthsToTarget(0, 1000, 500, 0.1, 1000)).toBe(0);
  });

  it("noSavingsAndNoReturn_CapsInsteadOfDividingByZero", () => {
    expect(calculateFractionalMonthsToTarget(0, 1000, 0, 0)).toBe(1200);
  });
});
