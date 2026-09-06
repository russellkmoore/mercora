import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 06.1-REVIEW WR-02: pins the next/font variable-class / body-font-family
 * wiring that fixed T-06.1-13 (storefront silently dropping to the
 * browser's default serif). RootLayout is an async server component that
 * resolves the active theme via D1/env lookups and wraps ClerkProvider, so
 * it cannot be rendered directly in this project's vitest setup (no jsdom,
 * and rendering it would require live auth/db context). Instead this test
 * asserts the source contract directly: the six next/font variable class
 * tokens must be present on BOTH <html> and <body> in app/layout.tsx (the
 * html-level duplication is not accidental — see the inline comment at
 * app/layout.tsx documenting the CSS custom-property scope-resolution
 * bug), and app/globals.css must declare font-family: var(--store-font-sans)
 * on body with no literal system-ui fallback stack hard-coded on html.
 *
 * A future edit that "simplifies" the html className back to just
 * `data-theme`/`lang`, or reintroduces a literal font stack on html, fails
 * this test instead of shipping a silent theme-wide serif regression.
 */

const layoutSource = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
const globalsSource = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

const fontVariables = [
  "geistSans.variable",
  "geistMono.variable",
  "cormorantGaramond.variable",
  "orbitron.variable",
  "fraunces.variable",
  "nunito.variable",
];

function classNameBlockFor(tag: "html" | "body"): string {
  // Find the tag's opening `<html` / `<body`, then the NEXT `className={` template
  // literal after it, and slice to its closing backtick. Cannot just scan for the
  // next unescaped `>` from the tag start — the html element's opening tag contains
  // a JS comment (not JSX) that itself mentions literal `<html>` text, which would
  // terminate the slice early on the comment's own `>`.
  const tagIndex = layoutSource.indexOf(`<${tag}\n`);
  expect(tagIndex, `expected a <${tag}\\n element in app/layout.tsx`).toBeGreaterThan(-1);
  const classNameIndex = layoutSource.indexOf("className={`", tagIndex);
  expect(classNameIndex, `expected a className={\` template literal after <${tag}`).toBeGreaterThan(-1);
  const literalStart = classNameIndex + "className={`".length;
  const literalEnd = layoutSource.indexOf("`}", literalStart);
  return layoutSource.slice(literalStart, literalEnd);
}

describe("app/layout.tsx — next/font variable-class wiring", () => {
  it("applies every next/font variable class on <html>", () => {
    const htmlBlock = classNameBlockFor("html");
    for (const variable of fontVariables) {
      expect(htmlBlock).toContain(variable);
    }
  });

  it("applies every next/font variable class on <body>", () => {
    const bodyBlock = classNameBlockFor("body");
    for (const variable of fontVariables) {
      expect(bodyBlock).toContain(variable);
    }
  });
});

describe("app/globals.css — store font-family resolution", () => {
  it("declares font-family: var(--store-font-sans) on body", () => {
    const bodyRuleMatch = globalsSource.match(/body\s*\{[^}]*\}/);
    expect(bodyRuleMatch, "expected a body { ... } rule in app/globals.css").not.toBeNull();
    expect(bodyRuleMatch![0]).toContain("font-family: var(--store-font-sans)");
  });

  it("never hard-codes a literal system-ui font stack on html", () => {
    const htmlRuleMatch = globalsSource.match(/(?:^|\n)\s*html\s*\{[^}]*\}/);
    expect(htmlRuleMatch, "expected an html { ... } rule in app/globals.css").not.toBeNull();
    expect(htmlRuleMatch![0]).not.toContain("system-ui");
    expect(htmlRuleMatch![0]).not.toMatch(/font-family\s*:/);
  });
});
