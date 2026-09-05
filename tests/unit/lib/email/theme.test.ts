import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";
import { getThemeTokens } from "@/lib/themes/tokens";
import { APPEARANCE_THEME_SETTING_KEY } from "@/lib/themes/active-theme";

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

import { emailThemeForStagedPayload, resolveEmailTheme } from "@/lib/email/theme";

/**
 * Unit coverage of resolveEmailTheme()'s four D-01 behaviours: a stored
 * theme, an absent row, a throwing read, and the 23-token contract. Mocks
 * `@/lib/utils/settings` (not `@/lib/themes/active-theme`) so the real
 * `getActiveTheme()` -> `readAppearanceSettings()` chain runs, matching the
 * established pattern in `tests/unit/lib/themes/active-theme.test.ts`.
 */
describe("resolveEmailTheme()", () => {
  beforeEach(() => {
    mocks.getSettings.mockReset();
  });

  it("returns luxe's tokens when 'luxe' is stored", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "luxe" });

    const tokens = await resolveEmailTheme();

    expect(tokens).toEqual(getThemeTokens("luxe"));
    expect(tokens).not.toEqual(getThemeTokens(DEFAULT_THEME_NAME));
  });

  it("returns the manifest default's tokens when nothing is stored", async () => {
    mocks.getSettings.mockResolvedValue({});

    const tokens = await resolveEmailTheme();

    expect(tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
  });

  it("resolves to the manifest default and does not reject when the appearance read throws", async () => {
    mocks.getSettings.mockRejectedValue(new Error("D1 unreachable"));

    await expect(resolveEmailTheme()).resolves.toEqual(getThemeTokens(DEFAULT_THEME_NAME));
  });

  it("always returns exactly 23 token keys", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "luxe" });

    const tokens = await resolveEmailTheme();

    expect(Object.keys(tokens)).toHaveLength(23);
  });
});

/**
 * emailThemeForStagedPayload() is the trust boundary between a stored
 * `order_effects.payload` string (Plan 04, D-10) and a rendered inline
 * style (T-08.1-15). None of these cases touch D1 — the function is a pure
 * parse-and-lookup over the manifest.
 */
describe("emailThemeForStagedPayload()", () => {
  beforeEach(() => {
    mocks.recordTelemetry.mockReset();
  });

  it("returns the manifest default's tokens and emits no telemetry for a null payload", () => {
    const tokens = emailThemeForStagedPayload(null);

    expect(tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns a named manifest theme's tokens with no telemetry", () => {
    const tokens = emailThemeForStagedPayload(JSON.stringify({ themeName: "luxe" }));

    expect(tokens).toEqual(getThemeTokens("luxe"));
    expect(tokens).not.toEqual(getThemeTokens(DEFAULT_THEME_NAME));
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("falls back to the default and emits theme.unknown_selection exactly once for an unknown name, with no stored string in the event", () => {
    const unknownName = "not-a-real-theme-" + THEME_MANIFEST.length;
    expect(THEME_MANIFEST.some((theme) => theme.name === unknownName)).toBe(false);

    const tokens = emailThemeForStagedPayload(JSON.stringify({ themeName: unknownName }));

    expect(tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.recordTelemetry).toHaveBeenCalledWith("theme.unknown_selection", { outcome: "invalid" });
    const [, fields] = mocks.recordTelemetry.mock.calls[0];
    expect(JSON.stringify(fields)).not.toContain(unknownName);
  });

  it("returns the manifest default's tokens with no telemetry for unparseable JSON", () => {
    const tokens = emailThemeForStagedPayload("{not json");

    expect(tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns the manifest default's tokens with no telemetry for valid JSON that is not an object", () => {
    const tokens = emailThemeForStagedPayload(JSON.stringify(["luxe"]));

    expect(tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns the manifest default's tokens with no telemetry when themeName is not a string", () => {
    const tokens = emailThemeForStagedPayload(JSON.stringify({ themeName: 42 }));

    expect(tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });
});
