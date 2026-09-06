import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers WR-02 from the 06-REVIEW: getThemeTokens() must fail loudly with a
 * clear error, not an opaque `Cannot read properties of undefined`, if
 * THEME_MANIFEST is ever empty. `build-themes.mjs` refuses to generate an
 * empty manifest, so this is a defense-in-depth path (hand-edited generated
 * file, or a build step running before codegen) — but getThemeTokens() is
 * called unconditionally in app/layout.tsx's RootLayout on every request,
 * so it needs its own guard, mirroring getActiveTheme()'s "never throws"
 * contract on the always-safe side and this function's "fail closed, loud"
 * contract on the guaranteed-impossible side.
 */
const mocks = vi.hoisted(() => ({
  THEME_MANIFEST: [
    { name: "volt-dark", tokens: { primary: "#f60" } },
    { name: "luxe", tokens: { primary: "#c49f4d" } },
  ] as Array<{ name: string; tokens: Record<string, string> }>,
  DEFAULT_THEME_NAME: "volt-dark",
}));

vi.mock("@/lib/themes/manifest.generated", () => ({
  get THEME_MANIFEST() {
    return mocks.THEME_MANIFEST;
  },
  get DEFAULT_THEME_NAME() {
    return mocks.DEFAULT_THEME_NAME;
  },
}));

import { getThemeTokens } from "@/lib/themes/tokens";

describe("getThemeTokens()", () => {
  beforeEach(() => {
    mocks.THEME_MANIFEST = [
      { name: "volt-dark", tokens: { primary: "#f60" } },
      { name: "luxe", tokens: { primary: "#c49f4d" } },
    ];
    mocks.DEFAULT_THEME_NAME = "volt-dark";
  });

  it("returns the named theme's tokens when the name is a manifest key", () => {
    expect(getThemeTokens("luxe")).toEqual({ primary: "#c49f4d" });
  });

  it("falls back to the manifest default when the name is absent or unknown", () => {
    expect(getThemeTokens()).toEqual({ primary: "#f60" });
    expect(getThemeTokens("does-not-exist")).toEqual({ primary: "#f60" });
  });

  it("falls back to the first manifest entry when both the name and the default miss", () => {
    mocks.DEFAULT_THEME_NAME = "missing-default";
    expect(getThemeTokens("also-missing")).toEqual({ primary: "#f60" });
  });

  it("throws a clear, actionable error instead of an opaque TypeError when THEME_MANIFEST is empty", () => {
    mocks.THEME_MANIFEST = [];
    expect(() => getThemeTokens()).toThrow(/THEME_MANIFEST is empty/);
    expect(() => getThemeTokens("anything")).toThrow(/npm run build:themes/);
  });
});
