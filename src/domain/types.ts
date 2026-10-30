export interface Settings {
  targetMonthlyPassive: number;
  mandatoryMonthlySave: number;
  expectedGrowthRate: number;
  expectedDividendYield: number;
  currentAge: number;
  planStartDate: string;
}

export interface Asset {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
  marketPrice: number;
}

export interface Snapshot {
  id: string;
  date: string;
  timestamp: string;
  totalMarketValue: number;
  totalCostBasis: number;
  positionsSummary: string;
  note: string;
}

export interface Goal {
  name: string;
  targetAmount: number;
  targetDate: string;
}

export interface Transaction {
  date: string;
  goalName: string;
  amount: number;
  note: string;
}

export interface AppState {
  settings: Settings;
  assets: Asset[];
  snapshots: Snapshot[];
  goals: Goal[];
  transactions: Transaction[];
}
