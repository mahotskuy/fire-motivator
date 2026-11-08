import type { Asset, Goal, Settings, Snapshot } from "./types";
import { BILL_LEVELS, DEFAULT_BILL_LEVEL_ORDER } from "./defaults";
import { FIRE_GOAL_ID } from "./goals";

export interface FireRules {
  targetMonthlyPassive: number;
  mandatoryMonthlySave: number;
  growthDecimal: number;
  divDecimal: number;
  totalAnnualReturn: number;
  targetFireCapital: number;
  crossoverCapital: number;
  currentAge: number;
  planStartDate: string;
}

export interface PortfolioTotals {
  totalMarketValue: number;
  totalCostBasis: number;
}

export function sanitizeSettings(s: Settings): Settings {
  return {
    targetMonthlyPassive: Math.max(50, Number(s.targetMonthlyPassive) || 1000),
    mandatoryMonthlySave: Math.max(10, Number(s.mandatoryMonthlySave) || 500),
    expectedGrowthRate: Math.max(0, Number(s.expectedGrowthRate) || 0),
    expectedDividendYield: Math.max(0.5, Number(s.expectedDividendYield) || 0.5),
    currentAge: Math.max(16, Number(s.currentAge) || 31),
    planStartDate: s.planStartDate || "2024-01-01",
  };
}

export function getFireRules(settings: Settings): FireRules {
  const s = sanitizeSettings(settings);
  const growthDecimal = s.expectedGrowthRate / 100;
  const divDecimal = s.expectedDividendYield / 100;
  const totalAnnualReturn = growthDecimal + divDecimal;
  const targetFireCapital = (s.targetMonthlyPassive * 12) / divDecimal;
  const crossoverCapital =
    totalAnnualReturn > 0 ? (s.mandatoryMonthlySave * 12) / totalAnnualReturn : targetFireCapital;

  return {
    targetMonthlyPassive: s.targetMonthlyPassive,
    mandatoryMonthlySave: s.mandatoryMonthlySave,
    growthDecimal,
    divDecimal,
    totalAnnualReturn,
    targetFireCapital,
    crossoverCapital,
    currentAge: s.currentAge,
    planStartDate: s.planStartDate,
  };
}

export function calculateMonthsToTarget(
  currentCapital: number,
  targetCapital: number,
  monthlySave: number,
  annualReturn: number,
  staticCapital = 0,
): number {
  if (currentCapital + staticCapital >= targetCapital) return 0;
  let balance = currentCapital;
  let months = 0;
  const r = annualReturn / 12;
  while (balance + staticCapital < targetCapital && months < 1200) {
    balance = balance * (1 + r) + monthlySave;
    months++;
  }
  return months;
}

export function getPortfolioTotals(assets: Asset[]): PortfolioTotals {
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  for (const a of assets) {
    const shares = Number(a.shares) || 0;
    totalMarketValue += shares * (Number(a.marketPrice) || 0);
    totalCostBasis += shares * (Number(a.avgBuyPrice) || 0);
  }
  return { totalMarketValue, totalCostBasis };
}

export function getPlannedCapitalForToday(rules: FireRules, now: Date = new Date()): number {
  const start = new Date(rules.planStartDate || "2024-01-01");
  const monthsElapsed = Math.max(
    1,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
  );
  const r = rules.totalAnnualReturn / 12;
  let planned = 0;
  for (let i = 0; i < monthsElapsed; i++) {
    planned = planned * (1 + r) + rules.mandatoryMonthlySave;
  }
  return planned;
}

export function formatDaysAndHours(totalDaysFloat: number): string {
  const wholeDays = Math.floor(totalDaysFloat);
  const remHours = Math.round((totalDaysFloat - wholeDays) * 24);
  if (wholeDays <= 0) {
    return `${Math.max(0, Math.round(totalDaysFloat * 24))} год (0 дн.)`;
  }
  return `${wholeDays} дн. ${remHours} год`;
}

