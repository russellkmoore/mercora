import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ClerkRetryableRequestError,
  provisionClerkCustomers,
  type ClerkMigrationUser,
  type ClerkRequestContext,
} from "./adapters/clerk/index.js";
import { createNodeCommandRunner, preflightD1Target, runD1Import } from "./adapters/d1/index.js";
import { createR2S3MediaStore, importMediaPlans } from "./adapters/media/index.js";
import { extractFileRecords } from "./extractors/file-based/index.js";
import { extractFromShopifyApi } from "./extractors/shopify-api/index.js";
import { parseMigrationConfig, type Environment, type MigrationConfig } from "./lib/config.js";
import { readCsvFile, readJsonFile } from "./lib/file-reader.js";
import { writeManifest } from "./lib/id-map.js";
import { ShopifyClient } from "./lib/shopify-api.js";
import type {
  JudgeMeFileRow,
  ShopifyArticle,
  ShopifyBlog,
  ShopifyCollect,
  ShopifyCollection,
  ShopifyCustomer,
  ShopifyOrder,
  ShopifyPage,
  ShopifyProduct,
  ShopifyRedirect,
} from "./lib/types.js";
import {
  orchestrateMigration,
  type MigrationApplyFactories,
  type MigrationDomainOptions,
  type MigrationRunReport,
  type MigrationSource,
  type MigrationSourceBundle,
  type TargetBoundClerkMigrationClient,
} from "./orchestrator.js";
import type { ImportedReviewAttribution, VerifiedReviewProvenance } from "./transformers/sensitive/index.js";

const EXTRA_VALUE_FLAGS = new Set([
  "--currency",
  "--inventory-location-id",
  "--fulfillment-type",
  "--actor-id",
  "--fallback-author",
  "--media-host",
  "--unresolved-customer",
  "--project-root",
  "--expected-database-name",
  "--judge-me-file",
  "--review-attributions",
  "--verified-purchases",
  "--expected-shopify-order-count",
]);
const EXTRA_BOOLEAN_FLAGS = new Set(["--confirm-shopify-read-all-orders"]);
const MAX_MIGRATION_BLOGS = 1_000;
const MAX_MIGRATION_ARTICLES = 50_000;
const MAX_ARTICLES_PER_BLOG = 10_000;

interface ReviewAttributionRow extends ImportedReviewAttribution {
  reviewFingerprint: string;
}

interface VerifiedPurchaseRow extends VerifiedReviewProvenance {
  reviewFingerprint: string;
}

export interface ParsedMigrationCli {
  config: MigrationConfig;
  domain: Omit<MigrationDomainOptions, "reviewAttributions" | "verifiedPurchases">;
  projectRoot: string;
  expectedDatabaseName?: string;
  judgeMeFile?: string;
  reviewAttributionsFile?: string;
  verifiedPurchasesFile?: string;
  expectedShopifyOrderCount?: number;
  remoteTargetBinding?: { cloudflareAccountId?: string; clerkInstanceId?: string };
}

