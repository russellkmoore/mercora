import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deterministicProviderId, providerFingerprint } from "@/scripts/shopify-migration/lib/ids";
import { IdMap } from "@/scripts/shopify-migration/lib/id-map";
import { MigrationLogger, redactForLog, type StructuredLogRecord } from "@/scripts/shopify-migration/lib/logger";
import { atomicWritePrivateFile } from "@/scripts/shopify-migration/lib/private-atomic-file";

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

  it("atomically replaces permissive artifacts with mode 0600", () => {
    const output = mkdtempSync(join(tmpdir(), "mercora-shopify-map-"));
    roots.push(output);
    mkdirSync(join(output, "state"));
    const path = join(output, "state/id-map.json");
    writeFileSync(path, "old", { mode: 0o644 });
    chmodSync(path, 0o644);

    const map = new IdMap("shopify");
    map.register("product", "1", "product_1");
    map.save(output, "state/id-map.json");

    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, "utf8")).toContain('"authoritative": false');
  });

  it.each(["write", "rename"] as const)("preserves the prior artifact when atomic %s fails", (failure) => {
    const output = mkdtempSync(join(tmpdir(), "mercora-shopify-map-"));
    roots.push(output);
    const path = join(output, "manifest.json");
    writeFileSync(path, "prior-valid\n", { mode: 0o600 });

    expect(() => atomicWritePrivateFile(path, "replacement\n", {
      operations: failure === "write"
        ? { write: () => { throw new Error("simulated write failure"); } }
        : { rename: () => { throw new Error("simulated rename failure"); } },
    })).toThrow(`simulated ${failure} failure`);

    expect(readFileSync(path, "utf8")).toBe("prior-valid\n");
    expect(readdirSync(output)).toEqual(["manifest.json"]);
  });

  it("fsyncs the parent directory after the atomic rename", () => {
    const output = mkdtempSync(join(tmpdir(), "mercora-shopify-map-"));
    roots.push(output);
    const path = join(output, "manifest.json");
    const events: string[] = [];
    const directorySync = vi.fn((directory: string) => {
      events.push("directory-sync");
      expect(directory).toBe(output);
    });
    atomicWritePrivateFile(path, "complete\n", {
      operations: {
        rename: (from, to) => { events.push("rename"); renameSync(from, to); },
        fsyncDirectory: directorySync,
      },
    });
    expect(events).toEqual(["rename", "directory-sync"]);
    expect(readFileSync(path, "utf8")).toBe("complete\n");
  });

  it("rejects non-regular, symlinked, and oversized ID-map inputs before parsing", () => {
    const output = mkdtempSync(join(tmpdir(), "mercora-shopify-map-"));
    roots.push(output);
    mkdirSync(join(output, "directory-map"));
    expect(() => IdMap.load(output, "directory-map")).toThrow(/regular non-symlink/);

    writeFileSync(join(output, "target.json"), "{}", { mode: 0o600 });
    symlinkSync(join(output, "target.json"), join(output, "linked.json"));
    expect(() => IdMap.load(output, "linked.json")).toThrow(/symbolic link/);

    writeFileSync(join(output, "oversized.json"), Buffer.alloc(10 * 1024 * 1024 + 1), { mode: 0o600 });
    expect(() => IdMap.load(output, "oversized.json")).toThrow(/too large/);
  });
});

describe("redacted structured migration logging", () => {
  it("admits operational metadata while redacting sensitive and unknown fields", () => {
    const records: StructuredLogRecord[] = [];
    const logger = new MigrationLogger((record) => records.push(record), ["shpat_supersecret"], () => new Date("2026-08-14T00:00:00Z"));
    logger.info("shopify.page", {
      accessToken: "shpat_supersecret",
      note: "customer@example.test used shpat_supersecret",
      nested: { shippingAddress: "123 Main St" },
      entity: "products",
      metrics: { sourceCount: 4, written: 3, durationMs: 20 },
      execution: { dryRun: true, target: "local" },
      count: 3,
    });
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain("shpat_supersecret");
    expect(serialized).not.toContain("customer@example.test");
    expect(serialized).not.toContain("123 Main St");
    expect(records[0]).toMatchObject({
      level: "info",
      event: "shopify.page",
      context: {
        entity: "products",
        metrics: { sourceCount: 4, written: 3, durationMs: 20 },
        execution: { dryRun: true, target: "local" },
        count: 3,
        redacted: "[REDACTED]",
      },
    });
  });

  it("redacts arbitrary values and keys without mutating the input", () => {
    const input = { reviewer_email: "person@example.test", ok: "public" };
    expect(redactForLog(input)).toEqual({ redacted: "[REDACTED]" });
    expect(input.reviewer_email).toBe("person@example.test");
  });

  it("keeps identifiers, names, phones, addresses, and nested records out of the sink", () => {
    const records: StructuredLogRecord[] = [];
    const logger = new MigrationLogger((record) => records.push(record));
    logger.warn("migration.record-rejected", {
      customerId: "gid://shopify/Customer/123456",
      orderId: 987654,
      sourceId: "provider-4455",
      providerSourceId: "4455",
      name: "Example Customer",
      phone: "+1 555 0100",
      address: "123 Example Street",
      record: {
        id: "gid://shopify/Order/987654",
        email: "customer@example.test",
        first_name: "Example",
        shipping_address: { address1: "123 Example Street" },
      },
      error: new TypeError("customer@example.test failed at 123 Example Street"),
      entity: "orders",
      skipped: 1,
    });
    const serialized = JSON.stringify(records);
    for (const forbidden of [
      "gid://shopify/Customer/123456",
      "987654",
      "provider-4455",
      "4455",
      "Example Customer",
      "+1 555 0100",
      "123 Example Street",
      "customer@example.test",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(records[0]).toMatchObject({
      context: { entity: "orders", skipped: 1, error: { errorClass: "TypeError" }, redacted: "[REDACTED]" },
    });
  });

  it("redacts raw arrays, circular structures, and secret-shaped operational labels", () => {
    const circular: Record<string, unknown> = { count: 1 };
    circular.summary = circular;
    expect(redactForLog({ result: [{ customerId: "123" }] })).toEqual({ result: "[REDACTED]" });
    expect(redactForLog(circular)).toEqual({ count: 1, summary: "[REDACTED]" });
    expect(redactForLog({ entity: "shpat_secret" }, ["shpat_secret"])).toEqual({ entity: "[REDACTED]" });
  });
});
