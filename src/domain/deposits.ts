import {
  buyOrUpdateAsset,
  calculateFractionalMonthsToTarget,
  type FireRules,
} from "./calc";
import { convertToUsd, type Currency, type FxCache } from "./currency";
import { FIRE_GOAL_ID } from "./goals";
import { levelAt, type Level } from "./levels";
import type { Asset, Deposit, DepositItem, GenericAsset } from "./types";
import { computeWealth } from "./wealth";

const DAYS_PER_MONTH = 30.4375;

export type DepositLine =
  | { kind: "stock"; ticker: string; shares: number; price: number }
  | { kind: "generic"; assetId: string; amount: number };

export interface DepositContext {
  assets: Asset[];
  genericAssets: GenericAsset[];
  fx: FxCache | null;
}

export type PlanDepositResult =
  | { ok: true; assets: Asset[]; genericAssets: GenericAsset[]; deposit: Deposit }
  | { ok: false; reason: "empty" | "rates"; missingCurrencies: Currency[] };

const cents = (n: number) => Number(n.toFixed(2));

// Локальна дата (не UTC): внесок о 01:00 першого січня належить новому року
export function localDateString(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

// Приймає кому як десятковий роздільник; усе нечислове і від'ємне дає 0
export function parseAmount(raw: string): number {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getYearInvested(deposits: Deposit[], priorInvested: Record<string, number>, year: number): number {
  const prefix = `${year}-`;
  const fromDeposits = deposits.filter((d) => d.date.startsWith(prefix)).reduce((sum, d) => sum + d.fireUsd, 0);
  return (priorInvested[String(year)] ?? 0) + fromDeposits;
}

// Лише обчислює результат внеску і нові списки активів: нічого не змінює. Той самий результат показує і прев'ю перед збереженням.
export function planDeposit(
  ctx: DepositContext,
  rules: FireRules,
  levels: Level[],
  lines: DepositLine[],
  now: Date = new Date(),
): PlanDepositResult {
  const valid = lines.filter((l) =>
    l.kind === "stock" ? l.shares > 0 && l.price > 0 : l.amount > 0,
  );
  if (!valid.length) return { ok: false, reason: "empty", missingCurrencies: [] };

  const before = computeWealth(ctx);
  if (before.fireGenericValue === null) return { ok: false, reason: "rates", missingCurrencies: before.missingCurrencies };

  let assets = ctx.assets;
  let genericAssets = ctx.genericAssets;
  const items: DepositItem[] = [];
  const timestamp = now.toISOString();

  for (const line of valid) {
    if (line.kind === "stock") {
      const existing = assets.find((a) => a.ticker === line.ticker);
      assets = buyOrUpdateAsset(assets, line.ticker, line.shares, line.price, existing?.goalId ?? FIRE_GOAL_ID);
      items.push({
        kind: "stock",
        ticker: line.ticker,
        shares: line.shares,
        price: line.price,
        usd: cents(line.shares * line.price),
        fire: (existing?.goalId ?? FIRE_GOAL_ID) === FIRE_GOAL_ID,
      });
    } else {
      const target = genericAssets.find((a) => a.id === line.assetId);
      if (!target) continue;
      const usd = convertToUsd(line.amount, target.currency, ctx.fx?.rates);
      if (usd === null) return { ok: false, reason: "rates", missingCurrencies: [target.currency] };
      genericAssets = genericAssets.map((a) =>
        a.id === target.id ? { ...a, amount: Number((a.amount + line.amount).toFixed(2)), updatedAt: timestamp } : a,
      );
      items.push({
        kind: "generic",
        assetId: target.id,
        name: target.name,
        currency: target.currency,
        amount: line.amount,
        usd: cents(usd),
        fire: target.goalId === FIRE_GOAL_ID,
      });
    }
  }
  if (!items.length) return { ok: false, reason: "empty", missingCurrencies: [] };

  const after = computeWealth({ assets, genericAssets, fx: ctx.fx });
  const capitalBefore = before.fireStocks.totalMarketValue + before.fireGenericValue;
  // Рахуємо від ринкової вартості після внеску, а не «до + сума»: нова ціна покупки оновлює ціну позиції
  const capitalAfter = after.fireStocks.totalMarketValue + (after.fireGenericValue ?? before.fireGenericValue);

  const monthsBefore = calculateFractionalMonthsToTarget(
    before.fireStocks.totalMarketValue,
    rules.targetFireCapital,
    rules.mandatoryMonthlySave,
    rules.totalAnnualReturn,
    before.fireGenericValue,
  );
  const monthsAfter = calculateFractionalMonthsToTarget(
    after.fireStocks.totalMarketValue,
    rules.targetFireCapital,
    rules.mandatoryMonthlySave,
    rules.totalAnnualReturn,
    after.fireGenericValue ?? before.fireGenericValue,
  );

  const totalUsd = items.reduce((s, i) => s + i.usd, 0);
  const fireUsd = items.reduce((s, i) => s + (i.fire ? i.usd : 0), 0);
  // Лише акції ростуть і платять дивіденди: готівка та інші активи в моделі статичні
  const fireStockUsd = items.reduce((s, i) => s + (i.kind === "stock" && i.fire ? i.usd : 0), 0);
  const dayCost = (rules.targetMonthlyPassive * 12) / 365;

  return {
    ok: true,
    assets,
    genericAssets,
    deposit: {
      id: `dep-${now.getTime()}`,
      date: localDateString(now),
      timestamp,
      items,
      totalUsd: cents(totalUsd),
      fireUsd: cents(fireUsd),
      daysCloser: Math.max(0, (monthsBefore - monthsAfter) * DAYS_PER_MONTH),
      projectedUsd: cents(fireStockUsd * Math.pow(1 + rules.totalAnnualReturn / 12, monthsAfter)),
      monthlyDividends: cents((fireStockUsd * rules.divDecimal) / 12),
      freedomDays: fireUsd / dayCost,
      levelBefore: levelAt(levels, capitalBefore),
      levelAfter: levelAt(levels, capitalAfter),
    },
  };
}
