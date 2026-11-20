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

/**
 * Точки графіка капіталу: по одній на день (з кількох знімків за день береться найпізніший),
 * плюс поточний стан як остання точка «зараз», що замінює знімок за сьогодні.
 */
export function buildCapitalHistory(
  snapshots: Snapshot[],
  current: Wealth | null,
  scope: CapitalScope,
  period: CapitalPeriod,
  today: string,
): CapitalPoint[] {
  const latest = new Map<string, Snapshot>();
  for (const s of snapshots) {
    const prev = latest.get(s.date);
    if (!prev || s.timestamp > prev.timestamp) latest.set(s.date, s);
  }
  const byDate = new Map<string, CapitalPoint>();
  for (const s of latest.values()) {
    const p = fromSnapshot(s, scope);
    if (p) byDate.set(p.date, p);
  }
  const live = current ? fromWealth(current, scope, today) : null;
  if (live) byDate.set(today, live);

  const cut = cutoffDate(today, period);
  return [...byDate.values()].filter((p) => !cut || p.date >= cut).sort((a, b) => a.date.localeCompare(b.date));
}
