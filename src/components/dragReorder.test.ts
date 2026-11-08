import { describe, expect, it } from "vitest";
import { clampOffset, getDropIndex, getShift, type Slot } from "./dragReorder";

// Три рядки по 100px із проміжком 12px
const slots: Slot[] = [
  { top: 0, height: 100 },
  { top: 112, height: 100 },
  { top: 224, height: 100 },
];

describe("getDropIndex", () => {
  it("noMovement_StaysAtOriginalIndex", () => {
    expect(getDropIndex(slots, 1, 0)).toBe(1);
  });

  it("draggedPastNextCenter_MovesDown", () => {
    expect(getDropIndex(slots, 0, 120)).toBe(1);
    expect(getDropIndex(slots, 0, 230)).toBe(2);
  });

  it("draggedAboveFirstCenter_MovesUp", () => {
    expect(getDropIndex(slots, 2, -120)).toBe(1);
    expect(getDropIndex(slots, 2, -230)).toBe(0);
  });
});

describe("getShift", () => {
  it("draggingDown_ShiftsPassedRowsUp", () => {
    expect(getShift(slots, 0, 2, 1)).toBe(-112);
    expect(getShift(slots, 0, 2, 2)).toBe(-112);
  });

  it("draggingUp_ShiftsPassedRowsDown", () => {
    expect(getShift(slots, 2, 0, 0)).toBe(112);
    expect(getShift(slots, 2, 0, 1)).toBe(112);
  });

  it("rowsOutsideRange_AndDraggedRow_DoNotShift", () => {
    expect(getShift(slots, 0, 1, 2)).toBe(0);
    expect(getShift(slots, 1, 2, 1)).toBe(0);
    expect(getShift(slots, 1, 1, 0)).toBe(0);
  });
});

describe("clampOffset", () => {
  it("keepsDraggedRowInsideList", () => {
    expect(clampOffset(slots, 1, -500)).toBe(-112);
    expect(clampOffset(slots, 1, 500)).toBe(112);
    expect(clampOffset(slots, 1, 40)).toBe(40);
  });
});
