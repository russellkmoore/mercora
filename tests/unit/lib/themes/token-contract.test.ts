import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getThemeTokens } from "@/lib/themes/tokens";
import { DEFAULT_THEME_NAME } from "@/lib/themes/manifest.generated";
import { kebabToCamel } from "../../../../scripts/build-themes.mjs";

/**
 * Contract test: getThemeTokens() must never silently drift from the theme
 * files under themes/. This test reads every themes/*.css file itself
 * rather than restating its values a second time, so a hand-edited hex in
 * one place without the other fails here. Extended in Phase 6 (D-11) to
 * loop over every shipped theme, not just volt-dark.
 */

const THEMES_DIR = path.resolve(process.cwd(), "themes");
const TAILWIND_CONFIG_PATH = path.resolve(process.cwd(), "tailwind.config.ts");
const GENERATED_BARREL_FILENAME = "index.generated.css";

const EXPECTED_KEYS = [
  "primary",
  "onPrimary",
  "surface",
  "surfaceElevated",
  "foreground",
  "mutedForeground",
  "border",
  "ring",
  "success",
  "warning",
  "danger",
  "info",
  "surfaceInverse",
  "surfaceInverseElevated",
  "onInverse",
  "mutedOnInverse",
  "borderInverse",
  "radiusSm",
  "radiusMd",
  "radiusLg",
  "radiusXl",
  "fontSans",
  "fontDisplay",
];

/** Parses `--store-*` custom-property declarations out of the theme CSS. */
function parseThemeCssProperties(cssSource: string): Record<string, string> {
  const props: Record<string, string> = {};
  const regex = /--store-([a-z-]+):\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cssSource)) !== null) {
    const camelKey = kebabToCamel(match[1]);
    props[camelKey] = match[2].trim();
  }
  return props;
}

const COLOUR_KEYS = [
  "primary",
  "onPrimary",
  "surface",
  "surfaceElevated",
  "foreground",
  "mutedForeground",
  "border",
  "ring",
  "success",
  "warning",
  "danger",
  "info",
  "surfaceInverse",
  "surfaceInverseElevated",
  "onInverse",
  "mutedOnInverse",
  "borderInverse",
] as const;

const RADIUS_KEYS = ["radiusSm", "radiusMd", "radiusLg", "radiusXl"] as const;

/** Every shipped theme file's stem, derived from the filesystem, in filename order. */
const themeStems = readdirSync(THEMES_DIR)
  .filter((f) => f.endsWith(".css") && f !== GENERATED_BARREL_FILENAME)
  .map((f) => path.basename(f, ".css"))
  .sort();

describe("getThemeTokens()", () => {
  it("finds at least one shipped theme file to loop over", () => {
    expect(themeStems.length).toBeGreaterThan(0);
  });

  for (const stem of themeStems) {
    describe(`theme: ${stem}`, () => {
      const cssSource = readFileSync(path.join(THEMES_DIR, `${stem}.css`), "utf-8");
      const cssProps = parseThemeCssProperties(cssSource);

      it("returns an object with exactly 23 own keys, matching the token map's camelCase names", () => {
        const tokens = getThemeTokens(stem);
        const keys = Object.keys(tokens);

        expect(keys).toHaveLength(23);
        expect(keys.sort()).toEqual([...EXPECTED_KEYS].sort());
      });

      it("keeps every one of the 17 colour tokens byte-identical (case-insensitive, trimmed) to its own theme file", () => {
        const tokens = getThemeTokens(stem) as unknown as Record<string, string>;

        expect(COLOUR_KEYS).toHaveLength(17);
        for (const key of COLOUR_KEYS) {
          const cssValue = cssProps[key];
          expect(cssValue, `themes/${stem}.css is missing --store-${key}`).toBeDefined();
          expect(tokens[key].trim().toLowerCase()).toBe(cssValue.trim().toLowerCase());
        }
      });

      it("keeps every one of the 4 radius tokens identical to its own theme file", () => {
        const tokens = getThemeTokens(stem) as unknown as Record<string, string>;

        expect(RADIUS_KEYS).toHaveLength(4);
        for (const key of RADIUS_KEYS) {
          const cssValue = cssProps[key];
          expect(cssValue, `themes/${stem}.css is missing --store-${key}`).toBeDefined();
          expect(tokens[key].trim().toLowerCase()).toBe(cssValue.trim().toLowerCase());
        }
      });
    });
  }

  it("reads no environment variable and imports nothing server-only (D1/Cloudflare/next)", () => {
    const tokensSource = readFileSync(path.resolve(process.cwd(), "lib/themes/tokens.ts"), "utf-8");
    const manifestSource = readFileSync(
      path.resolve(process.cwd(), "lib/themes/manifest.generated.ts"),
      "utf-8",
    );

    for (const moduleSource of [tokensSource, manifestSource]) {
      expect(moduleSource).not.toMatch(/process\.env/);
      expect(moduleSource).not.toMatch(/from\s+["'](.*\/)?d1[^"']*["']/i);
      expect(moduleSource).not.toMatch(/from\s+["']next\//);
      expect(moduleSource).not.toMatch(/from\s+["']@cloudflare\//);
    }
  });

  it("returns equal values across repeated calls", () => {
    const first = getThemeTokens();
    const second = getThemeTokens();

    expect(first).toEqual(second);
  });

  it("defaults to DEFAULT_THEME_NAME when called with no argument or an unknown name", () => {
    expect(getThemeTokens()).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
    expect(getThemeTokens("not-a-real-theme")).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
  });

  it("keeps tailwind.config.ts free of hex literals (static half of TOKEN-01)", () => {
    const configSource = readFileSync(TAILWIND_CONFIG_PATH, "utf-8");

    expect(configSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
