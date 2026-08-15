import { describe, expect, it, vi } from "vitest";

import type { ClerkMigrationClient } from "@/scripts/shopify-migration/adapters/clerk";
import type { CommandRunner } from "@/scripts/shopify-migration/adapters/d1";
import type { MediaObjectStore } from "@/scripts/shopify-migration/adapters/media";
import type { ExecutionPlan, MigrationConfig } from "@/scripts/shopify-migration/lib/config";
import {
  orchestrateMigration,
  type MigrationAdapterRunners,
  type MigrationApplyFactories,
  type MigrationSource,
  type MigrationSourceBundle,
} from "@/scripts/shopify-migration/orchestrator";

const wranglerConfig = JSON.stringify({
  d1_databases: [{ binding: "DB", database_name: "migration-db", database_id: "db-id" }],
  r2_buckets: [{ binding: "MEDIA", bucket_name: "migration-media" }],
});

function execution(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  return {
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
    ...overrides,
  };
}

function config(plan = execution()): MigrationConfig {
  return { sourceMode: "file", inputRoot: "/input", execution: plan };
}

function bundle(overrides: Partial<MigrationSourceBundle> = {}): MigrationSourceBundle {
  return {
    collections: [],
    collects: [],
    products: [],
    pages: [],
    blogs: [],
    articles: [],
    redirects: [],
    customers: [],
    orders: [],
    judgeMeRows: [],
    ...overrides,
  };
}

function source(records: MigrationSourceBundle): MigrationSource {
  return { extract: vi.fn(async () => records) };
}

const domain = {
  currency: "USD",
  inventoryLocationId: "main",
  fulfillmentType: "physical" as const,
  actorId: "user_operator",
  fallbackAuthor: "Store team",
  allowedMediaHosts: ["cdn.shopify.com"],
  unresolvedCustomer: "reject" as const,
  reviewAttributions: new Map(),
};

describe("Shopify migration orchestrator", () => {
  it("keeps dry runs free of write adapter construction and sensitive payloads", async () => {
    const factories: MigrationApplyFactories = {
      createMediaStore: vi.fn(),
      createClerkClient: vi.fn(),
      createCommandRunner: vi.fn(),
    };
    const records = bundle({
      collections: [{ id: 1, title: "Private catalog title", handle: "tea", variants: undefined } as never],
    });
    const result = await orchestrateMigration({
      config: config(),
      domain,
      source: source(records),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      expectedDatabaseName: "migration-db",
      applyFactories: factories,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(result).toMatchObject({ dryRun: true, target: "local", authoritative: false });
    expect(result.entities.categories).toMatchObject({ source: 1, transformed: 1, written: 0 });
    expect(factories.createMediaStore).not.toHaveBeenCalled();
    expect(factories.createClerkClient).not.toHaveBeenCalled();
    expect(factories.createCommandRunner).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("Private catalog title");
  });

  it("validates deterministic transforms before constructing apply adapters", async () => {
    const createMediaStore = vi.fn();
    const records = bundle({
      collects: [
        { id: 1, collection_id: 10, product_id: 20 },
        { id: 1, collection_id: 11, product_id: 21 },
      ],
    });
    await expect(orchestrateMigration({
      config: config(execution({ dryRun: false, apply: true })),
      domain,
      source: source(records),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      applyFactories: {
        createMediaStore,
        createClerkClient: vi.fn(),
        createCommandRunner: vi.fn(),
      },
      runners: {} as MigrationAdapterRunners,
    })).rejects.toThrow("ambiguous duplicate");
    expect(createMediaStore).not.toHaveBeenCalled();
  });

  it("applies strictly in media, Clerk, then D1 order", async () => {
    const events: string[] = [];
    const mediaStore = {} as MediaObjectStore;
    const clerkClient = {} as ClerkMigrationClient;
    const commandRunner = {} as CommandRunner;
    const plan = execution({
      dryRun: false,
      apply: true,
      includeSensitive: true,
      confirmedSensitiveData: true,
    });
    const records = bundle({
      customers: [{
        id: 42,
        email: "customer@example.test",
        first_name: "Private",
        verified_email: true,
      }],
    });
    const factories: MigrationApplyFactories = {
      createMediaStore: vi.fn(() => { events.push("media-factory"); return mediaStore; }),
      createClerkClient: vi.fn(async () => { events.push("clerk-factory"); return clerkClient; }),
      createCommandRunner: vi.fn(() => { events.push("d1-factory"); return commandRunner; }),
    };
    const runners: MigrationAdapterRunners = {
      importMedia: vi.fn(async () => { events.push("media-run"); return []; }),
      provisionClerk: vi.fn(async (plans) => {
        events.push("clerk-run");
        return {
          idMap: new Map([[plans[0].sourceFingerprint, "user_imported_customer"]]),
          created: 1,
          existing: 0,
          reconciliation: [],
        };
      }),
      runD1: vi.fn(async () => {
        events.push("d1-run");
        return { dryRun: false as const, dependencies: [], totalRows: 1, chunksApplied: 1, validationsPassed: 1 };
      }),
    };

    const result = await orchestrateMigration({
      config: config(plan),
      domain,
      source: source(records),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      applyFactories: factories,
      runners,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(events).toEqual([
      "media-factory",
      "media-run",
      "clerk-factory",
      "clerk-run",
      "d1-factory",
      "d1-run",
    ]);
    expect(result).toMatchObject({ dryRun: false, clerk: { created: 1 }, media: { persisted: 0 } });
    expect(JSON.stringify(result)).not.toContain("customer@example.test");
    expect(JSON.stringify(result)).not.toContain("Private");
  });
});
