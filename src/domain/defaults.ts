import type { Asset, AppState } from "./types";

export interface BillLevel {
  id: number;
  name: string;
  icon: string;
  baseCost: number;
}

// Точний пресет позицій зі скріншоту Interactive Brokers ($70,416.49)
export const IBKR_SCREENSHOT_ASSETS: Asset[] = [
  { ticker: "IVV", shares: 51, avgBuyPrice: 695.0, marketPrice: 768.0 },
  { ticker: "IXUS", shares: 158, avgBuyPrice: 84.5, marketPrice: 93.74 },
  { ticker: "VWO", shares: 192, avgBuyPrice: 51.2, marketPrice: 56.6 },
  { ticker: "VWOB", shares: 75, avgBuyPrice: 61.8, marketPrice: 64.07 },
  { ticker: "VWRA", shares: 4, avgBuyPrice: 176.0, marketPrice: 191.28 },
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
    assets: IBKR_SCREENSHOT_ASSETS.map((a) => ({ ...a })),
    snapshots: [
      {
        id: "snap-prev-month",
        date: "2026-09-29",
        timestamp: "2026-09-29T18:00:00.000Z",
        totalMarketValue: 68450.0,
        totalCostBasis: 63522.0,
        positionsSummary: "IVV (50), IXUS (155), VWO (192), VWOB (75), VWRA (4)",
        note: "Вересневий снепшот статків",
      },
    ],
    goals: [
      { name: "🛡️ Фінансова подушка", targetAmount: 6000, targetDate: "2026-12-31" },
      { name: "🏠 Оснащення дому", targetAmount: 4500, targetDate: "2027-06-01" },
      { name: "🏔️ Відпустка в горах", targetAmount: 1500, targetDate: "2027-02-15" },
    ],
    transactions: [
      { date: "2026-08-10", goalName: "🛡️ Фінансова подушка", amount: 6000, note: "Повністю закрито" },
      { date: "2026-09-05", goalName: "🏠 Оснащення дому", amount: 1800, note: "Меблі" },
      { date: "2026-10-05", goalName: "🏔️ Відпустка в горах", amount: 800, note: "Бронювання" },
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
