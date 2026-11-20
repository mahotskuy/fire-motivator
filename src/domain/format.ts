export const usd = (n: number): string => Math.round(n).toLocaleString("en-US");

export const signed = (n: number): string => (n >= 0 ? "+" : "");

// Знак перед доларом: +$1,200 / −$1,200
export const signedUsd = (n: number): string => `${n < 0 ? "−" : "+"}$${usd(Math.abs(n))}`;

export const today = (): string => new Date().toISOString().split("T")[0];
