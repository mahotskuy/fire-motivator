export const CURRENCIES = ["USD", "EUR", "UAH", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type ForeignCurrency = Exclude<Currency, "USD">;

export interface FxRate {
  rate: number; // units of the foreign currency per 1 USD
  date: string;
}

export type FxRates = Partial<Record<ForeignCurrency, FxRate>>;

export interface FxCache {
  rates: FxRates;
  fetchedAt: string;
}

export const FOREIGN_CURRENCIES: ForeignCurrency[] = ["EUR", "UAH", "GBP"];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function convertToUsd(amount: number, currency: Currency, rates: FxRates | null | undefined): number | null {
  if (currency === "USD") return amount;
  const entry = rates?.[currency];
  if (!entry || !(entry.rate > 0)) return null;
  return amount / entry.rate;
}

export function parseFrankfurterRates(json: unknown): FxRates | null {
  if (!Array.isArray(json)) return null;
  const rates: FxRates = {};
  for (const row of json) {
    if (!row || typeof row !== "object") continue;
    const { quote, rate, date } = row as Record<string, unknown>;
    if (typeof quote !== "string" || !FOREIGN_CURRENCIES.includes(quote as ForeignCurrency)) continue;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
    if (typeof date !== "string" || !date) return null;
    rates[quote as ForeignCurrency] = { rate, date };
  }
  return FOREIGN_CURRENCIES.every((c) => rates[c]) ? rates : null;
}
