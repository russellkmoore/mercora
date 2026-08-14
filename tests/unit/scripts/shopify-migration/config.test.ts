import { describe, expect, it } from "vitest";
import { parseMigrationConfig, validateShopifyOrigin } from "@/scripts/shopify-migration/lib/config";

describe("Shopify migration config", () => {
  it("defaults to a zero-write local dry run without target resource defaults", () => {
    const config = parseMigrationConfig({ MIGRATION_INPUT_ROOT: "imports" }, [], "/operator");
    expect(config.execution).toEqual({
      dryRun: true,
      apply: false,
      target: "local",
      includeSensitive: false,
      overwrite: false,
      confirmedSensitiveData: false,
      confirmedProduction: false,
    });
    expect(config).not.toHaveProperty("d1DatabaseName");
    expect(config).not.toHaveProperty("r2BucketName");
    expect(config.inputRoot).toBe("/operator/imports");
  });

  it.each([
    "http://shop.myshopify.com",
    "https://myshopify.com",
    "https://shop.myshopify.com.evil.test",
    "https://user:pass@shop.myshopify.com",
    "https://shop.myshopify.com:8443",
    "https://shop.myshopify.com/admin",
    "https://shop.myshopify.com?token=x",
    "https://shop.myshopify.com/#fragment",
  ])("rejects hostile or non-origin store URL %s", (origin) => {
    expect(() => validateShopifyOrigin(origin)).toThrow(/exact HTTPS|valid HTTPS/);
  });

  it("requires an explicit token, store, and API version in API mode", () => {
    expect(() => parseMigrationConfig({}, ["--source=api"])).toThrow("SHOPIFY_STORE_URL");
    expect(() => parseMigrationConfig({ SHOPIFY_STORE_URL: "https://shop.myshopify.com" }, ["--source=api"]))
      .toThrow("SHOPIFY_ACCESS_TOKEN");
    expect(() => parseMigrationConfig({
      SHOPIFY_STORE_URL: "https://shop.myshopify.com",
      SHOPIFY_ACCESS_TOKEN: "secret",
    }, ["--source=api"])).toThrow("SHOPIFY_API_VERSION");
  });

  it("accepts only explicit quarterly API versions", () => {
    expect(() => parseMigrationConfig({
      SHOPIFY_STORE_URL: "https://shop.myshopify.com",
      SHOPIFY_ACCESS_TOKEN: "secret",
      SHOPIFY_API_VERSION: "latest",
    }, ["--source=api"])).toThrow(/quarterly version/);
  });

  it("requires explicit confirmations for sensitive data and production writes", () => {
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--include-sensitive"]))
      .toThrow("--confirm-sensitive-data");
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--apply", "--target=production"]))
      .toThrow("--confirm-production");

    const config = parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--apply", "--target=production", "--confirm-production", "--include-sensitive", "--confirm-sensitive-data"],
    );
    expect(config.execution).toMatchObject({
      apply: true,
      dryRun: false,
      target: "production",
      includeSensitive: true,
      confirmedProduction: true,
      confirmedSensitiveData: true,
    });
  });

  it("rejects unknown options and contradictory execution modes", () => {
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--delete-all"])).toThrow("Unknown");
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--apply", "--dry-run"]))
      .toThrow("mutually exclusive");
  });
});
