import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildManifest,
  parseThemeHeader,
  renderBarrelCss,
  renderManifestModule,
} from "../../../scripts/build-themes.mjs";

interface BuildThemesError {
  file: string;
  line: number;
  message: string;
}

interface BuildThemesResult {
  errors: BuildThemesError[];
  entries?: unknown[];
}

function runBuildThemes(fixturePath: string): { status: number | null; result: BuildThemesResult } {
  const proc = spawnSync(
    "node",
    ["scripts/build-themes.mjs", "--path", fixturePath, "--json"],
    { encoding: "utf8", cwd: process.cwd() },
  );
  return { status: proc.status, result: JSON.parse(proc.stdout) as BuildThemesResult };
}

describe("build-themes: fixture-driven validator rules", () => {
  it("valid — a known-clean control fixture passes with zero errors and one manifest entry", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/valid");
    expect(status).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    const entry = result.entries?.[0] as { name: string; tokens: Record<string, string> };
    expect(entry.name).toBe("good");
    // Colour values normalised to lowercase (fixture declares --store-primary in uppercase).
    expect(entry.tokens.primary).toBe("#f97316");
    expect(entry.tokens.primary).toBe(entry.tokens.primary.toLowerCase());
  });

  it("missing-token — a fixture missing one required token fails naming it, with a file and line", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/missing-token");
    expect(status).not.toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("--store-info");
    expect(result.errors[0].file).toContain("missing-token");
    expect(result.errors[0].line).toBeGreaterThan(0);
  });

  it("unknown-token — a fixture declaring a store-prefixed property outside the 23 fails naming it", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/unknown-token");
    expect(status).not.toBe(0);
    expect(result.errors.some((e) => e.message.includes("--store-accent-2"))).toBe(true);
  });

  it("extra-rule — a second rule and a font-loading at-rule both fail, naming both problems", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/extra-rule");
    expect(status).not.toBe(0);
    expect(result.errors.some((e) => e.message.includes("@font-face"))).toBe(true);
    expect(result.errors.some((e) => e.message.includes(".extra-rule"))).toBe(true);
  });

  it("name-mismatch — a selector name unequal to the filename stem fails naming both", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/name-mismatch");
    expect(status).not.toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('[data-theme="good"]');
    expect(result.errors[0].message).toContain('[data-theme="mismatched"]');
  });

  it("bad-hex — a colour token written as a colour function fails naming the token and value", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/bad-hex");
    expect(status).not.toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("--store-primary");
    expect(result.errors[0].message).toContain("rgb(249, 115, 22)");
  });

  it("no-label — a header with no label field fails, saying the label is required", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/no-label");
    expect(status).not.toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("label");
  });

  it("duplicate-token — a fixture that redeclares a token fails naming the token, with a positive line number", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/duplicate-token");
    expect(status).not.toBe(0);
    const dupeErrors = result.errors.filter((e) => e.message.includes("--store-primary"));
    expect(dupeErrors).toHaveLength(1);
    expect(dupeErrors[0].message).toContain("declared more than once");
    expect(dupeErrors[0].file).toContain("duplicate-token");
    expect(dupeErrors[0].line).toBeGreaterThan(0);
  });

  it("duplicate-token — a token declared three times still yields exactly one error for that token, not two", () => {
    const { result } = runBuildThemes("tests/fixtures/themes/duplicate-token");
    const dupeErrors = result.errors.filter((e) => e.message.includes("--store-primary"));
    expect(dupeErrors).toHaveLength(1);
  });

  it("empty file — an empty theme file fails with its own distinct message", () => {
    const { status, result } = runBuildThemes("tests/fixtures/themes/empty");
    expect(status).not.toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("empty");
  });

  describe("empty directory", () => {
    const emptyDir = mkdtempSync(path.join(tmpdir(), "build-themes-empty-dir-"));

    afterAll(() => {
      rmSync(emptyDir, { recursive: true, force: true });
    });

    it("a directory with zero theme files fails with its own distinct message", () => {
      const { status, result } = runBuildThemes(emptyDir);
      expect(status).not.toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("no theme files found");
      // Distinct from the empty-FILE message asserted above.
      expect(result.errors[0].message).not.toContain("theme file is empty");
    });
  });
});

describe("build-themes: exported pure functions", () => {
  it("parseThemeHeader reads label, industry, and synopsis from a @theme comment", () => {
    const header = parseThemeHeader(
      "/* @theme label: Luxe | industry: fashion, jewelry, watches | synopsis: A small luxury house. */\n[data-theme=\"luxe\"] {}",
    );
    expect(header).toEqual({
      label: "Luxe",
      industry: "fashion, jewelry, watches",
      synopsis: "A small luxury house.",
    });
  });

  it("parseThemeHeader returns null when no @theme comment is present", () => {
    expect(parseThemeHeader('[data-theme="x"] {}')).toBeNull();
  });

  it("parseThemeHeader returns null when the label field is absent", () => {
    expect(parseThemeHeader("/* @theme industry: testing */\n[data-theme=\"x\"] {}")).toBeNull();
  });

  it("parseThemeHeader accepts a label-only header (industry/synopsis optional)", () => {
    expect(parseThemeHeader("/* @theme label: Volt Dark */\n[data-theme=\"volt-dark\"] {}")).toEqual({
      label: "Volt Dark",
      industry: undefined,
      synopsis: undefined,
    });
  });

  it("renderManifestModule and renderBarrelCss are idempotent for the same entries", () => {
    const { entries, errors } = buildManifest("tests/fixtures/themes/valid");
    expect(errors).toEqual([]);

    const manifestA = renderManifestModule(entries);
    const manifestB = renderManifestModule(entries);
    expect(manifestA).toBe(manifestB);

    const barrelA = renderBarrelCss(entries);
    const barrelB = renderBarrelCss(entries);
    expect(barrelA).toBe(barrelB);
  });

  it("renderManifestModule emits no imports and at least one THEME_MANIFEST reference", () => {
    const { entries } = buildManifest("tests/fixtures/themes/valid");
    const source = renderManifestModule(entries);
    expect(source).toMatch(/THEME_MANIFEST/);
    expect(source).not.toMatch(/^import /m);
  });

  it("renderBarrelCss emits one relative @import per theme, in filename order", () => {
    const { entries } = buildManifest("tests/fixtures/themes/valid");
    const source = renderBarrelCss(entries);
    expect(source).toContain("@import './good.css';");
  });
});
