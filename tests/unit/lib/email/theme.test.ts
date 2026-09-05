import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_NAME } from "@/lib/themes/manifest.generated";
import { getThemeTokens } from "@/lib/themes/tokens";
import { APPEARANCE_THEME_SETTING_KEY } from "@/lib/themes/active-theme";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

vi.mock("@/lib/utils/settings", () => ({
  getSettings: mocks.getSettings,
}));

import { resolveEmailTheme } from "@/lib/email/theme";

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
