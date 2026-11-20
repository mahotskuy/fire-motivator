import { describe, expect, it } from "vitest";
import { buildAxis } from "./chartScale";

describe("buildAxis", () => {
  it("buildAxis_ZeroMode_StartsAtZero", () => {
    const axis = buildAxis([80_000, 101_000], "zero");
    expect(axis.min).toBe(0);
    expect(axis.max).toBeGreaterThanOrEqual(101_000);
  });

  it("buildAxis_AutoMode_ZoomsToDataRangeSoSmallDepositIsVisible", () => {
    const axis = buildAxis([100_000, 101_000], "auto");
    expect(axis.min).toBeGreaterThan(99_000);
    expect(axis.max).toBeLessThan(102_000);
    // крок $1k займає помітну частину висоти
    expect(1_000 / (axis.max - axis.min)).toBeGreaterThan(0.4);
  });

  it("buildAxis_AutoMode_CoversAllValuesWithRoundTicks", () => {
    const axis = buildAxis([83_412, 97_655, 104_120], "auto");
    expect(axis.min).toBeLessThanOrEqual(83_412);
    expect(axis.max).toBeGreaterThanOrEqual(104_120);
    expect(axis.ticks[0]).toBe(axis.min);
    expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.max);
    const step = axis.ticks[1] - axis.ticks[0];
    expect(axis.ticks.every((t) => t % step === 0)).toBe(true);
  });

  it("buildAxis_AutoModeFlatData_AddsSpaceAroundTheLine", () => {
    const axis = buildAxis([50_000, 50_000], "auto");
    expect(axis.min).toBeLessThan(50_000);
    expect(axis.max).toBeGreaterThan(50_000);
  });

  it("buildAxis_NoData_ReturnsUsableAxis", () => {
    expect(buildAxis([], "auto")).toMatchObject({ min: 0 });
  });
});