export interface MigrationCliDependencies {
  args?: readonly string[];
  env?: Environment;
  cwd?: string;
  stdout?: (line: string) => void;
  now?: () => Date;
  createSource?: (config: MigrationConfig, parsed: ParsedMigrationCli) => MigrationSource;
  applyFactories?: MigrationApplyFactories;
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function ownValues(args: readonly string[], name: string): string[] {
  return args.filter((argument) => argument.startsWith(`${name}=`)).map((argument) => argument.slice(name.length + 1));
}

function ownValue(args: readonly string[], name: string, fallback?: string): string | undefined {
  const values = ownValues(args, name);
  if (values.length > 1) throw new Error(`${name} may only be provided once`);
  return values[0] ?? fallback;
}

function checkedRelativeFile(value: string | undefined, name: string): string | undefined {
  if (value === undefined) return undefined;
  const path = required(value, name);
  if (isAbsolute(path) || path.includes("\0") || path.startsWith("-") || /(?:^|[/\\])\.\.(?:[/\\]|$)/u.test(path)) {
    throw new Error(`${name} must be a relative file within the migration input root`);
  }
  return path;
}

function safeName(value: string | undefined, name: string, maximum = 255): string {
  const result = required(value, name);
  if (result.length > maximum || /[\0\r\n]/u.test(result)) throw new Error(`${name} is invalid`);
  return result;
}

function configArgs(args: readonly string[]): string[] {
  return args.filter((argument) => {
    if (EXTRA_BOOLEAN_FLAGS.has(argument)) return false;
    const equals = argument.indexOf("=");
    return equals < 0 || !EXTRA_VALUE_FLAGS.has(argument.slice(0, equals));
  });
}

export function parseMigrationCli(
  env: Environment = process.env,
  args: readonly string[] = process.argv.slice(2),
  cwd = process.cwd(),
): ParsedMigrationCli {
  for (const argument of args) {
    const equals = argument.indexOf("=");
    if (equals > 0 && EXTRA_VALUE_FLAGS.has(argument.slice(0, equals))) continue;
    if ([...EXTRA_VALUE_FLAGS].some((flag) => argument === flag)) throw new Error(`${argument} requires a value`);
    if (EXTRA_BOOLEAN_FLAGS.has(argument)) continue;
  }
  const config = parseMigrationConfig(env, configArgs(args), cwd);
  const fulfillmentType = ownValue(args, "--fulfillment-type", env.MIGRATION_FULFILLMENT_TYPE);
  if (fulfillmentType !== "physical" && fulfillmentType !== "digital" && fulfillmentType !== "service") {
    throw new Error("MIGRATION_FULFILLMENT_TYPE must be physical, digital, or service");
  }
  const unresolvedCustomer = ownValue(args, "--unresolved-customer", env.MIGRATION_UNRESOLVED_CUSTOMER);
  if (unresolvedCustomer !== "reject" && unresolvedCustomer !== "guest") {
    throw new Error("MIGRATION_UNRESOLVED_CUSTOMER must explicitly be reject or guest");
  }
  const argumentHosts = ownValues(args, "--media-host");
  const environmentHosts = env.MIGRATION_MEDIA_HOSTS?.split(",") ?? [];
  const allowedMediaHosts = (argumentHosts.length ? argumentHosts : environmentHosts).map((host) => host.trim()).filter(Boolean);
  if (!allowedMediaHosts.length) throw new Error("At least one explicit --media-host or MIGRATION_MEDIA_HOSTS value is required");
  if (new Set(allowedMediaHosts.map((host) => host.toLowerCase())).size !== allowedMediaHosts.length) {
    throw new Error("Migration media hosts must be unique");
  }

  const projectRoot = resolve(cwd, ownValue(args, "--project-root", env.MIGRATION_PROJECT_ROOT) ?? ".");
  const judgeMeFile = checkedRelativeFile(ownValue(args, "--judge-me-file", env.JUDGE_ME_FILE), "JUDGE_ME_FILE");
  const reviewAttributionsFile = checkedRelativeFile(
    ownValue(args, "--review-attributions", env.MIGRATION_REVIEW_ATTRIBUTIONS),
    "MIGRATION_REVIEW_ATTRIBUTIONS",
  );
  const verifiedPurchasesFile = checkedRelativeFile(
    ownValue(args, "--verified-purchases", env.MIGRATION_VERIFIED_PURCHASES),
    "MIGRATION_VERIFIED_PURCHASES",
  );
  if ((judgeMeFile || reviewAttributionsFile || verifiedPurchasesFile) && !config.execution.includeSensitive) {
    throw new Error("Judge.me inputs require --include-sensitive and --confirm-sensitive-data");
  }
  if ((reviewAttributionsFile || verifiedPurchasesFile) && !judgeMeFile) {
    throw new Error("Review attribution inputs require a Judge.me file");
  }
  if (judgeMeFile && !config.inputRoot) {
    throw new Error("Judge.me file input requires MIGRATION_INPUT_ROOT even when Shopify API extraction is used");
  }
  const confirmReadAllCount = args.filter((argument) => argument === "--confirm-shopify-read-all-orders").length;
  if (confirmReadAllCount > 1) throw new Error("--confirm-shopify-read-all-orders may only be provided once");
  const confirmedReadAllOrders = confirmReadAllCount === 1 || env.MIGRATION_CONFIRM_SHOPIFY_READ_ALL_ORDERS === "1";
  const expectedOrderCountValue = ownValue(
    args,
    "--expected-shopify-order-count",
    env.MIGRATION_EXPECTED_SHOPIFY_ORDER_COUNT,
  );
  let expectedShopifyOrderCount: number | undefined;
  if (expectedOrderCountValue !== undefined) {
    if (!/^(?:0|[1-9][0-9]{0,7})$/u.test(expectedOrderCountValue)) {
      throw new Error("Expected Shopify order count must be an integer from 0 to 99,999,999");
    }
    expectedShopifyOrderCount = Number(expectedOrderCountValue);
  }
  if (config.sourceMode === "api" && config.execution.includeSensitive) {
    if (!confirmedReadAllOrders) {
      throw new Error("Historical order API extraction requires --confirm-shopify-read-all-orders");
    }
    if (expectedShopifyOrderCount === undefined) {
      throw new Error("Historical order API extraction requires an expected Shopify order count");
    }
  } else if (confirmedReadAllOrders || expectedShopifyOrderCount !== undefined) {
    throw new Error("Shopify read_all_orders confirmation and count are only valid for sensitive API extraction");
  }

  const remoteTargetBinding = config.execution.apply && config.execution.target !== "local"
    ? {
      cloudflareAccountId: safeName(
        env.MIGRATION_CLOUDFLARE_ACCOUNT_ID,
        "MIGRATION_CLOUDFLARE_ACCOUNT_ID",
        32,
      ).toLowerCase(),
      ...(env.MIGRATION_CLERK_INSTANCE_ID
        ? { clerkInstanceId: safeName(env.MIGRATION_CLERK_INSTANCE_ID, "MIGRATION_CLERK_INSTANCE_ID", 204) }
        : {}),
    }
    : undefined;
  if (remoteTargetBinding && !/^[a-f0-9]{32}$/u.test(remoteTargetBinding.cloudflareAccountId)) {
    throw new Error("MIGRATION_CLOUDFLARE_ACCOUNT_ID must be a 32-character account ID");
  }
  if (remoteTargetBinding?.clerkInstanceId && !/^ins_[A-Za-z0-9_-]{4,200}$/u.test(remoteTargetBinding.clerkInstanceId)) {
    throw new Error("MIGRATION_CLERK_INSTANCE_ID is invalid");
  }

  return {
    config,
    domain: {
      currency: safeName(ownValue(args, "--currency", env.MIGRATION_CURRENCY), "MIGRATION_CURRENCY", 3).toUpperCase(),
      inventoryLocationId: safeName(
        ownValue(args, "--inventory-location-id", env.MIGRATION_INVENTORY_LOCATION_ID),
        "MIGRATION_INVENTORY_LOCATION_ID",
        200,
      ),
      fulfillmentType,
      actorId: safeName(ownValue(args, "--actor-id", env.MIGRATION_ACTOR_ID), "MIGRATION_ACTOR_ID"),
      fallbackAuthor: safeName(ownValue(args, "--fallback-author", env.MIGRATION_FALLBACK_AUTHOR), "MIGRATION_FALLBACK_AUTHOR", 160),
      allowedMediaHosts,
      unresolvedCustomer,
    },
    projectRoot,
    ...(ownValue(args, "--expected-database-name", env.MIGRATION_DATABASE_NAME)
      ? { expectedDatabaseName: safeName(ownValue(args, "--expected-database-name", env.MIGRATION_DATABASE_NAME), "MIGRATION_DATABASE_NAME", 128) }
      : {}),
    ...(judgeMeFile ? { judgeMeFile } : {}),
    ...(reviewAttributionsFile ? { reviewAttributionsFile } : {}),
    ...(verifiedPurchasesFile ? { verifiedPurchasesFile } : {}),
    ...(expectedShopifyOrderCount !== undefined ? { expectedShopifyOrderCount } : {}),
    ...(remoteTargetBinding ? { remoteTargetBinding } : {}),
  };
}

function emptySensitive(): Pick<MigrationSourceBundle, "customers" | "orders" | "judgeMeRows"> {
  return { customers: [], orders: [], judgeMeRows: [] };
}

export function createFileMigrationSource(config: MigrationConfig, parsed: ParsedMigrationCli): MigrationSource {
  const root = config.inputRoot!;
  return {
    async extract(includeSensitive) {
      const custom = extractFileRecords<ShopifyCollection>(root, "custom_collections").records.map((record) => ({
        ...record,
        collection_type: "custom" as const,
      }));
      const smart = extractFileRecords<ShopifyCollection>(root, "smart_collections").records.map((record) => ({
        ...record,
        collection_type: "smart" as const,
      }));
      const sensitive = includeSensitive ? {
        customers: extractFileRecords<ShopifyCustomer>(root, "customers").records,
        orders: extractFileRecords<ShopifyOrder>(root, "orders").records,
        judgeMeRows: parsed.judgeMeFile
          ? readCsvFile<Record<string, string>>(root, parsed.judgeMeFile) as JudgeMeFileRow[]
          : [],
      } : emptySensitive();
      return {
        collections: [...custom, ...smart],
        collects: extractFileRecords<ShopifyCollect>(root, "collects").records,
        products: extractFileRecords<ShopifyProduct>(root, "products").records,
        pages: extractFileRecords<ShopifyPage>(root, "pages").records,
        blogs: extractFileRecords<ShopifyBlog>(root, "blogs").records,
        articles: extractFileRecords<ShopifyArticle>(root, "articles").records,
        redirects: extractFileRecords<ShopifyRedirect>(root, "redirects").records,
        ...sensitive,
      };
    },
  };
}

export function createShopifyApiMigrationSource(config: MigrationConfig, parsed: ParsedMigrationCli): MigrationSource {
  const shopify = config.shopify!;
  return {
    async extract(includeSensitive) {
      const client = new ShopifyClient({ ...shopify, includeSensitive });
      const [custom, smart, collects, products, pages, blogs, redirects, customers, orders] = await Promise.all([
        extractFromShopifyApi<ShopifyCollection>(client, "custom_collections.json", "custom_collections"),
        extractFromShopifyApi<ShopifyCollection>(client, "smart_collections.json", "smart_collections"),
        extractFromShopifyApi<ShopifyCollect>(client, "collects.json", "collects"),
        extractFromShopifyApi<ShopifyProduct>(client, "products.json", "products"),
        extractFromShopifyApi<ShopifyPage>(client, "pages.json", "pages"),
        extractFromShopifyApi<ShopifyBlog>(client, "blogs.json", "blogs"),
        extractFromShopifyApi<ShopifyRedirect>(client, "redirects.json", "redirects"),
        includeSensitive
          ? extractFromShopifyApi<ShopifyCustomer>(client, "customers.json", "customers")
          : Promise.resolve({ records: [] as ShopifyCustomer[] }),
        includeSensitive
          ? extractFromShopifyApi<ShopifyOrder>(client, "orders.json", "orders", { query: { status: "any" } })
          : Promise.resolve({ records: [] as ShopifyOrder[] }),
      ]);
      if (blogs.records.length > MAX_MIGRATION_BLOGS) {
        throw new Error("Shopify blog count exceeds the migration safety limit");
      }
      const articles: ShopifyArticle[] = [];
      for (const blog of blogs.records) {
        const id = String(blog.id);
        if (!/^[1-9][0-9]*$/u.test(id)) throw new Error("Shopify blog ID is invalid for article extraction");
        const remaining = MAX_MIGRATION_ARTICLES - articles.length;
        if (remaining < 1) throw new Error("Shopify article count exceeds the migration safety limit");
        const result = await extractFromShopifyApi<ShopifyArticle>(
          client,
          `blogs/${id}/articles.json`,
          "articles",
          { maxRecords: Math.min(MAX_ARTICLES_PER_BLOG, remaining) },
        );
        articles.push(...result.records);
      }
      if (includeSensitive && orders.records.length !== parsed.expectedShopifyOrderCount) {
        throw new Error("Shopify historical order count does not match the confirmed source count");
      }
      return {
        collections: [
          ...custom.records.map((record) => ({ ...record, collection_type: "custom" as const })),
          ...smart.records.map((record) => ({ ...record, collection_type: "smart" as const })),
        ],
        collects: collects.records,
        products: products.records,
        pages: pages.records,
        blogs: blogs.records,
        articles,
        redirects: redirects.records,
        customers: customers.records,
        orders: orders.records,
        judgeMeRows: includeSensitive && parsed.judgeMeFile
          ? readCsvFile<Record<string, string>>(config.inputRoot!, parsed.judgeMeFile) as JudgeMeFileRow[]
          : [],
      };
    },
  };
}

function keyedRows<T extends { reviewFingerprint: string }>(rows: readonly T[], name: string): Map<string, Omit<T, "reviewFingerprint">> {
  const result = new Map<string, Omit<T, "reviewFingerprint">>();
  for (const row of rows) {
    if (!/^[a-f0-9]{64}$/u.test(row.reviewFingerprint) || result.has(row.reviewFingerprint)) {
      throw new Error(`${name} contains an invalid or duplicate review fingerprint`);
    }
    const { reviewFingerprint, ...value } = row;
    result.set(reviewFingerprint, value);
  }
  return result;
}

function canonicalProjectConfig(projectRoot: string): { projectRoot: string; text: string } {
  const canonicalRoot = realpathSync(projectRoot);
  if (canonicalRoot !== projectRoot || !lstatSync(canonicalRoot).isDirectory()) {
    throw new Error("Migration project root must be an explicit canonical directory");
  }
  const configPath = join(canonicalRoot, "wrangler.jsonc");
  if (realpathSync(configPath) !== configPath || !lstatSync(configPath).isFile() || lstatSync(configPath).size > 1024 * 1024) {
    throw new Error("Migration Wrangler configuration must be a bounded canonical file");
  }
  return { projectRoot: canonicalRoot, text: readFileSync(configPath, "utf8") };
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

/** Reject migration artifacts that could be committed with the application source. */
export function assertPrivateMigrationRoots(config: MigrationConfig, projectRoot: string): void {
  const canonicalRoots = [
    ...(config.inputRoot ? [["input", config.inputRoot] as const] : []),
    ...(config.outputRoot ? [["output", config.outputRoot] as const] : []),
  ].map(([name, path]) => {
    const canonical = realpathSync(path);
    if (canonical !== path || !lstatSync(canonical).isDirectory()) {
      throw new Error(`Migration ${name} root must be an existing canonical directory`);
    }
    if (isWithin(projectRoot, canonical)) {
      throw new Error(`Migration ${name} root must be outside the project repository`);
    }
    return [name, canonical] as const;
  });
  if (canonicalRoots.length === 2 && canonicalRoots[0][1] === canonicalRoots[1][1]) {
    throw new Error("Migration input and output roots must be separate directories");
  }
}

const CLERK_USERS_URL = "https://api.clerk.com/v1/users";
const CLERK_INSTANCE_URL = "https://api.clerk.com/v1/instance";
const MAX_CLERK_RESPONSE_BYTES = 1024 * 1024;
const CLERK_INSTANCE_TIMEOUT_MS = 30_000;

function retryAfterMilliseconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function boundedClerkJson(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^(?:0|[1-9][0-9]*)$/u.test(declared) || Number(declared) > MAX_CLERK_RESPONSE_BYTES)) {
    void response.body?.cancel();
    throw new Error("Clerk migration response exceeds its safety limit");
  }
  if (!response.body) throw new Error("Clerk migration response body is missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_CLERK_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Clerk migration response exceeds its safety limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Clerk migration response is invalid");
  }
}

