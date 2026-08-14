import { describe, expect, it } from "vitest";
import {
  parseWranglerJsonc,
  resolveDatabaseTarget,
  resolveMediaTarget,
} from "@/scripts/shopify-migration/lib/wrangler-target";

const config = parseWranglerJsonc(`{
  // Comments and URLs remain valid.
  "url": "https://example.test/a,}",
  "d1_databases": [{
    "binding": "DB", "database_name": "store-db", "database_id": "production-database-id",
    "preview_database_id": "preview-database-id",
  }],
  "r2_buckets": [{
    "binding": "MEDIA", "bucket_name": "store-media", "preview_bucket_name": "store-media-preview",
  }],
  "env": {
    "staging": {
      "d1_databases": [{ "binding": "DB", "database_name": "stage-db", "database_id": "stage-database-id", "preview_database_id": "stage-preview-id" }],
      "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "stage-media", "preview_bucket_name": "stage-media-preview" }],
    },
  },
}`);

describe("canonical Wrangler migration targets", () => {
  it("resolves production and preview resources from exact binding names", () => {
    expect(resolveMediaTarget(config, { target: "production" }).bucketName).toBe("store-media");
    expect(resolveMediaTarget(config, { target: "preview" }).bucketName).toBe("store-media-preview");
    expect(resolveDatabaseTarget(config, { target: "preview" }).databaseId).toBe("preview-database-id");
  });

  it("never falls back from a selected environment to root bindings", () => {
    expect(resolveMediaTarget(config, { target: "production", environment: "staging" }).bucketName).toBe("stage-media");
    expect(() => resolveMediaTarget(config, { target: "production", environment: "missing" })).toThrow(/refusing root fallback/);
    const missingBinding = parseWranglerJsonc(`{ "r2_buckets": [{ "binding": "OTHER", "bucket_name": "other" }] }`);
    expect(() => resolveMediaTarget(missingBinding, { target: "production" })).toThrow(/exactly one.*MEDIA/);
  });

  it("requires explicit preview resource identifiers without production fallback", () => {
    const noPreview = parseWranglerJsonc(`{
      "d1_databases": [{ "binding": "DB", "database_name": "store-db", "database_id": "production-id" }],
      "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "store-media" }]
    }`);
    expect(() => resolveMediaTarget(noPreview, { target: "preview" })).toThrow("preview_bucket_name");
    expect(() => resolveDatabaseTarget(noPreview, { target: "preview" })).toThrow("preview_database_id");
  });

  it("treats an operator resource name only as an exact assertion", () => {
    expect(resolveMediaTarget(config, { target: "production", expectedName: "store-media" }).bucketName).toBe("store-media");
    expect(() => resolveMediaTarget(config, { target: "production", expectedName: "attacker-bucket" })).toThrow(/refusing override/);
    expect(() => resolveDatabaseTarget(config, { target: "production", expectedName: "other-db" })).toThrow(/refusing override/);
  });

  it("rejects malformed, duplicate, and oversized config", () => {
    expect(() => parseWranglerJsonc(`{ "r2_buckets": [`)).toThrow(/truncated|valid JSONC/);
    const duplicate = parseWranglerJsonc(`{ "r2_buckets": [
      { "binding": "MEDIA", "bucket_name": "one-bucket" },
      { "binding": "MEDIA", "bucket_name": "two-bucket" }
    ] }`);
    expect(() => resolveMediaTarget(duplicate, { target: "production" })).toThrow(/exactly one/);
    expect(() => parseWranglerJsonc(`{"padding":"${"x".repeat(1024 * 1024)}"}`)).toThrow(/too large/);
  });
});
