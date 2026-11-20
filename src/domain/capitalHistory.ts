import { getPlannedCapitalForToday, type FireRules } from "./calc";
import { isLegacySnapshot } from "./snapshots";
import type { Snapshot } from "./types";
import type { Wealth } from "./wealth";

// "wealth" — усі активи; "stocks" — лише акції (є і в старих знімках)
export type CapitalScope = "wealth" | "stocks";
export type CapitalPeriod = "3m" | "6m" | "1y" | "all";

export interface CapitalPoint {
  date: string;
  capital: number;
  // Власні гроші: собівартість акцій + інші активи за номіналом (готівка не має ринкового приросту)
  invested: number;
  live: boolean;
}

const PERIOD_MONTHS: Record<Exclude<CapitalPeriod, "all">, number> = { "3m": 3, "6m": 6, "1y": 12 };

function fromSnapshot(s: Snapshot, scope: CapitalScope): CapitalPoint | null {
  if (scope === "stocks") return { date: s.date, capital: s.totalMarketValue, invested: s.totalCostBasis, live: false };
  // Старий знімок не знає інших активів: змішати його з повними дало б фальшивий стрибок на графіку
  if (isLegacySnapshot(s)) return null;
  const generic = s.genericValue ?? 0;
  return { date: s.date, capital: s.combinedWealth ?? 0, invested: s.totalCostBasis + generic, live: false };
}

function fromWealth(w: Wealth, scope: CapitalScope, date: string): CapitalPoint | null {
  if (scope === "stocks") return { date, capital: w.stocks.totalMarketValue, invested: w.stocks.totalCostBasis, live: true };
  if (w.combinedWealth === null || w.genericValue === null) return null;
  return { date, capital: w.combinedWealth, invested: w.stocks.totalCostBasis + w.genericValue, live: true };
}

function cutoffDate(today: string, period: CapitalPeriod): string | null {
  if (period === "all") return null;
  const [y, m, d] = today.split("-").map(Number);
  const cut = new Date(Date.UTC(y, m - 1 - PERIOD_MONTHS[period], d));
  return cut.toISOString().slice(0, 10);
}

// З кількох знімків за день береться найпізніший
function latestPerDay(snapshots: Snapshot[]): Snapshot[] {
  const latest = new Map<string, Snapshot>();
  for (const s of snapshots) {
    const prev = latest.get(s.date);
    if (!prev || s.timestamp > prev.timestamp) latest.set(s.date, s);
  }
  return [...latest.values()];
}

// Поточний стан як остання точка «зараз» замінює знімок за сьогодні; далі — фільтр періоду і сортування
function finish<P extends { date: string }>(points: P[], live: P | null, period: CapitalPeriod, today: string): P[] {
  const byDate = new Map(points.map((p) => [p.date, p]));
  if (live) byDate.set(today, live);
  const cut = cutoffDate(today, period);
  return [...byDate.values()].filter((p) => !cut || p.date >= cut).sort((a, b) => a.date.localeCompare(b.date));
}

/** Точки графіка капіталу: по одній на день плюс поточний стан як остання точка «зараз». */
export function buildCapitalHistory(
  snapshots: Snapshot[],
  current: Wealth | null,
  scope: CapitalScope,
  period: CapitalPeriod,
  today: string,
): CapitalPoint[] {
  const points = latestPerDay(snapshots)
    .map((s) => fromSnapshot(s, scope))
    .filter((p): p is CapitalPoint => p !== null);
  return finish(points, current ? fromWealth(current, scope, today) : null, period, today);
}

export interface PlanPoint {
  date: string;
  // Капітал, прив'язаний до цілі FIRE — те саме, з чим порівнює план у шапці
  capital: number;
  plan: number;
  live: boolean;
}

/** FIRE-капітал проти плану на кожну дату знімка. Старі знімки без fireValue пропускаються. */
export function buildPlanHistory(
  snapshots: Snapshot[],
  current: Wealth | null,
  rules: FireRules,
  period: CapitalPeriod,
  today: string,
): PlanPoint[] {
  const planAt = (date: string) => getPlannedCapitalForToday(rules, new Date(`${date}T12:00:00`));
  const points = latestPerDay(snapshots)
    .filter((s) => s.fireValue !== undefined)
    .map((s) => ({ date: s.date, capital: s.fireValue!, plan: planAt(s.date), live: false }));
  const live =
    current && current.fireGenericValue !== null
      ? { date: today, capital: current.fireStocks.totalMarketValue + current.fireGenericValue, plan: planAt(today), live: true }
      : null;
  return finish(points, live, period, today);
}
