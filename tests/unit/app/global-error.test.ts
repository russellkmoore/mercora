import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlobalError from "@/app/global-error";
import { parseThemeResponse } from "@/lib/themes/theme-response";
import { getThemeTokens } from "@/lib/themes/tokens";
import { DEFAULT_THEME_NAME } from "@/lib/themes/manifest.generated";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Crash-page two-state contract (D-02, 08.1-UI-SPEC.md).
 *
 * First state: `renderToStaticMarkup` never runs effects, so this is
 * exactly the server render / first client paint — the manifest default,
 * with no async gate before it.
 *
 * Second state is covered through `parseThemeResponse` rather than a DOM,
 * since a real fetch/useEffect cycle can't run under a static render — the
 * parser is the exact function the mount effect calls to apply a fetched
 * body, so proving its behavior proves the second paint's data source.
 */
describe("GlobalError first paint (no effect run)", () => {
  const html = renderToStaticMarkup(
    React.createElement(GlobalError, { error: new Error("boom"), reset: () => {} }),
  );
  const defaultTokens = getThemeTokens();

  it("carries the manifest default's six token values", () => {
    expect(html).toContain(defaultTokens.surfaceElevated);
    expect(html).toContain(defaultTokens.foreground);
    expect(html).toContain(defaultTokens.mutedForeground);
    expect(html).toContain(defaultTokens.primary);
    expect(html).toContain(defaultTokens.onPrimary);
    expect(html).toContain(defaultTokens.border);
  });

  it("renders all four copy strings verbatim", () => {
    expect(html).toContain("Something went wrong");
    expect(html).toContain("The storefront could not be loaded. Please try again.");
    expect(html).toContain("Try again");
    expect(html).toContain("Go home");
  });

  it("carries no error.digest value in the markup (UI-SPEC long-text backstop: not applicable today)", () => {
    const errorWithDigest = new Error("boom") as Error & { digest?: string };
    errorWithDigest.digest = "unique-digest-marker-12345";
    const htmlWithDigest = renderToStaticMarkup(
      React.createElement(GlobalError, { error: errorWithDigest, reset: () => {} }),
    );
    expect(htmlWithDigest).not.toContain("unique-digest-marker-12345");
  });
});

describe("parseThemeResponse — the second paint's data source", () => {
  it("returns a token set whose surfaceElevated, foreground, and primary differ from the default for a valid non-default preset", () => {
    const defaultTokens = getThemeTokens(DEFAULT_THEME_NAME);
    const nonDefaultName = "luxe";
    expect(nonDefaultName).not.toBe(DEFAULT_THEME_NAME);

    const parsed = parseThemeResponse({ name: nonDefaultName, tokens: getThemeTokens(nonDefaultName) });

    expect(parsed).not.toBeNull();
    expect(parsed!.surfaceElevated).not.toBe(defaultTokens.surfaceElevated);
    expect(parsed!.foreground).not.toBe(defaultTokens.foreground);
    expect(parsed!.primary).not.toBe(defaultTokens.primary);
  });

  it("yields null for every failure shape a fetch can produce", () => {
    // A rejected fetch never reaches parseThemeResponse at all (the mount
    // effect's .catch() swallows it before parsing) — covered by the
    // source-contract assertion below, not here.

    // Non-ok status: the mount effect maps this to `null` before calling
    // the parser, so the parser sees `null` directly.
    expect(parseThemeResponse(null)).toBeNull();

    // Unparseable JSON: `response.json()` itself would reject, which the
    // mount effect's .catch() swallows — again never reaches the parser.
    // The parser's own malformed-body case is a well-formed JSON value that
    // isn't a valid theme response:
    expect(parseThemeResponse({ notName: "luxe" })).toBeNull();

    // Well-formed body naming a theme absent from the manifest:
    expect(parseThemeResponse({ name: "not-a-real-theme", tokens: {} })).toBeNull();
  });
});

describe("app/global-error.tsx source contract", () => {
  const src = source("app/global-error.tsx");

  it("fetches /api/theme inside a mount effect", () => {
    expect(src).toMatch(/useEffect\(/);
    expect(src).toMatch(/fetch\(["']\/api\/theme["']\)/);
  });

  it("routes the response body through parseThemeResponse", () => {
    expect(src).toMatch(/parseThemeResponse\(/);
  });

  it("guards the state update with a cancellation flag", () => {
    expect(src).toMatch(/cancelled/);
  });

  it("has a catch arm on the fetch chain", () => {
    expect(src).toMatch(/\.catch\(/);
  });

  it("references no theme provider or hook", () => {
    expect(src).not.toMatch(/ThemeProvider/);
    expect(src).not.toMatch(/useTheme/);
    expect(src).not.toMatch(/next-themes/);
  });
});
