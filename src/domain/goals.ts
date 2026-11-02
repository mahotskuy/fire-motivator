import type { Asset, GenericAsset, Goal, Transaction } from "./types";

export const FIRE_GOAL_ID = "fire";

export function createFireGoal(): Goal {
  return { id: FIRE_GOAL_ID, name: "🔥 FIRE", targetAmount: 0, targetDate: "", builtIn: true };
}

export type DeleteGoalCheck = { ok: true } | { ok: false; reason: "builtin" | "linked"; count: number };

export function canDeleteGoal(goalId: string, assets: Asset[], genericAssets: GenericAsset[], goals: Goal[]): DeleteGoalCheck {
  if (goalId === FIRE_GOAL_ID || goals.find((g) => g.id === goalId)?.builtIn) return { ok: false, reason: "builtin", count: 0 };
  const count = assets.filter((a) => a.goalId === goalId).length + genericAssets.filter((a) => a.goalId === goalId).length;
  return count > 0 ? { ok: false, reason: "linked", count } : { ok: true };
}

export function isDeletedGoalTransaction(t: Transaction, goals: Goal[]): boolean {
  return !t.goalId || !goals.some((g) => g.id === t.goalId);
}
