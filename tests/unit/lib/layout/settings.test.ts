import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYOUTS } from "@/lib/layout/variants";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  recordTelemetry: vi.fn(),
}));

vi.mock("@/lib/utils/settings", () => ({
  getSettings: mocks.getSettings,
}));

vi.mock("@/lib/observability/telemetry", () => ({
  recordTelemetry: mocks.recordTelemetry,
}));

import { LAYOUT_SETTING_KEYS, getLayoutSettings } from "@/lib/layout/settings";

/**
 * Unit coverage of getLayoutSettings()'s per-switch fallback (absent, empty,
 * unknown, valid), mirroring tests/unit/lib/themes/active-theme.test.ts's
 * exact structure and its telemetry-only-on-unknown rule.
 */
describe("getLayoutSettings()", () => {
  beforeEach(() => {
    mocks.getSettings.mockReset();
    mocks.recordTelemetry.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports the expected three setting keys", () => {
    expect(LAYOUT_SETTING_KEYS).toEqual({
      categoryLayout: "appearance.category_layout",
      homeHero: "appearance.home_hero",
      productGallery: "appearance.product_gallery",
    });
  });

  it("returns the three defaults when no appearance rows exist at all", async () => {
    mocks.getSettings.mockResolvedValue({});

    const result = await getLayoutSettings();

    expect(result).toEqual(DEFAULT_LAYOUTS);
    expect(mocks.getSettings).toHaveBeenCalledWith("appearance");
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns the stored value for one switch and defaults for the other two, with no telemetry", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "list",
    });

    const result = await getLayoutSettings();

    expect(result).toEqual({
      categoryLayout: "list",
      homeHero: DEFAULT_LAYOUTS.homeHero,
      productGallery: DEFAULT_LAYOUTS.productGallery,
    });
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace around a valid member and returns it, with no telemetry", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "  grid-2  ",
    });

    const result = await getLayoutSettings();

    expect(result.categoryLayout).toBe("grid-2");
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats an empty string the same as absent: falls back silently", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.homeHero]: "",
    });

    const result = await getLayoutSettings();

    expect(result.homeHero).toBe(DEFAULT_LAYOUTS.homeHero);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only string the same as absent: falls back silently", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.homeHero]: "   ",
    });

    const result = await getLayoutSettings();

    expect(result.homeHero).toBe(DEFAULT_LAYOUTS.homeHero);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats an explicit null the same as absent: falls back silently", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.productGallery]: null,
    });

    const result = await getLayoutSettings();

    expect(result.productGallery).toBe(DEFAULT_LAYOUTS.productGallery);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats a case-mismatched value as unknown, falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "Grid-3",
    });

    const result = await getLayoutSettings();

    expect(result.categoryLayout).toBe(DEFAULT_LAYOUTS.categoryLayout);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "layout.unknown_selection",
      { outcome: "invalid" },
    );
  });

  it("treats a plausible-looking but unshipped name as unknown, falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.homeHero]: "carousel",
    });

    const result = await getLayoutSettings();

    expect(result.homeHero).toBe(DEFAULT_LAYOUTS.homeHero);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("treats an object-prototype member name as unknown, falls back to a string enum member, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "hasOwnProperty",
    });

    const result = await getLayoutSettings();

    expect(result.categoryLayout).toBe(DEFAULT_LAYOUTS.categoryLayout);
    expect(typeof result.categoryLayout).toBe("string");
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("treats the constructor name as unknown, falls back to a string enum member, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "constructor",
    });

    const result = await getLayoutSettings();

    expect(result.categoryLayout).toBe(DEFAULT_LAYOUTS.categoryLayout);
    expect(typeof result.categoryLayout).toBe("string");
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("treats a non-string stored value (number) as unknown, falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.productGallery]: 42,
    });

    const result = await getLayoutSettings();

    expect(result.productGallery).toBe(DEFAULT_LAYOUTS.productGallery);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("treats a non-string stored value (boolean) as unknown, falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.productGallery]: true,
    });

    const result = await getLayoutSettings();

    expect(result.productGallery).toBe(DEFAULT_LAYOUTS.productGallery);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("treats a non-string stored value (object) as unknown, falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.homeHero]: { nested: true },
    });

    const result = await getLayoutSettings();

    expect(result.homeHero).toBe(DEFAULT_LAYOUTS.homeHero);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("resolves three defaults and emits exactly three telemetry calls when all three switches are stored invalid", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "not-a-real-layout",
      [LAYOUT_SETTING_KEYS.homeHero]: "not-a-real-hero",
      [LAYOUT_SETTING_KEYS.productGallery]: "not-a-real-gallery",
    });

    const result = await getLayoutSettings();

    expect(result).toEqual(DEFAULT_LAYOUTS);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(3);
  });

  it("no telemetry assertion anywhere accepts an argument containing the stored value", async () => {
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "totally-bogus-value",
    });

    await getLayoutSettings();

    for (const call of mocks.recordTelemetry.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("totally-bogus-value");
    }
  });

  it("resolves to the three defaults rather than propagating a settings-read rejection", async () => {
    mocks.getSettings.mockRejectedValue(new Error("D1 unavailable"));

    const result = await getLayoutSettings();

    expect(result).toEqual(DEFAULT_LAYOUTS);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns the value stored at call time across two sequential calls with different stored values (no memoisation)", async () => {
    mocks.getSettings.mockResolvedValueOnce({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "list",
    });
    const first = await getLayoutSettings();

    mocks.getSettings.mockResolvedValueOnce({});
    const second = await getLayoutSettings();

    expect(first.categoryLayout).toBe("list");
    expect(second.categoryLayout).toBe(DEFAULT_LAYOUTS.categoryLayout);
    expect(mocks.getSettings).toHaveBeenCalledTimes(2);
  });

  it("never lets a value stored for one switch be returned by another switch, even when the string is a member of both enums", async () => {
    // "left" is a valid productGallery member but not a categoryLayout member;
    // storing it under the category key must still fall back to the category
    // default and emit telemetry, not silently resolve.
    mocks.getSettings.mockResolvedValue({
      [LAYOUT_SETTING_KEYS.categoryLayout]: "left",
      [LAYOUT_SETTING_KEYS.homeHero]: "grid-3",
    });

    const result = await getLayoutSettings();

    expect(result.categoryLayout).toBe(DEFAULT_LAYOUTS.categoryLayout);
    expect(result.homeHero).toBe(DEFAULT_LAYOUTS.homeHero);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(2);
  });
});
