import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getThemeTokens } from "@/lib/themes/tokens";

/**
 * Contract test: getThemeTokens() must never silently drift from
 * themes/volt-dark.css. This test reads the CSS file itself rather than
 * restating its values a second time, so a hand-edited hex in one place
 * without the other fails here.
 */

const THEME_CSS_PATH = path.resolve(process.cwd(), "themes/volt-dark.css");
const TAILWIND_CONFIG_PATH = path.resolve(process.cwd(), "tailwind.config.ts");

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

/** Maps a `--store-kebab-name` CSS custom property to its camelCase key. */
function kebabToCamel(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

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

const themeCssSource = readFileSync(THEME_CSS_PATH, "utf-8");
const themeCssProps = parseThemeCssProperties(themeCssSource);

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

describe("getThemeTokens()", () => {
  it("returns an object with exactly 23 own keys, matching the token map's camelCase names", () => {
    const tokens = getThemeTokens();
    const keys = Object.keys(tokens);

    expect(keys).toHaveLength(23);
    expect(keys.sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it("keeps every one of the 17 colour tokens byte-identical (case-insensitive, trimmed) to themes/volt-dark.css", () => {
    const tokens = getThemeTokens() as unknown as Record<string, string>;

    expect(COLOUR_KEYS).toHaveLength(17);
    for (const key of COLOUR_KEYS) {
      const cssValue = themeCssProps[key];
      expect(cssValue, `themes/volt-dark.css is missing --store-${key}`).toBeDefined();
      expect(tokens[key].trim().toLowerCase()).toBe(cssValue.trim().toLowerCase());
    }
  });

  it("keeps every one of the 4 radius tokens identical to themes/volt-dark.css", () => {
    const tokens = getThemeTokens() as unknown as Record<string, string>;

    expect(RADIUS_KEYS).toHaveLength(4);
    for (const key of RADIUS_KEYS) {
      const cssValue = themeCssProps[key];
      expect(cssValue, `themes/volt-dark.css is missing --store-${key}`).toBeDefined();
      expect(tokens[key].trim().toLowerCase()).toBe(cssValue.trim().toLowerCase());
    }
  });

  it("reads no environment variable and imports nothing server-only (D1/Cloudflare/next)", () => {
    const moduleSource = readFileSync(
      path.resolve(process.cwd(), "lib/themes/tokens.ts"),
      "utf-8",
    );

    expect(moduleSource).not.toMatch(/process\.env/);
    expect(moduleSource).not.toMatch(/from\s+["'](.*\/)?d1[^"']*["']/i);
    expect(moduleSource).not.toMatch(/from\s+["']next\//);
    expect(moduleSource).not.toMatch(/from\s+["']@cloudflare\//);
  });

  it("returns equal values across repeated calls", () => {
    const first = getThemeTokens();
    const second = getThemeTokens();

    expect(first).toEqual(second);
  });

  it("keeps tailwind.config.ts free of hex literals (static half of TOKEN-01)", () => {
    const configSource = readFileSync(TAILWIND_CONFIG_PATH, "utf-8");

    expect(configSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
