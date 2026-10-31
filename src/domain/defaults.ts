import type { Asset, AppState } from "./types";

export interface BillLevel {
  id: number;
  name: string;
  icon: string;
  baseCost: number;
}

// Приклад портфеля для першого запуску; реальні дані вводяться в браузері
const SAMPLE_ASSETS: Asset[] = [
  { ticker: "VOO", shares: 10, avgBuyPrice: 600.0, marketPrice: 704.5 },
  { ticker: "VXUS", shares: 40, avgBuyPrice: 65.0, marketPrice: 74.8 },
  { ticker: "SCHD", shares: 30, avgBuyPrice: 80.0, marketPrice: 89.2 },
];

// Базова сума = $1,000/міс, масштабується пропорційно до цільового доходу
export const BILL_LEVELS: BillLevel[] = [
  { id: 1, name: "Мобільний, Інтернет та підписки", icon: "🌐", baseCost: 20 },
  { id: 2, name: "Комунальні платежі", icon: "⚡", baseCost: 80 },
  { id: 3, name: "Спортзал та догляд", icon: "🏋️", baseCost: 150 },
  { id: 4, name: "Базовий продуктовий кошик", icon: "🛒", baseCost: 350 },
  { id: 5, name: "Доставки, заклади та дозвілля", icon: "🍕", baseCost: 200 },
  { id: 6, name: "Подорожі, оновлення речей та резерв", icon: "✈️", baseCost: 200 },
];

export function createDefaultState(): AppState {
  return {
    settings: {
      targetMonthlyPassive: 1000,
      mandatoryMonthlySave: 500,
      expectedGrowthRate: 6,
      expectedDividendYield: 4,
      currentAge: 31,
      planStartDate: "2024-01-01",
    },
    assets: SAMPLE_ASSETS.map((a) => ({ ...a })),
    snapshots: [
      {
        id: "snap-sample",
        date: "2026-09-30",
        timestamp: "2026-09-30T18:00:00.000Z",
        totalMarketValue: 11000.0,
        totalCostBasis: 10200.0,
        positionsSummary: "VOO (10), VXUS (40), SCHD (30)",
        note: "Приклад снепшоту",
      },
    ],
    goals: [
      { name: "🛡️ Фінансова подушка", targetAmount: 3000, targetDate: "2027-06-30" },
      { name: "🏔️ Відпустка", targetAmount: 1000, targetDate: "2027-08-01" },
    ],
    transactions: [
      { date: "2026-09-05", goalName: "🛡️ Фінансова подушка", amount: 500, note: "Приклад" },
    ],
  };
}

export function normalizeState(parsed: unknown): AppState {
  const defaults = createDefaultState();
  if (!parsed || typeof parsed !== "object") return defaults;
  const p = parsed as Partial<Record<keyof AppState, unknown>>;
  const s = (p.settings ?? {}) as Record<string, unknown>;

  return {
    settings: {
      targetMonthlyPassive: Number(s.targetMonthlyPassive) || 1000,
      mandatoryMonthlySave: Number(s.mandatoryMonthlySave) || 500,
      expectedGrowthRate: Number(s.expectedGrowthRate ?? 6),
      expectedDividendYield: Number(s.expectedDividendYield ?? 4),
      currentAge: Number(s.currentAge) || 31,
      planStartDate: typeof s.planStartDate === "string" && s.planStartDate ? s.planStartDate : "2024-01-01",
    },
    assets: Array.isArray(p.assets) && p.assets.length > 0 ? (p.assets as AppState["assets"]) : defaults.assets,
    snapshots: Array.isArray(p.snapshots) ? (p.snapshots as AppState["snapshots"]) : defaults.snapshots,
    goals: Array.isArray(p.goals) ? (p.goals as AppState["goals"]) : defaults.goals,
    transactions: Array.isArray(p.transactions)
      ? (p.transactions as AppState["transactions"])
      : defaults.transactions,
  };
}
