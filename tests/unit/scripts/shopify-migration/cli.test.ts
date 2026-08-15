import { describe, expect, it } from "vitest";

import { parseMigrationCli } from "@/scripts/shopify-migration/cli";

const environment = {
  MIGRATION_INPUT_ROOT: "input",
  MIGRATION_CURRENCY: "USD",
  MIGRATION_INVENTORY_LOCATION_ID: "main",
  MIGRATION_FULFILLMENT_TYPE: "physical",
  MIGRATION_ACTOR_ID: "user_operator",
  MIGRATION_FALLBACK_AUTHOR: "Store team",
  MIGRATION_MEDIA_HOSTS: "cdn.shopify.com,store.myshopify.com",
  MIGRATION_UNRESOLVED_CUSTOMER: "reject",
};

describe("Shopify migration CLI", () => {
  it("defaults to a local dry run with explicit domain inputs", () => {
    const result = parseMigrationCli(environment, [], "/repo");
    expect(result.config.execution).toMatchObject({ dryRun: true, apply: false, target: "local" });
    expect(result.domain).toEqual({
      currency: "USD",
      inventoryLocationId: "main",
      fulfillmentType: "physical",
      actorId: "user_operator",
      fallbackAuthor: "Store team",
      allowedMediaHosts: ["cdn.shopify.com", "store.myshopify.com"],
      unresolvedCustomer: "reject",
    });
    expect(result.projectRoot).toBe("/repo");
  });

  it("requires every migration-specific domain decision", () => {
    for (const key of [
      "MIGRATION_CURRENCY",
      "MIGRATION_INVENTORY_LOCATION_ID",
      "MIGRATION_FULFILLMENT_TYPE",
      "MIGRATION_ACTOR_ID",
      "MIGRATION_FALLBACK_AUTHOR",
      "MIGRATION_MEDIA_HOSTS",
      "MIGRATION_UNRESOLVED_CUSTOMER",
    ]) {
      expect(() => parseMigrationCli({ ...environment, [key]: undefined }, [], "/repo")).toThrow();
    }
  });

  it("gates Judge.me and attribution inputs behind sensitive confirmation", () => {
    expect(() => parseMigrationCli(environment, ["--judge-me-file=reviews.csv"], "/repo"))
      .toThrow("require --include-sensitive");
    const result = parseMigrationCli(environment, [
      "--include-sensitive",
      "--confirm-sensitive-data",
      "--judge-me-file=reviews.csv",
      "--review-attributions=attributions.json",
    ], "/repo");
    expect(result).toMatchObject({
      judgeMeFile: "reviews.csv",
      reviewAttributionsFile: "attributions.json",
    });
  });

  it("rejects traversal, duplicate scalar decisions, and implicit remote apply", () => {
    expect(() => parseMigrationCli(environment, ["--judge-me-file=../reviews.csv"], "/repo")).toThrow();
    expect(() => parseMigrationCli(environment, ["--currency=USD", "--currency=CAD"], "/repo")).toThrow("once");
    expect(() => parseMigrationCli(
      { ...environment, MIGRATION_TARGET: "preview" },
      ["--apply", "--confirm-preview"],
      "/repo",
    )).toThrow("explicit --target");
  });
});
