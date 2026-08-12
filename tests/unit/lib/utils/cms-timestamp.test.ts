import { describe, expect, it } from "vitest";
import { formatCmsTimestamp, parseCmsTimestamp } from "@/lib/utils/cms-timestamp";

describe("CMS timestamp parsing", () => {
  it("accepts Unix seconds, Unix milliseconds, and ISO text", () => {
    const expected = "2026-01-01T00:00:00.000Z";
    expect(parseCmsTimestamp(1_767_225_600)?.toISOString()).toBe(expected);
    expect(parseCmsTimestamp(1_767_225_600_000)?.toISOString()).toBe(expected);
    expect(parseCmsTimestamp("1767225600")?.toISOString()).toBe(expected);
    expect(parseCmsTimestamp(expected)?.toISOString()).toBe(expected);
  });

  it("returns null for empty or malformed values instead of displaying now", () => {
    expect(parseCmsTimestamp(null)).toBeNull();
    expect(parseCmsTimestamp(undefined)).toBeNull();
    expect(parseCmsTimestamp("")).toBeNull();
    expect(parseCmsTimestamp("   ")).toBeNull();
    expect(parseCmsTimestamp("not-a-timestamp")).toBeNull();
    expect(formatCmsTimestamp("not-a-timestamp")).toBeNull();
  });
});
