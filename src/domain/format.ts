export const usd = (n: number): string => Math.round(n).toLocaleString("en-US");

export const signed = (n: number): string => (n >= 0 ? "+" : "");

export const today = (): string => new Date().toISOString().split("T")[0];
