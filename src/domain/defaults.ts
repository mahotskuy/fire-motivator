import { FOREIGN_CURRENCIES, isCurrency, type FxCache, type FxRates } from "./currency";
import { FIRE_GOAL_ID, createFireGoal } from "./goals";
import type { Asset, AppState, GenericAsset, Goal, Transaction } from "./types";

export interface BillLevel {
  id: number;
  name: string;
  icon: string;
  baseCost: number;
}

// Приклад портфеля для першого запуску; реальні дані вводяться в браузері
const SAMPLE_ASSETS: Asset[] = [
  { ticker: "VOO", shares: 10, avgBuyPrice: 600.0, marketPrice: 704.5, goalId: FIRE_GOAL_ID },
  { ticker: "VXUS", shares: 40, avgBuyPrice: 65.0, marketPrice: 74.8, goalId: FIRE_GOAL_ID },
  { ticker: "SCHD", shares: 30, avgBuyPrice: 80.0, marketPrice: 89.2, goalId: FIRE_GOAL_ID },
];

const SAMPLE_CUSHION_ID = "goal-cushion";

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
    genericAssets: [],
    fx: null,
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
      createFireGoal(),
      { id: SAMPLE_CUSHION_ID, name: "🛡️ Фінансова подушка", targetAmount: 3000, targetDate: "2027-06-30" },
      { id: "goal-vacation", name: "🏔️ Відпустка", targetAmount: 1000, targetDate: "2027-08-01" },
    ],
    transactions: [
      { date: "2026-09-05", goalName: "🛡️ Фінансова подушка", goalId: SAMPLE_CUSHION_ID, amount: 500, note: "Приклад" },
    ],
  };
}

// Детермінований id для цілей зі старих збережень, щоб повторне завантаження не змінювало зв'язки
function legacyGoalId(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) hash = ((hash * 33) ^ name.charCodeAt(i)) >>> 0;
  return `goal-${hash.toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function normalizeGoals(raw: unknown, fallback: Goal[]): Goal[] {
  const source = Array.isArray(raw) ? raw : fallback;
  const goals: Goal[] = [createFireGoal()];
  for (const item of source) {
    if (!isRecord(item) || typeof item.name !== "string" || !item.name) continue;
    if (item.builtIn === true || item.id === FIRE_GOAL_ID) continue;
    const id = typeof item.id === "string" && item.id ? item.id : legacyGoalId(item.name);
    if (goals.some((g) => g.id === id)) continue;
    goals.push({
      id,
      name: item.name,
      targetAmount: Number(item.targetAmount) || 0,
      targetDate: typeof item.targetDate === "string" ? item.targetDate : "",
    });
  }
  return goals;
}

function normalizeStocks(raw: unknown, goals: Goal[], fallback: Asset[]): Asset[] {
  const source = Array.isArray(raw) ? raw : fallback;
  const assets: Asset[] = [];
  for (const item of source) {
    if (!isRecord(item) || typeof item.ticker !== "string" || !item.ticker) continue;
    const goalId = typeof item.goalId === "string" && goals.some((g) => g.id === item.goalId) ? item.goalId : FIRE_GOAL_ID;
    assets.push({
      ticker: item.ticker,
      shares: Number(item.shares) || 0,
      avgBuyPrice: Number(item.avgBuyPrice) || 0,
      marketPrice: Number(item.marketPrice) || 0,
      goalId,
    });
  }
  return assets;
}

function normalizeGenericAssets(raw: unknown, goals: Goal[]): GenericAsset[] {
  if (!Array.isArray(raw)) return [];
  const list: GenericAsset[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id) continue;
    if (typeof item.name !== "string" || !item.name || !isCurrency(item.currency)) continue;
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const created = typeof item.createdAt === "string" && item.createdAt ? item.createdAt : new Date().toISOString();
    list.push({
      id: item.id,
      name: item.name,
      currency: item.currency,
      amount,
      goalId: typeof item.goalId === "string" && goals.some((g) => g.id === item.goalId) ? item.goalId : FIRE_GOAL_ID,
      createdAt: created,
      updatedAt: typeof item.updatedAt === "string" && item.updatedAt ? item.updatedAt : created,
    });
  }
  return list;
}

function normalizeTransactions(raw: unknown, goals: Goal[], fallback: Transaction[]): Transaction[] {
  const source = Array.isArray(raw) ? raw : fallback;
  const list: Transaction[] = [];
  for (const item of source) {
    if (!isRecord(item)) continue;
    const goalName = typeof item.goalName === "string" ? item.goalName : "";
    // Осиротілій історії завжди дається стійкий id-маркер: так видалена ціль не воскресає після перестворення і Firestore не отримує undefined
    const goalId =
      typeof item.goalId === "string" && item.goalId
        ? item.goalId
        : (goals.find((g) => !g.builtIn && g.name === goalName)?.id ?? `deleted-${legacyGoalId(goalName)}`);
    list.push({
      date: typeof item.date === "string" ? item.date : "",
      goalName,
      goalId,
      amount: Number(item.amount) || 0,
      note: typeof item.note === "string" ? item.note : "",
    });
  }
  return list;
}

function normalizeFx(raw: unknown): FxCache | null {
  if (!isRecord(raw) || !isRecord(raw.rates)) return null;
  const rates: FxRates = {};
  for (const currency of FOREIGN_CURRENCIES) {
    const entry = raw.rates[currency];
    if (!isRecord(entry)) continue;
    const rate = Number(entry.rate);
    if (rate > 0 && Number.isFinite(rate) && typeof entry.date === "string") rates[currency] = { rate, date: entry.date };
  }
  return Object.keys(rates).length ? { rates, fetchedAt: typeof raw.fetchedAt === "string" ? raw.fetchedAt : "" } : null;
}

export function normalizeState(parsed: unknown): AppState {
  const defaults = createDefaultState();
  if (!isRecord(parsed)) return defaults;
  const p = parsed;
  const s = (p.settings ?? {}) as Record<string, unknown>;
  const goals = normalizeGoals(p.goals, defaults.goals);

  return {
    settings: {
      targetMonthlyPassive: Number(s.targetMonthlyPassive) || 1000,
      mandatoryMonthlySave: Number(s.mandatoryMonthlySave) || 500,
      expectedGrowthRate: Number(s.expectedGrowthRate ?? 6),
      expectedDividendYield: Number(s.expectedDividendYield ?? 4),
      currentAge: Number(s.currentAge) || 31,
      planStartDate: typeof s.planStartDate === "string" && s.planStartDate ? s.planStartDate : "2024-01-01",
    },
    assets: normalizeStocks(p.assets, goals, defaults.assets),
    genericAssets: normalizeGenericAssets(p.genericAssets, goals),
    snapshots: Array.isArray(p.snapshots) ? (p.snapshots as AppState["snapshots"]) : defaults.snapshots,
    goals,
    transactions: normalizeTransactions(p.transactions, goals, defaults.transactions),
    fx: normalizeFx(p.fx),
  };
}