export interface FireProgress {
  totalPnl: number;
  totalPnlPct: number;
  plannedCapital: number;
  deltaToPlan: number;
  monthlyDividends: number;
  monthlyTotalGrowth: number;
  firePct: number;
  remainingCapital: number;
  runwayMonths: number;
  runwayDays: number;
  monthsLeft: number;
  yearsLeft: number;
  remMonths: number;
  retireAge: number;
  crossoverPct: number;
  leftToCross: number;
}

// `staticCapital` — кошти без прогнозованої дохідності (генеричні активи): враховуються в цілі, але не дають дивідендів і росту
export function getFireProgress(
  rules: FireRules,
  totals: PortfolioTotals,
  now: Date = new Date(),
  staticCapital = 0,
): FireProgress {
  const { totalMarketValue, totalCostBasis } = totals;
  const totalCapital = totalMarketValue + staticCapital;
  const totalPnl = totalMarketValue - totalCostBasis;
  const plannedCapital = getPlannedCapitalForToday(rules, now);
  const monthlyDividends = (totalMarketValue * rules.divDecimal) / 12;
  const monthlyTotalGrowth = (totalMarketValue * rules.totalAnnualReturn) / 12;
  const monthsLeft = calculateMonthsToTarget(
    totalMarketValue,
    rules.targetFireCapital,
    rules.mandatoryMonthlySave,
    rules.totalAnnualReturn,
    staticCapital,
  );

  return {
    totalPnl,
    totalPnlPct: totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0,
    plannedCapital,
    deltaToPlan: totalCapital - plannedCapital,
    monthlyDividends,
    monthlyTotalGrowth,
    firePct: Math.min(100, (totalCapital / rules.targetFireCapital) * 100),
    remainingCapital: Math.max(0, rules.targetFireCapital - totalCapital),
    runwayMonths: totalCapital / rules.targetMonthlyPassive,
    runwayDays: Math.round(totalCapital / ((rules.targetMonthlyPassive * 12) / 365)),
    monthsLeft,
    yearsLeft: Math.floor(monthsLeft / 12),
    remMonths: monthsLeft % 12,
    retireAge: rules.currentAge + monthsLeft / 12,
    crossoverPct: Math.min(100, (monthlyTotalGrowth / rules.mandatoryMonthlySave) * 100),
    leftToCross: Math.max(0, rules.crossoverCapital - totalCapital),
  };
}

export interface TimeBuyerResult {
  costPerDay: number;
  costPerHour: number;
  perpetualDaysPerYear: number;
  directDays: number;
  daysSavedToFire: number;
  coveredDaysTotal: number;
  coveredPct: number;
}

export function getTimeBuyer(rules: FireRules, totalMarketValue: number, simAmount: number, staticCapital = 0): TimeBuyerResult {
  const annualExpenses = rules.targetMonthlyPassive * 12;
  const costPerDay = annualExpenses / 365;
  const costPerHour = annualExpenses / (365 * 24);

  const monthsNow = calculateMonthsToTarget(
    totalMarketValue,
    rules.targetFireCapital,
    rules.mandatoryMonthlySave,
    rules.totalAnnualReturn,
    staticCapital,
  );
  const monthsAfter = calculateMonthsToTarget(
    totalMarketValue + simAmount,
    rules.targetFireCapital,
    rules.mandatoryMonthlySave,
    rules.totalAnnualReturn,
    staticCapital,
  );
  const coveredDaysTotal = Math.min(365, (totalMarketValue * rules.divDecimal) / costPerDay);

  return {
    costPerDay,
    costPerHour,
    perpetualDaysPerYear: (simAmount * rules.divDecimal) / costPerDay,
    directDays: simAmount / costPerDay,
    daysSavedToFire: Math.max(0, Math.round((monthsNow - monthsAfter) * 30.4375)),
    coveredDaysTotal,
    coveredPct: Math.min(100, (coveredDaysTotal / 365) * 100),
  };
}

export interface BillCoverage {
  id: number;
  name: string;
  icon: string;
  billCost: number;
  neededCapital: number;
  investedCapital: number;
  pct: number;
  unlocked: boolean;
}

