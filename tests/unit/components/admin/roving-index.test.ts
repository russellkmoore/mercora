import { describe, expect, it } from "vitest";
import { nextRovingIndex } from "@/components/admin/roving-index";
import { nextRovingIndex as themeGridNextRovingIndex } from "@/components/admin/ThemePresetGrid";
import { nextRovingIndex as layoutSwitchesNextRovingIndex } from "@/components/admin/LayoutSwitches";

/**
 * 07-REVIEW WR-02: LayoutSwitches previously carried a verbatim copy of
 * ThemePresetGrid's roving-tabindex math with no test guarding the two
 * implementations against drift. Both files now re-export this single
 * shared implementation, so this suite both exercises the shared function
 * directly and asserts both re-exports are the exact same function
 * reference — not just behaviorally identical copies.
 */
describe("nextRovingIndex() — shared roving-tabindex helper", () => {
  it("moves forward on ArrowRight/ArrowDown and backward on ArrowLeft/ArrowUp", () => {
    expect(nextRovingIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextRovingIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextRovingIndex(1, "ArrowLeft", 3)).toBe(0);
    expect(nextRovingIndex(1, "ArrowUp", 3)).toBe(0);
  });

  it("wraps forwards past the last index and backwards past the first", () => {
    expect(nextRovingIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextRovingIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(nextRovingIndex(1, "ArrowRight", 2)).toBe(0);
    expect(nextRovingIndex(0, "ArrowLeft", 2)).toBe(1);
  });

  it("ignores keys other than the four arrow keys as a backward move (matching the existing delta fallback)", () => {
    expect(nextRovingIndex(1, "Enter", 3)).toBe(0);
  });

  it("ThemePresetGrid and LayoutSwitches both re-export the exact same function reference — no drift is possible", () => {
    expect(themeGridNextRovingIndex).toBe(nextRovingIndex);
    expect(layoutSwitchesNextRovingIndex).toBe(nextRovingIndex);
    expect(themeGridNextRovingIndex).toBe(layoutSwitchesNextRovingIndex);
  });
});
