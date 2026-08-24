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
      confirmedPreview: false,
      confirmedProduction: false,
      confirmedOverwrite: false,
      createClerkUsers: false,
      confirmedClerkAutoVerification: false,
    });
    expect(config).not.toHaveProperty("wranglerEnvironment");
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

  it("requires explicit confirmations for sensitive data and remote writes", () => {
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--include-sensitive"]))
      .toThrow("--confirm-sensitive-data");
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--apply", "--target=production"]))
      .toThrow("--confirm-production");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--apply", "--target=production", "--confirm-production"],
    )).toThrow("MERCORA_ALLOW_PRODUCTION_IMPORTS=1");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--apply", "--target=preview"],
    )).toThrow("--confirm-preview");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input", MIGRATION_TARGET: "production", MERCORA_ALLOW_PRODUCTION_IMPORTS: "1" },
      ["--apply", "--confirm-production"],
    )).toThrow("explicit --target=preview or --target=production");

    const config = parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input", MERCORA_ALLOW_PRODUCTION_IMPORTS: "1" },
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

  it("requires an independent overwrite confirmation for writes", () => {
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--apply", "--overwrite"],
    )).toThrow("--confirm-overwrite");
    expect(parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--apply", "--overwrite", "--confirm-overwrite"],
    ).execution).toMatchObject({ apply: true, overwrite: true, confirmedOverwrite: true });
  });

  it("requires independent Clerk creation and auto-verification confirmations", () => {
    const base = ["--apply", "--include-sensitive", "--confirm-sensitive-data"];
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      [...base, "--create-clerk-users"],
    )).toThrow("--confirm-clerk-auto-verification");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--apply", "--confirm-clerk-auto-verification"],
    )).toThrow("requires --create-clerk-users");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--create-clerk-users", "--confirm-clerk-auto-verification", "--include-sensitive", "--confirm-sensitive-data"],
    )).toThrow("may only be used with --apply");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--apply", "--create-clerk-users", "--confirm-clerk-auto-verification"],
    )).toThrow("requires --include-sensitive");

    const config = parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      [...base, "--create-clerk-users", "--confirm-clerk-auto-verification"],
    );
    expect(config.execution).toMatchObject({
      apply: true,
      includeSensitive: true,
      confirmedSensitiveData: true,
      createClerkUsers: true,
      confirmedClerkAutoVerification: true,
    });
  });

  it("rejects duplicate Clerk provisioning flags", () => {
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--create-clerk-users", "--create-clerk-users"],
    )).toThrow("may only be provided once");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--confirm-clerk-auto-verification", "--confirm-clerk-auto-verification"],
    )).toThrow("may only be provided once");
  });

  it("accepts a bounded Wrangler environment without resource-name overrides", () => {
    const config = parseMigrationConfig(
      {
        MIGRATION_INPUT_ROOT: "input",
        MIGRATION_D1_DATABASE: "typo-database",
        MIGRATION_R2_BUCKET: "typo-bucket",
      },
      ["--env=staging"],
    );
    expect(config.wranglerEnvironment).toBe("staging");
    expect(config).not.toHaveProperty("d1DatabaseName");
    expect(config).not.toHaveProperty("r2BucketName");
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--env=../../prod"]))
      .toThrow("environment name");
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--env="]))
      .toThrow("non-empty Wrangler environment");
  });

  it("rejects unknown options and contradictory execution modes", () => {
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--delete-all"])).toThrow("Unknown");
    expect(() => parseMigrationConfig({ MIGRATION_INPUT_ROOT: "input" }, ["--apply", "--dry-run"]))
      .toThrow("mutually exclusive");
    expect(() => parseMigrationConfig(
      { MIGRATION_INPUT_ROOT: "input" },
      ["--confirm-sensitive-data"],
    )).toThrow("requires --include-sensitive");
  });
});
