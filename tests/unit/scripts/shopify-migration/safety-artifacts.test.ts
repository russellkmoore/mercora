import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deterministicProviderId, providerFingerprint } from "@/scripts/shopify-migration/lib/ids";
import { IdMap } from "@/scripts/shopify-migration/lib/id-map";
import { MigrationLogger, redactForLog, type StructuredLogRecord } from "@/scripts/shopify-migration/lib/logger";

const roots: string[] = [];
afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("migration identity and artifacts", () => {
  it("creates deterministic provider IDs without exposing the source", () => {
    const one = deterministicProviderId("shopify", "customer", "customer@example.test");
    const two = deterministicProviderId("shopify", "customer", "customer@example.test");
    expect(one).toBe(two);
    expect(one).not.toContain("customer@example.test");
    expect(providerFingerprint("shopify", "customer", "1")).not.toBe(providerFingerprint("shopify", "order", "1"));
  });

  it("persists only non-authoritative fingerprints and safe target IDs", () => {
    const output = mkdtempSync(join(tmpdir(), "mercora-shopify-map-"));
    roots.push(output);
    const map = new IdMap("shopify");
    map.register("customer", "customer@example.test", "customer_123");
    map.save(output, "state/id-map.json");
    const serialized = readFileSync(join(output, "state/id-map.json"), "utf8");
    expect(serialized).toContain('"authoritative": false');
    expect(serialized).not.toContain("customer@example.test");
    expect(IdMap.load(output, "state/id-map.json").resolve("customer", "customer@example.test")).toBe("customer_123");
    expect(() => map.register("customer", "2", "not an email@example.test")).toThrow(/invalid|sensitive/);
  });

  it("rejects output traversal", () => {
    const output = mkdtempSync(join(tmpdir(), "mercora-shopify-map-"));
    roots.push(output);
    expect(() => new IdMap("shopify").save(output, "../map.json")).toThrow(/escapes/);
  });
});

describe("redacted structured migration logging", () => {
  it("redacts sensitive keys, email-shaped values, and configured secrets", () => {
    const records: StructuredLogRecord[] = [];
    const logger = new MigrationLogger((record) => records.push(record), ["shpat_supersecret"], () => new Date("2026-08-14T00:00:00Z"));
    logger.info("shopify.page", {
      accessToken: "shpat_supersecret",
      note: "customer@example.test used shpat_supersecret",
      nested: { shippingAddress: "123 Main St" },
      count: 3,
    });
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain("shpat_supersecret");
    expect(serialized).not.toContain("customer@example.test");
    expect(serialized).not.toContain("123 Main St");
    expect(records[0]).toMatchObject({ level: "info", event: "shopify.page" });
  });

  it("redacts arbitrary nested values without mutating the input", () => {
    const input = { reviewer_email: "person@example.test", ok: "public" };
    expect(redactForLog(input)).toEqual({ reviewer_email: "[REDACTED]", ok: "public" });
    expect(input.reviewer_email).toBe("person@example.test");
  });
});