async function clerkRequest(
  secretKey: string,
  fetchImplementation: typeof fetch,
  url: URL,
  init: RequestInit & { signal: AbortSignal },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImplementation(url, {
      ...init,
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${secretKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch (error) {
    if (error && typeof error === "object") {
      const shaped = error as { clerkError?: unknown; status?: unknown; retryAfter?: unknown };
      const status = typeof shaped.status === "number" ? shaped.status : undefined;
      if (
        shaped.clerkError === true && status !== undefined && (status === 429 || status >= 500) &&
        (shaped.retryAfter === undefined || (typeof shaped.retryAfter === "number" && Number.isFinite(shaped.retryAfter)))
      ) {
        const retryAfter = typeof shaped.retryAfter === "number" && shaped.retryAfter >= 0
          ? Math.ceil(shaped.retryAfter * 1_000)
          : undefined;
        throw new ClerkRetryableRequestError(retryAfter);
      }
      if (shaped.clerkError === true && status !== undefined) {
        throw new Error("Clerk migration request was rejected");
      }
    }
    throw new ClerkRetryableRequestError();
  }
  if (response.status === 429 || response.status >= 500) {
    void response.body?.cancel();
    throw new ClerkRetryableRequestError(retryAfterMilliseconds(response.headers.get("retry-after")));
  }
  if (!response.ok) {
    void response.body?.cancel();
    throw new Error("Clerk migration request was rejected");
  }
  return await boundedClerkJson(response);
}

function clerkUser(value: unknown): ClerkMigrationUser {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Clerk migration user response is invalid");
  }
  const record = value as { id?: unknown; external_id?: unknown };
  if (
    typeof record.id !== "string" ||
    (record.external_id !== null && record.external_id !== undefined && typeof record.external_id !== "string")
  ) {
    throw new Error("Clerk migration user response is invalid");
  }
  return { id: record.id, externalId: typeof record.external_id === "string" ? record.external_id : null };
}

/** Minimal abortable Clerk Backend API client for migration-only user calls. */
export function createClerkRestMigrationClient(
  secretKey: string,
  fetchImplementation: typeof fetch = fetch,
): TargetBoundClerkMigrationClient {
  if (!secretKey || secretKey.length > 2_048 || /[\0\r\n]/u.test(secretKey)) {
    throw new Error("CLERK_SECRET_KEY is invalid");
  }
  const contextSignal = (context: ClerkRequestContext | undefined): AbortSignal => {
    if (!context?.signal) throw new Error("Clerk migration requests require a bounded abort signal");
    return context.signal;
  };
  return {
    async verifyTarget(instanceId, environmentType) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CLERK_INSTANCE_TIMEOUT_MS);
      let value: unknown;
      try {
        value = await clerkRequest(secretKey, fetchImplementation, new URL(CLERK_INSTANCE_URL), {
          method: "GET",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Clerk instance response is invalid");
      }
      const instance = value as { id?: unknown; environment_type?: unknown; environmentType?: unknown };
      const actualEnvironment = instance.environment_type ?? instance.environmentType;
      if (instance.id !== instanceId || actualEnvironment !== environmentType) {
        throw new Error("Clerk credential instance does not match the confirmed migration target");
      }
    },
    users: {
      async getUserList(params, context) {
        const url = new URL(CLERK_USERS_URL);
        params.externalId?.forEach((value) => url.searchParams.append("external_id", value));
        params.emailAddress?.forEach((value) => url.searchParams.append("email_address", value));
        url.searchParams.set("limit", String(params.limit));
        const value = await clerkRequest(secretKey, fetchImplementation, url, {
          method: "GET",
          signal: contextSignal(context),
        });
        if (!Array.isArray(value)) throw new Error("Clerk migration user list is invalid");
        return { data: value.map(clerkUser) };
      },
      async createUser(params, context) {
        const value = await clerkRequest(secretKey, fetchImplementation, new URL(CLERK_USERS_URL), {
          method: "POST",
          signal: contextSignal(context),
          body: JSON.stringify({
            email_address: [...params.emailAddress],
            ...(params.firstName ? { first_name: params.firstName } : {}),
            ...(params.lastName ? { last_name: params.lastName } : {}),
            external_id: params.externalId,
            skip_legal_checks: params.skipLegalChecks,
          }),
        });
        return clerkUser(value);
      },
    },
  };
}

function defaultFactories(env: Environment): MigrationApplyFactories {
  return {
    createMediaStore(bucketName, cloudflareAccountId) {
      const credentialAccountId = required(env.CLOUDFLARE_ACCOUNT_ID, "CLOUDFLARE_ACCOUNT_ID").toLowerCase();
      if (credentialAccountId !== cloudflareAccountId) {
        throw new Error("R2 credential account does not match the confirmed migration target");
      }
      return createR2S3MediaStore({
        bucketName,
        accountId: cloudflareAccountId,
        accessKeyId: required(env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID"),
        secretAccessKey: required(env.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY"),
      });
    },
    async createClerkClient(clerkInstanceId): Promise<TargetBoundClerkMigrationClient> {
      if (required(env.MIGRATION_CLERK_INSTANCE_ID, "MIGRATION_CLERK_INSTANCE_ID") !== clerkInstanceId) {
        throw new Error("Clerk credentials do not match the confirmed migration target");
      }
      return createClerkRestMigrationClient(required(env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY"));
    },
    createCommandRunner: () => createNodeCommandRunner(),
  };
}

export async function runMigrationCli(dependencies: MigrationCliDependencies = {}): Promise<MigrationRunReport> {
  const env = dependencies.env ?? process.env;
  const cwd = dependencies.cwd ?? process.cwd();
  const parsed = parseMigrationCli(env, dependencies.args ?? process.argv.slice(2), cwd);
  const project = canonicalProjectConfig(parsed.projectRoot);
  assertPrivateMigrationRoots(parsed.config, project.projectRoot);
  const inputRoot = parsed.config.inputRoot;
  const reviewAttributions = parsed.reviewAttributionsFile
    ? keyedRows(readJsonFile<ReviewAttributionRow>(inputRoot!, parsed.reviewAttributionsFile), "Review attributions")
    : new Map<string, ImportedReviewAttribution>();
  const verifiedPurchases = parsed.verifiedPurchasesFile
    ? keyedRows(readJsonFile<VerifiedPurchaseRow>(inputRoot!, parsed.verifiedPurchasesFile), "Verified purchases")
    : undefined;
  const source = dependencies.createSource?.(parsed.config, parsed)
    ?? (parsed.config.sourceMode === "file"
      ? createFileMigrationSource(parsed.config, parsed)
      : createShopifyApiMigrationSource(parsed.config, parsed));
  const report = await orchestrateMigration({
    config: parsed.config,
    domain: {
      ...parsed.domain,
      reviewAttributions,
      ...(verifiedPurchases ? { verifiedPurchases } : {}),
    },
    source,
    projectRoot: project.projectRoot,
    wranglerConfigText: project.text,
    ...(parsed.expectedDatabaseName ? { expectedDatabaseName: parsed.expectedDatabaseName } : {}),
    ...(parsed.remoteTargetBinding ? { remoteTargetBinding: parsed.remoteTargetBinding } : {}),
    ...(parsed.config.execution.apply ? { applyFactories: dependencies.applyFactories ?? defaultFactories(env) } : {}),
    runners: {
      preflightD1: preflightD1Target,
      importMedia: importMediaPlans,
      provisionClerk: provisionClerkCustomers,
      runD1: runD1Import,
    },
    ...(dependencies.now ? { now: dependencies.now } : {}),
  });
  if (parsed.config.execution.apply && parsed.config.outputRoot) {
    writeManifest(parsed.config.outputRoot, "manifest.json", {
      version: 1,
      authoritative: false,
      generatedAt: report.generatedAt,
      dryRun: report.dryRun,
      target: report.target,
      entities: report.entities,
    });
  }
  (dependencies.stdout ?? console.log)(JSON.stringify(report));
  return report;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  runMigrationCli().catch((error: unknown) => {
    const name = error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/u.test(error.name) ? error.name : "Error";
    console.error(JSON.stringify({ success: false, errorClass: name }));
    process.exitCode = 1;
  });
}
