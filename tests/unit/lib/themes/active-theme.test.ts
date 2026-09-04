import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_NAME } from "@/lib/themes/manifest.generated";

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

import {
  APPEARANCE_SETTINGS_CATEGORY,
  APPEARANCE_THEME_SETTING_KEY,
  getActiveTheme,
} from "@/lib/themes/active-theme";

/**
 * Unit coverage of getActiveTheme()'s three-tier fallback (D1 -> env ->
 * manifest default) and the telemetry-only-on-unknown rule (RESEARCH
 * Pitfall 6). "volt-dark" is used as the known manifest key throughout
 * because it is the one theme file guaranteed to be shipped at this point
 * in Phase 6 (06-03 adds more presets later).
 */
describe("getActiveTheme()", () => {
  beforeEach(() => {
    mocks.getSettings.mockReset();
    mocks.recordTelemetry.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports the expected setting category and key constants", () => {
    expect(APPEARANCE_SETTINGS_CATEGORY).toBe("appearance");
    expect(APPEARANCE_THEME_SETTING_KEY).toBe("appearance.theme");
  });

  it("returns the manifest default when no row exists and no env default is set", async () => {
    mocks.getSettings.mockResolvedValue({});

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.getSettings).toHaveBeenCalledWith(APPEARANCE_SETTINGS_CATEGORY);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns the env default when no row exists and the env default is itself a manifest key", async () => {
    mocks.getSettings.mockResolvedValue({});
    vi.stubEnv("NEXT_PUBLIC_THEME_DEFAULT", "volt-dark");

    const result = await getActiveTheme();

    expect(result).toBe("volt-dark");
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("silently falls back to the manifest default when the env default is not a manifest key", async () => {
    mocks.getSettings.mockResolvedValue({});
    vi.stubEnv("NEXT_PUBLIC_THEME_DEFAULT", "not-a-real-theme");

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats an empty string the same as an absent row: falls back silently", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "" });

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only string the same as an absent row: falls back silently", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "   " });

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats a null value the same as an absent row: falls back silently", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: null });

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns a stored value that matches a manifest key unchanged", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "volt-dark" });

    const result = await getActiveTheme();

    expect(result).toBe("volt-dark");
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace around a matching manifest key and returns the matched key", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "  volt-dark  " });

    const result = await getActiveTheme();

    expect(result).toBe("volt-dark");
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("treats a case-mismatched value as unknown (matching is case-sensitive), falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "Volt-Dark" });

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("treats a name absent from the manifest as unknown, falls back, and emits exactly once with no field carrying the stored string", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "not-a-real-theme" });

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
    const [event, fields] = mocks.recordTelemetry.mock.calls[0] as [string, unknown];
    expect(event).toBe("theme.unknown_selection");
    expect(JSON.stringify(fields ?? {})).not.toContain("not-a-real-theme");
  });

  it("treats a non-string stored value (number) as unknown, falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: 42 });

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("treats a non-string stored value (object) as unknown, falls back, and emits exactly once", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: { nested: true } });

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
  });

  it("resolves to a valid manifest key rather than propagating a settings-read rejection", async () => {
    mocks.getSettings.mockRejectedValue(new Error("D1 unavailable"));

    const result = await getActiveTheme();

    expect(result).toBe(DEFAULT_THEME_NAME);
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns the value stored at call time across two sequential calls with different stored values (no memoisation)", async () => {
    mocks.getSettings.mockResolvedValueOnce({ [APPEARANCE_THEME_SETTING_KEY]: "volt-dark" });
    const first = await getActiveTheme();

    mocks.getSettings.mockResolvedValueOnce({});
    const second = await getActiveTheme();

    expect(first).toBe("volt-dark");
    expect(second).toBe(DEFAULT_THEME_NAME);
    expect(mocks.getSettings).toHaveBeenCalledTimes(2);
  });
});
