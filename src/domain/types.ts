export interface Settings {
  targetMonthlyPassive: number;
  mandatoryMonthlySave: number;
  expectedGrowthRate: number;
  expectedDividendYield: number;
  currentAge: number;
  planStartDate: string;
}

import type { Currency, FxCache, FxRates } from "./currency";

export interface Asset {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
  marketPrice: number;
  goalId: string;
}

export interface GenericAsset {
  id: string;
  name: string;
  currency: Currency;
  amount: number;
  goalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotStock {
  ticker: string;
  shares: number;
  value: number;
  goalId: string;
  goalName: string;
}

export interface SnapshotGenericAsset {
  id: string;
  name: string;
  currency: Currency;
  amount: number;
  usdValue: number;
  goalId: string;
  goalName: string;
}

// Fields below `totalCostBasis` exist only on complete snapshots; legacy ones hold stock data only.
export interface Snapshot {
  id: string;
  date: string;
  timestamp: string;
  totalMarketValue: number;
  totalCostBasis: number;
  positionsSummary: string;
  note: string;
  stocksValue?: number;
  genericValue?: number;
  combinedWealth?: number;
  fireValue?: number;
  stocks?: SnapshotStock[];
  genericAssets?: SnapshotGenericAsset[];
  fxRates?: FxRates;
  usedCachedRates?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  builtIn?: boolean;
}

export interface Transaction {
  date: string;
  goalName: string;
  goalId?: string;
  amount: number;
  note: string;
}

export interface AppState {
  settings: Settings;
  assets: Asset[];
  genericAssets: GenericAsset[];
  snapshots: Snapshot[];
  goals: Goal[];
  transactions: Transaction[];
  fx: FxCache | null;
  // Порядок рівнів покриття рахунків: id з BILL_LEVELS, перший заповнюється першим
  billLevelOrder: number[];
}
