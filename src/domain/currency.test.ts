import { describe, expect, it } from "vitest";
import { convertToUsd, parseFrankfurterRates } from "./currency";

const rates = {
  EUR: { rate: 0.9, date: "2026-11-02" },
  UAH: { rate: 40, date: "2026-11-01" },
  GBP: { rate: 0.8, date: "2026-11-02" },
};

describe("convertToUsd", () => {
  it("convertToUsd_UahAtFortyPerUsd_ReturnsHundredForFourThousand", () => {
    expect(convertToUsd(4000, "UAH", rates)).toBeCloseTo(100, 10);
  });

  it("convertToUsd_UsdWithoutAnyRates_ReturnsAmountUnchanged", () => {
    expect(convertToUsd(123.45, "USD", null)).toBe(123.45);
  });

  it("convertToUsd_EurRateMissing_ReturnsNullInsteadOfZero", () => {
    expect(convertToUsd(100, "EUR", null)).toBeNull();
    expect(convertToUsd(100, "EUR", { UAH: rates.UAH })).toBeNull();
  });

  it("convertToUsd_ZeroAmountWithRate_ReturnsZero", () => {
    expect(convertToUsd(0, "GBP", rates)).toBe(0);
  });
});

describe("parseFrankfurterRates", () => {
  it("parseFrankfurterRates_RowsWithDifferentDates_KeepsPerCurrencyDate", () => {
    const parsed = parseFrankfurterRates([
      { date: "2026-11-02", base: "USD", quote: "EUR", rate: 0.89478 },
      { date: "2026-11-02", base: "USD", quote: "GBP", rate: 0.74777 },
      { date: "2026-11-01", base: "USD", quote: "UAH", rate: 45.427 },
    ]);
    expect(parsed).toEqual({
      EUR: { rate: 0.89478, date: "2026-11-02" },
      GBP: { rate: 0.74777, date: "2026-11-02" },
      UAH: { rate: 45.427, date: "2026-11-01" },
    });
  });

  it("parseFrankfurterRates_MissingCurrency_ReturnsNull", () => {
    expect(parseFrankfurterRates([{ date: "2026-11-02", base: "USD", quote: "EUR", rate: 0.9 }])).toBeNull();
  });

  it("parseFrankfurterRates_NonPositiveOrMalformedRate_ReturnsNull", () => {
    const row = (quote: string, rate: unknown) => ({ date: "2026-11-02", base: "USD", quote, rate });
    expect(parseFrankfurterRates([row("EUR", 0.9), row("GBP", 0.8), row("UAH", 0)])).toBeNull();
    expect(parseFrankfurterRates([row("EUR", 0.9), row("GBP", "x"), row("UAH", 40)])).toBeNull();
    expect(parseFrankfurterRates({ message: "boom" })).toBeNull();
  });
});