// Капітал заповнює рівні у порядку `order` (зверху вниз), незалежно від порядку в BILL_LEVELS
export function getBillCoverage(
  rules: FireRules,
  investedCapital: number,
  order: number[] = DEFAULT_BILL_LEVEL_ORDER,
) {
  const scaleFactor = rules.targetMonthlyPassive / 1000;
  let remaining = investedCapital;
  const byId = new Map(BILL_LEVELS.map((bill) => [bill.id, bill]));
  const ordered = order.flatMap((id) => {
    const bill = byId.get(id);
    return bill ? [bill] : [];
  });

  const levels: BillCoverage[] = ordered.map((bill) => {
    const billCost = Math.round(bill.baseCost * scaleFactor);
    const neededCapital = rules.divDecimal > 0 ? Math.round((billCost * 12) / rules.divDecimal) : Infinity;
    const invested = Math.min(neededCapital, Math.max(0, remaining));
    remaining -= invested;
    const pct = neededCapital > 0 ? (invested / neededCapital) * 100 : 100;
    return {
      id: bill.id,
      name: bill.name,
      icon: bill.icon,
      billCost,
      neededCapital,
      investedCapital: invested,
      pct,
      unlocked: pct >= 99.9,
    };
  });

  return { levels, unlockedCount: levels.filter((l) => l.unlocked).length };
}

// Пересуває рівень на одну позицію вгору (-1) або вниз (+1); на краю порядок не змінюється
export function moveBillLevel(order: number[], id: number, direction: -1 | 1): number[] {
  const index = order.indexOf(id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export interface SnapshotComparison {
  totalDelta: number;
  totalDeltaPct: number;
  costBasisDelta: number;
  marketDelta: number;
  daysDiff: number;
  monthlyPace: number;
}

export function compareToSnapshot(
  baseline: Snapshot,
  totals: PortfolioTotals,
  now: Date = new Date(),
): SnapshotComparison {
  const totalDelta = totals.totalMarketValue - baseline.totalMarketValue;
  const costBasisDelta = totals.totalCostBasis - (baseline.totalCostBasis || totals.totalCostBasis);
  const daysDiff = Math.max(
    1,
    Math.round((now.getTime() - new Date(baseline.date).getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    totalDelta,
    totalDeltaPct: baseline.totalMarketValue > 0 ? (totalDelta / baseline.totalMarketValue) * 100 : 0,
    costBasisDelta,
    marketDelta: totalDelta - costBasisDelta,
    daysDiff,
    monthlyPace: (totalDelta / daysDiff) * 30,
  };
}

export function getGoalProgress(goal: Goal, saved: number, now: Date = new Date()) {
  const pct = Math.min(100, (saved / (Number(goal.targetAmount) || 1)) * 100);
  const monthsRem = Math.max(
    1,
    Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4)),
  );
  const remAmount = Math.max(0, goal.targetAmount - saved);
  return { saved, pct, monthsRem, monthlyNeed: remAmount > 0 ? Math.ceil(remAmount / monthsRem) : 0 };
}

// Існуюча позиція зберігає свою ціль; `goalId` застосовується лише до нових тікерів
export function buyOrUpdateAsset(
  assets: Asset[],
  ticker: string,
  shares: number,
  price: number,
  goalId: string = FIRE_GOAL_ID,
): Asset[] {
  const existing = assets.find((a) => a.ticker === ticker);
  if (!existing) {
    return [
      ...assets,
      {
        ticker,
        shares: Number(shares.toFixed(4)),
        avgBuyPrice: Number(price.toFixed(2)),
        marketPrice: Number(price.toFixed(2)),
        goalId,
      },
    ];
  }
  const totalCost = existing.shares * existing.avgBuyPrice + shares * price;
  const newShares = Number((existing.shares + shares).toFixed(4));
  return assets.map((a) =>
    a === existing
      ? {
          ...a,
          shares: newShares,
          avgBuyPrice: Number((totalCost / newShares).toFixed(2)),
          marketPrice: Number(price.toFixed(2)),
        }
      : a,
  );
}
