import { describe, expect, it } from "vitest";
import { canEditGoal, createFireGoal } from "./goals";
import type { Goal } from "./types";

const vacation: Goal = { id: "g-vacation", name: "Vacation", targetAmount: 1000, targetDate: "2027-08-01" };

describe("canEditGoal", () => {
  it("canEditGoal_UserGoal_ReturnsTrue", () => {
    expect(canEditGoal(vacation)).toBe(true);
  });

  it("canEditGoal_FireGoal_ReturnsFalse", () => {
    expect(canEditGoal(createFireGoal())).toBe(false);
  });
});
