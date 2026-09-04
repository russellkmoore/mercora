import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

interface Finding {
  path: string;
  line: number;
  col: number;
  match: string;
}

interface ScanResult {
  findings: Finding[];
  manualReview: { file: string; reason: string }[];
}

function runScan(fixturePath: string): { status: number | null; result: ScanResult } {
  const proc = spawnSync(
    "node",
    ["scripts/scan-hardcoded-colors.mjs", "--path", fixturePath, "--json"],
    { encoding: "utf8", cwd: process.cwd() },
  );
  return { status: proc.status, result: JSON.parse(proc.stdout) as ScanResult };
}

describe("scan-hardcoded-colors", () => {
  it("flags a raw palette utility and a hex literal, with a non-zero exit code", () => {
    const { status, result } = runScan("tests/fixtures/scan-tokens/dirty.tsx");
    expect(status).not.toBe(0);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    expect(result.findings.some((f) => f.match === "bg-orange-500")).toBe(true);
    expect(result.findings.some((f) => f.match === "#ff00ff")).toBe(true);
  });

  it("catches a variant-chained palette utility", () => {
    const { result } = runScan("tests/fixtures/scan-tokens/dirty.tsx");
    expect(result.findings.some((f) => f.match === "bg-neutral-800" && f.line === 4)).toBe(true);
  });

  it("reports zero findings and a zero exit for contract-token-only classes", () => {
    const { status, result } = runScan("tests/fixtures/scan-tokens/clean.tsx");
    expect(status).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("strips line, block, and JSDoc comments before matching", () => {
    // clean.tsx's only palette-looking strings live inside comments; a
    // regression here would surface them as findings.
    const { result } = runScan("tests/fixtures/scan-tokens/clean.tsx");
    expect(result.findings).toEqual([]);
  });

  it("reports two findings on one line with different column numbers", () => {
    const { result } = runScan("tests/fixtures/scan-tokens/dirty.tsx");
    const sameLine = result.findings.filter((f) => f.line === 3);
    expect(sameLine).toHaveLength(2);
    expect(sameLine[0].line).toBe(sameLine[1].line);
    expect(sameLine[0].col).not.toBe(sameLine[1].col);
  });

  it("honours the gsd:scan-ignore region sentinel in a CSS file", () => {
    const { result } = runScan("tests/fixtures/scan-tokens/sentinel.css");
    // Inside the sentinel region: no findings for #abcdef or the rgb(10 10 10) line.
    expect(result.findings.some((f) => f.match === "#abcdef")).toBe(false);
    expect(result.findings.some((f) => f.match.startsWith("rgb(10"))).toBe(false);
    // Outside the sentinel region: both values are still findings.
    expect(result.findings.some((f) => f.match === "#123456")).toBe(true);
    expect(result.findings.some((f) => f.match.startsWith("rgb(20"))).toBe(true);
  });

  it("produces zero findings for a fixture under an admin directory segment, even though it is non-empty", () => {
    const { status, result } = runScan("tests/fixtures/scan-tokens/admin/hardcoded.tsx");
    expect(status).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("produces identical JSON output across two runs over the same fixture tree", () => {
    const first = runScan("tests/fixtures/scan-tokens");
    const second = runScan("tests/fixtures/scan-tokens");
    expect(JSON.stringify(first.result)).toBe(JSON.stringify(second.result));
  });
});
