import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ClerkRetryableRequestError } from "@/scripts/shopify-migration/adapters/clerk";
import {
  createClerkRestMigrationClient,
  createFileMigrationSource,
  createShopifyApiMigrationSource,
  parseMigrationCli,
} from "@/scripts/shopify-migration/cli";

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
  const temporaryDirectories: string[] = [];
  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
    vi.unstubAllGlobals();
  });

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

  it("extracts every public file collection and keeps sensitive files gated", async () => {
    const root = await mkdtemp(join(tmpdir(), "mercora-shopify-cli-"));
    temporaryDirectories.push(root);
    const records: Record<string, unknown[]> = {
      custom_collections: [{ id: 1, title: "Custom", handle: "custom" }],
      smart_collections: [{ id: 2, title: "Smart", handle: "smart" }],
      collects: [],
      products: [],
      pages: [],
      blogs: [],
      articles: [],
      redirects: [],
    };
    await Promise.all(Object.entries(records).map(([name, rows]) =>
      writeFile(join(root, `${name}.json`), JSON.stringify(rows), { mode: 0o600 })));
    const parsed = parseMigrationCli({ ...environment, MIGRATION_INPUT_ROOT: root }, [], "/repo");
    const result = await createFileMigrationSource(parsed.config, parsed).extract(false);
    expect(result.collections.map((collection) => collection.collection_type)).toEqual(["custom", "smart"]);
    expect(result).toMatchObject({ customers: [], orders: [], judgeMeRows: [] });
  });

  it("extracts the complete public Shopify API graph without sensitive endpoints", async () => {
    const requested: string[] = [];
    const responseRows: Record<string, unknown[]> = {
      custom_collections: [],
      smart_collections: [],
      collects: [],
      products: [],
      pages: [],
      blogs: [{ id: 7, title: "Journal", handle: "journal" }],
      articles: [{ id: 8, blog_id: 7, title: "Post", handle: "post" }],
      redirects: [],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requested.push(url.pathname);
      const filename = url.pathname.split("/").at(-1)!;
      const key = filename.slice(0, -".json".length);
      return new Response(JSON.stringify({ [key]: responseRows[key] ?? [] }), {
        headers: { "content-type": "application/json" },
      });
    }));
    const parsed = parseMigrationCli({
      ...environment,
      MIGRATION_SOURCE_MODE: "api",
      SHOPIFY_STORE_URL: "https://store.myshopify.com",
      SHOPIFY_ACCESS_TOKEN: "private-token",
      SHOPIFY_API_VERSION: "2026-07",
    }, [], "/repo");
    const result = await createShopifyApiMigrationSource(parsed.config, parsed).extract(false);
    expect(result.blogs).toHaveLength(1);
    expect(result.articles).toHaveLength(1);
    expect(requested).toEqual(expect.arrayContaining([
      "/admin/api/2026-07/custom_collections.json",
      "/admin/api/2026-07/smart_collections.json",
      "/admin/api/2026-07/collects.json",
      "/admin/api/2026-07/products.json",
      "/admin/api/2026-07/pages.json",
      "/admin/api/2026-07/blogs.json",
      "/admin/api/2026-07/blogs/7/articles.json",
      "/admin/api/2026-07/redirects.json",
    ]));
    expect(requested.some((path) => path.endsWith("customers.json") || path.endsWith("orders.json"))).toBe(false);
  });

  it("forwards Clerk abort signals and emits only the narrow migration user shape", async () => {
    const controller = new AbortController();
    const fetchRequest = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return new Response(JSON.stringify([{ id: "user_existing", external_id: "a".repeat(64), email_addresses: [] }]), {
        headers: { "content-type": "application/json" },
      });
    });
    const client = createClerkRestMigrationClient("sk_test_private", fetchRequest);
    const result = await client.users.getUserList(
      { externalId: ["a".repeat(64)], limit: 2 },
      { signal: controller.signal },
    );
    expect(result).toEqual({ data: [{ id: "user_existing", externalId: "a".repeat(64) }] });
    const [url, init] = fetchRequest.mock.calls[0];
    expect(String(url)).toContain(`external_id=${"a".repeat(64)}`);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk_test_private");
  });

  it("actually cancels a stalled Clerk request through the supplied signal", async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | null = null;
    const stalledFetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      observedSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        observedSignal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    });
    const pending = createClerkRestMigrationClient("sk_test_private", stalledFetch).users.getUserList(
      { emailAddress: ["customer@example.test"], limit: 2 },
      { signal: controller.signal },
    );
    await vi.waitFor(() => expect(observedSignal).toBe(controller.signal));
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ClerkRetryableRequestError);
    expect(observedSignal!.aborted).toBe(true);
  });

  it("maps SDK-shaped Clerk throttling without exposing its response", async () => {
    const sdkError = Object.assign(new Error("provider payload must remain private"), {
      clerkError: true,
      status: 429,
      retryAfter: 2,
      errors: [{ message: "private provider message" }],
    });
    const client = createClerkRestMigrationClient(
      "sk_test_private",
      vi.fn(async () => { throw sdkError; }),
    );
    const error = await client.users.getUserList(
      { externalId: ["a".repeat(64)], limit: 2 },
      { signal: new AbortController().signal },
    ).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ClerkRetryableRequestError);
    expect((error as ClerkRetryableRequestError).retryAfterMs).toBe(2_000);
    expect(String(error)).not.toContain("private provider message");
  });
});
