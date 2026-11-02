import { isCurrency, type Currency } from "./currency";
import type { GenericAsset, Goal } from "./types";

export interface GenericAssetInput {
  name: string;
  currency: Currency;
  amount: number;
  goalId: string;
}

export type CreateResult = { ok: true; asset: GenericAsset } | { ok: false; error: string };

export function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= 0;
}

export function createGenericAsset(input: GenericAssetInput, goals: Goal[], now: Date = new Date()): CreateResult {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "name" };
  if (!isCurrency(input.currency)) return { ok: false, error: "currency" };
  if (!isValidAmount(input.amount)) return { ok: false, error: "amount" };
  if (!goals.some((g) => g.id === input.goalId)) return { ok: false, error: "goal" };
  const stamp = now.toISOString();
  return {
    ok: true,
    asset: { id: newId("asset"), name, currency: input.currency, amount: input.amount, goalId: input.goalId, createdAt: stamp, updatedAt: stamp },
  };
}

export function updateGenericAsset(
  list: GenericAsset[],
  id: string,
  patch: Partial<GenericAssetInput>,
  goals: Goal[],
  now: Date = new Date(),
): GenericAsset[] {
  return list.map((asset) => {
    if (asset.id !== id) return asset;
    const next = { ...asset };
    if (patch.name !== undefined && patch.name.trim()) next.name = patch.name.trim();
    if (patch.currency !== undefined && isCurrency(patch.currency)) next.currency = patch.currency;
    if (patch.amount !== undefined && isValidAmount(patch.amount)) next.amount = patch.amount;
    if (patch.goalId !== undefined && goals.some((g) => g.id === patch.goalId)) next.goalId = patch.goalId;
    const changed =
      next.name !== asset.name || next.currency !== asset.currency || next.amount !== asset.amount || next.goalId !== asset.goalId;
    return changed ? { ...next, updatedAt: now.toISOString() } : asset;
  });
}

export function removeGenericAsset(list: GenericAsset[], id: string): GenericAsset[] {
  return list.filter((a) => a.id !== id);
}
