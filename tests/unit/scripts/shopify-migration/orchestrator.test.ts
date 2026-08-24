import { describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "@/scripts/shopify-migration/adapters/d1";
import type { MediaObjectStore } from "@/scripts/shopify-migration/adapters/media";
import type { ExecutionPlan, MigrationConfig } from "@/scripts/shopify-migration/lib/config";
import type { MediaRewrite } from "@/scripts/shopify-migration/transformers/_shared";
import {
  orchestrateMigration,
  type MigrationAdapterRunners,
  type MigrationApplyFactories,
  type MigrationSource,
  type MigrationSourceBundle,
  type TargetBoundClerkMigrationClient,
} from "@/scripts/shopify-migration/orchestrator";

const accountId = "a".repeat(32);
const clerkInstanceId = "ins_preview_store";
const wranglerConfig = JSON.stringify({
  account_id: accountId,
  vars: { CLERK_INSTANCE_ID: clerkInstanceId },
  d1_databases: [{
    binding: "DB", database_name: "migration-db", database_id: "db-id", preview_database_id: "preview-db-id",
  }],
  r2_buckets: [{ binding: "MEDIA", bucket_name: "migration-media", preview_bucket_name: "migration-media-preview" }],
});

const preflightReceipt = {
  version: 1 as const,
  target: "preview" as const,
  databaseName: "migration-db",
  databaseId: "preview-db-id",
  environment: null,
  projectDigest: "b".repeat(64),
};

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
    const clerkClient = {
      verifyTarget: vi.fn(async () => { events.push("clerk-preflight"); }),
    } as unknown as TargetBoundClerkMigrationClient;
    const commandRunner = {} as CommandRunner;
    const plan = execution({
      dryRun: false,
      apply: true,
      target: "preview",
      includeSensitive: true,
      confirmedSensitiveData: true,
      confirmedPreview: true,
    });
    const records = bundle({
      collections: [{
        id: 1,
        title: "Tea",
        handle: "tea",
        image: { src: "https://cdn.shopify.com/tea.jpg", width: 100, height: 100 },
      }],
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
      preflightD1: vi.fn(async () => { events.push("d1-preflight"); return preflightReceipt; }),
      importMedia: vi.fn(async (plans: readonly MediaRewrite[]) => {
        events.push("media-run");
        return plans.map((media) => ({
          objectKey: media.objectKey,
          publicPath: media.publicPath,
          contentType: media.contentType,
          status: "written" as const,
          byteLength: 10,
          sha256: "c".repeat(64),
        }));
      }),
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
      remoteTargetBinding: { cloudflareAccountId: accountId, clerkInstanceId },
      applyFactories: factories,
      runners,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(events).toEqual([
      "d1-factory",
      "d1-preflight",
      "clerk-factory",
      "clerk-preflight",
      "media-factory",
      "media-run",
      "clerk-run",
      "d1-run",
    ]);
    expect(result).toMatchObject({ dryRun: false, clerk: { created: 1 }, media: { persisted: 1 } });
    expect(JSON.stringify(result)).not.toContain("customer@example.test");
    expect(JSON.stringify(result)).not.toContain("Private");
  });

  it("rejects local external-write plans before constructing any adapter", async () => {
    const factories: MigrationApplyFactories = {
      createMediaStore: vi.fn(),
      createClerkClient: vi.fn(),
      createCommandRunner: vi.fn(),
    };
    await expect(orchestrateMigration({
      config: config(execution({
        dryRun: false,
        apply: true,
        includeSensitive: true,
        confirmedSensitiveData: true,
      })),
      domain,
      source: source(bundle({
        collections: [{ id: 1, title: "Tea", handle: "tea", image: { src: "https://cdn.shopify.com/tea.jpg" } }],
        customers: [{ id: 42, email: "customer@example.test", verified_email: true }],
      })),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      applyFactories: factories,
      runners: {} as MigrationAdapterRunners,
    })).rejects.toThrow("Local apply cannot use remote R2 or Clerk");
    expect(factories.createCommandRunner).not.toHaveBeenCalled();
    expect(factories.createMediaStore).not.toHaveBeenCalled();
    expect(factories.createClerkClient).not.toHaveBeenCalled();
  });

  it("rejects remote target identity mismatches before preflight or client construction", async () => {
    const factories: MigrationApplyFactories = {
      createMediaStore: vi.fn(),
      createClerkClient: vi.fn(),
      createCommandRunner: vi.fn(),
    };
    const preflightD1 = vi.fn();
    const preview = execution({ dryRun: false, apply: true, target: "preview", confirmedPreview: true });
    await expect(orchestrateMigration({
      config: config(preview),
      domain,
      source: source(bundle()),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      remoteTargetBinding: { cloudflareAccountId: "f".repeat(32) },
      applyFactories: factories,
      runners: { preflightD1 } as unknown as MigrationAdapterRunners,
    })).rejects.toThrow("Cloudflare credential account does not match");
    expect(preflightD1).not.toHaveBeenCalled();
    expect(factories.createCommandRunner).not.toHaveBeenCalled();
    expect(factories.createMediaStore).not.toHaveBeenCalled();
    expect(factories.createClerkClient).not.toHaveBeenCalled();
  });

  it("rejects a Clerk instance mismatch before D1 preflight or client construction", async () => {
    const factories: MigrationApplyFactories = {
      createMediaStore: vi.fn(),
      createClerkClient: vi.fn(),
      createCommandRunner: vi.fn(),
    };
    const preflightD1 = vi.fn();
    const preview = execution({
      dryRun: false,
      apply: true,
      target: "preview",
      confirmedPreview: true,
      includeSensitive: true,
      confirmedSensitiveData: true,
    });
    await expect(orchestrateMigration({
      config: config(preview),
      domain,
      source: source(bundle({ customers: [{ id: 42, email: "customer@example.test", verified_email: true }] })),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      remoteTargetBinding: { cloudflareAccountId: accountId, clerkInstanceId: "ins_wrong_store" },
      applyFactories: factories,
      runners: { preflightD1 } as unknown as MigrationAdapterRunners,
    })).rejects.toThrow("Clerk instance does not match");
    expect(preflightD1).not.toHaveBeenCalled();
    expect(factories.createCommandRunner).not.toHaveBeenCalled();
    expect(factories.createClerkClient).not.toHaveBeenCalled();
  });

  it("runs D1 preflight before constructing mutating media or Clerk adapters", async () => {
    const factories: MigrationApplyFactories = {
      createMediaStore: vi.fn(),
      createClerkClient: vi.fn(),
      createCommandRunner: vi.fn(() => ({} as CommandRunner)),
    };
    const preflightD1 = vi.fn(async () => { throw new Error("D1 preflight failed"); });
    await expect(orchestrateMigration({
      config: config(execution({ dryRun: false, apply: true, target: "preview", confirmedPreview: true })),
      domain,
      source: source(bundle({
        collections: [{ id: 1, title: "Tea", handle: "tea", image: { src: "https://cdn.shopify.com/tea.jpg" } }],
      })),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      remoteTargetBinding: { cloudflareAccountId: accountId },
      applyFactories: factories,
      runners: { preflightD1 } as unknown as MigrationAdapterRunners,
    })).rejects.toThrow("D1 preflight failed");
    expect(preflightD1).toHaveBeenCalledOnce();
    expect(factories.createMediaStore).not.toHaveBeenCalled();
    expect(factories.createClerkClient).not.toHaveBeenCalled();
  });

  it("stops after a Clerk credential-instance mismatch without constructing media or running writes", async () => {
    const verifyTarget = vi.fn(async () => { throw new Error("Clerk credential instance does not match"); });
    const factories: MigrationApplyFactories = {
      createMediaStore: vi.fn(),
      createClerkClient: vi.fn(async () => ({ verifyTarget } as unknown as TargetBoundClerkMigrationClient)),
      createCommandRunner: vi.fn(() => ({} as CommandRunner)),
    };
    const provisionClerk = vi.fn();
    const runD1 = vi.fn();
    await expect(orchestrateMigration({
      config: config(execution({
        dryRun: false,
        apply: true,
        target: "preview",
        confirmedPreview: true,
        includeSensitive: true,
        confirmedSensitiveData: true,
      })),
      domain,
      source: source(bundle({
        collections: [{ id: 1, title: "Tea", handle: "tea", image: { src: "https://cdn.shopify.com/tea.jpg" } }],
        customers: [{ id: 42, email: "customer@example.test", verified_email: true }],
      })),
      projectRoot: "/repo",
      wranglerConfigText: wranglerConfig,
      remoteTargetBinding: { cloudflareAccountId: accountId, clerkInstanceId },
      applyFactories: factories,
      runners: {
        preflightD1: vi.fn(async () => preflightReceipt),
        importMedia: vi.fn(),
        provisionClerk,
        runD1,
      } as unknown as MigrationAdapterRunners,
    })).rejects.toThrow("Clerk credential instance does not match");
    expect(verifyTarget).toHaveBeenCalledWith(clerkInstanceId, "development");
    expect(factories.createMediaStore).not.toHaveBeenCalled();
    expect(provisionClerk).not.toHaveBeenCalled();
    expect(runD1).not.toHaveBeenCalled();
  });
});
