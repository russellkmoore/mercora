import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";

import type { ExecutionPlan } from "../../lib/config.js";
import type { AppliedMediaImportResult } from "../media/index.js";
import {
  parseWranglerJsonc,
  resolveDatabaseTarget,
  type WranglerTarget,
} from "../../lib/wrangler-target.js";
import {
  D1_DEPENDENCIES,
  assertExecutionGates,
  buildD1ImportPlan,
  type D1Dependency,
  type D1ImportPlan,
  type D1PlanOptions,
  type MaterializedD1Input,
} from "./plan.js";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(file: string, args: readonly string[]): Promise<CommandResult>;
}

export interface SpawnedCommand {
  stdout: { on(event: "data", listener: (chunk: Buffer) => void): unknown };
  stderr: { on(event: "data", listener: (chunk: Buffer) => void): unknown };
  once(event: "error", listener: () => void): unknown;
  once(event: "close", listener: (code: number | null) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
}

export type SpawnCommand = (
  file: string,
  args: readonly string[],
  options: { shell: false; stdio: ["ignore", "pipe", "pipe"] },
) => SpawnedCommand;

export interface NodeCommandRunnerOptions {
  timeoutMs?: number;
  killGraceMs?: number;
  spawnCommand?: SpawnCommand;
}

export interface PrivateSqlFiles {
  createDirectory(): Promise<string>;
  write(directory: string, filename: string, contents: string): Promise<string>;
  cleanup(directory: string): Promise<void>;
}

export interface ProjectFileStat {
  kind: "file" | "directory";
  size: number;
  mode: number;
}

export interface D1ProjectFiles {
  realpath(path: string): Promise<string>;
  readFile(path: string): Promise<Buffer>;
  stat(path: string): Promise<ProjectFileStat>;
}

export type D1MediaEvidence = AppliedMediaImportResult;

export interface RunD1ImportOptions {
  input: MaterializedD1Input;
  execution: ExecutionPlan;
  /** Absolute, canonical project root containing wrangler.jsonc and local dependencies. */
  projectRoot: string;
  projectFiles?: D1ProjectFiles;
  wranglerEnvironment?: string;
  expectedDatabaseName?: string;
  mediaEvidence?: readonly D1MediaEvidence[];
  commandRunner: CommandRunner;
  /** Receipt from the read-only preflight that ran before non-D1 external writes. */
  preflightReceipt?: D1PreflightReceipt;
  privateFiles?: PrivateSqlFiles;
  planOptions?: Omit<D1PlanOptions, "overwrite">;
}

export interface PreflightD1Options {
  execution: ExecutionPlan;
  /** Absolute, canonical project root containing wrangler.jsonc and local dependencies. */
  projectRoot: string;
  projectFiles?: D1ProjectFiles;
  wranglerEnvironment?: string;
  expectedDatabaseName?: string;
  commandRunner: CommandRunner;
}

export interface D1PreflightReceipt {
  version: 1;
  target: WranglerTarget;
  databaseName: string;
  databaseId: string | null;
  environment: string | null;
  projectDigest: string;
}

export interface D1DryRunResult {
  dryRun: true;
  dependencies: ReadonlyArray<{ dependency: D1Dependency; count: number }>;
  totalRows: number;
  chunkCount: number;
  requiredMediaCount: number;
}

export interface D1ApplyResult {
  dryRun: false;
  dependencies: ReadonlyArray<{ dependency: D1Dependency; count: number }>;
  totalRows: number;
  chunksApplied: number;
  validationsPassed: number;
}

const EXPECTED_MIGRATIONS = [
  "0001_initial_schema.sql",
  "0002_add_admin_users.sql",
  "0003_add_cms_pages.sql",
  "0004_add_mcp_tables.sql",
  "0005_add_reviews_tables.sql",
  "0006_add_review_reminders.sql",
  "0007_add_analytics_cache.sql",
  "0008_add_processed_webhook_events.sql",
  "0009_add_order_effects.sql",
  "0010_add_inventory_adjustments.sql",
  "0011_add_external_refund_restock_setting.sql",
  "0012_expand_mcp_agent_credentials.sql",
  "0013_add_shipping_carrier.sql",
  "0014_add_order_events.sql",
  "0015_normalize_order_timestamps.sql",
  "0016_enforce_order_timestamp_format.sql",
  "0017_add_product_recommendations.sql",
  "0018_add_email_preferences.sql",
  "0019_add_content_publishing.sql",
  "0020_add_redirect_map.sql",
] as const;

const EXPECTED_TABLES = [
  "categories", "products", "product_variants", "inventory", "pages", "page_versions",
  "blog_categories", "blog_posts", "customers", "orders", "product_reviews", "redirect_map",
] as const;

const EXPECTED_INDEXES = [
  "idx_categories_slug", "idx_products_slug", "idx_product_variants_product_id", "idx_inventory_sku",
  "pages_slug_idx", "page_versions_page_id_version_idx", "blog_categories_slug_idx", "blog_posts_slug_idx",
  "idx_customers_type", "idx_orders_customer_id", "product_reviews_product_idx", "redirect_map_source_path_idx",
] as const;

interface ColumnContract {
  table: string;
  name: string;
  type: "TEXT" | "INTEGER";
  notNull: 0 | 1;
  defaultValue: string | null;
  primaryKey: 0 | 1;
}

const TARGET_COLUMN_CONTRACTS: ColumnContract[] = [];
function targetColumns(
  table: string,
  names: readonly string[],
  type: ColumnContract["type"],
  notNull: ColumnContract["notNull"] = 0,
  defaultValue: string | null = null,
  primaryKey: ColumnContract["primaryKey"] = 0,
): void {
  names.forEach((name) => TARGET_COLUMN_CONTRACTS.push({ table, name, type, notNull, defaultValue, primaryKey }));
}

targetColumns("categories", ["id"], "TEXT", 0, null, 1);
targetColumns("categories", ["name"], "TEXT", 1);
targetColumns("categories", ["position"], "INTEGER");
targetColumns("categories", ["product_count"], "INTEGER", 0, "0");
targetColumns("categories", ["status"], "TEXT", 0, "'active'");
targetColumns("categories", ["description", "slug", "parent_id", "path", "external_references", "created_at", "updated_at", "children", "attributes", "tags", "primary_image", "media", "seo", "extensions"], "TEXT");

targetColumns("products", ["id"], "TEXT", 0, null, 1);
targetColumns("products", ["name"], "TEXT", 1);
targetColumns("products", ["status"], "TEXT", 0, "'active'");
targetColumns("products", ["fulfillment_type"], "TEXT", 0, "'physical'");
targetColumns("products", ["type", "external_references", "created_at", "updated_at", "description", "slug", "brand", "categories", "tags", "options", "default_variant_id", "tax_category", "primary_image", "media", "seo", "rating", "related_products", "extensions"], "TEXT");

targetColumns("product_variants", ["id"], "TEXT", 0, null, 1);
targetColumns("product_variants", ["product_id", "sku", "option_values", "price"], "TEXT", 1);
targetColumns("product_variants", ["status"], "TEXT", 0, "'active'");
targetColumns("product_variants", ["position"], "INTEGER");
targetColumns("product_variants", ["shipping_required"], "INTEGER", 0, "1");
targetColumns("product_variants", ["compare_at_price", "cost", "weight", "dimensions", "barcode", "inventory", "tax_category", "media", "attributes", "created_at", "updated_at"], "TEXT");

targetColumns("inventory", ["id"], "TEXT", 0, null, 1);
targetColumns("inventory", ["sku_id", "location_id", "quantities"], "TEXT", 1);
targetColumns("inventory", ["status"], "TEXT", 0, "'active'");
targetColumns("inventory", ["backorderable", "safety_stock", "version"], "INTEGER", 0, "0");
targetColumns("inventory", ["stock_status", "external_references", "created_at", "updated_at", "policy_id", "backorder_eta", "extensions"], "TEXT");

targetColumns("pages", ["id"], "INTEGER", 0, null, 1);
targetColumns("pages", ["title", "slug", "content"], "TEXT", 1);
targetColumns("pages", ["status"], "TEXT", 1, "'draft'");
targetColumns("pages", ["template"], "TEXT", 0, "'default'");
targetColumns("pages", ["published_at", "parent_id"], "INTEGER");
targetColumns("pages", ["sort_order", "show_in_nav", "is_protected"], "INTEGER", 0, "0");
targetColumns("pages", ["created_at", "updated_at"], "INTEGER", 1, "unixepoch()");
targetColumns("pages", ["version"], "INTEGER", 1, "1");
targetColumns("pages", ["excerpt", "meta_title", "meta_description", "meta_keywords", "created_by", "updated_by", "nav_title", "custom_css", "custom_js", "required_roles"], "TEXT");

targetColumns("page_versions", ["id"], "INTEGER", 0, null, 1);
targetColumns("page_versions", ["page_id", "version"], "INTEGER", 1);
targetColumns("page_versions", ["title", "content", "created_by"], "TEXT", 1);
targetColumns("page_versions", ["created_at"], "INTEGER", 1, "unixepoch()");
targetColumns("page_versions", ["excerpt", "meta_title", "meta_description", "meta_keywords", "change_summary"], "TEXT");

targetColumns("blog_categories", ["id"], "INTEGER", 0, null, 1);
targetColumns("blog_categories", ["name", "slug"], "TEXT", 1);
targetColumns("blog_categories", ["description"], "TEXT");
targetColumns("blog_categories", ["created_at", "updated_at"], "INTEGER", 1, "unixepoch()");

targetColumns("blog_posts", ["id"], "INTEGER", 0, null, 1);
targetColumns("blog_posts", ["title", "slug", "author"], "TEXT", 1);
targetColumns("blog_posts", ["tags"], "TEXT", 1, "'[]'");
targetColumns("blog_posts", ["status"], "TEXT", 1, "'draft'");
targetColumns("blog_posts", ["html"], "TEXT", 1, "''");
targetColumns("blog_posts", ["reading_time"], "INTEGER", 1, "1");
targetColumns("blog_posts", ["category_id", "published_at"], "INTEGER");
targetColumns("blog_posts", ["created_at", "updated_at"], "INTEGER", 1, "unixepoch()");
targetColumns("blog_posts", ["excerpt", "cover_image_url", "cover_image_alt", "editor_json", "meta_title", "meta_description", "created_by", "updated_by"], "TEXT");

targetColumns("customers", ["id"], "TEXT", 0, null, 1);
targetColumns("customers", ["type"], "TEXT", 1);
targetColumns("customers", ["status"], "TEXT", 0, "'active'");
targetColumns("customers", ["external_references", "created_at", "updated_at", "person", "company", "contacts", "addresses", "communication_preferences", "segments", "tags", "loyalty", "authentication", "extensions"], "TEXT");

targetColumns("orders", ["id"], "TEXT", 0, null, 1);
targetColumns("orders", ["total_amount", "currency_code", "items"], "TEXT", 1);
targetColumns("orders", ["status", "payment_status"], "TEXT", 0, "'pending'");
targetColumns("orders", ["created_at", "updated_at"], "TEXT", 0, "CURRENT_TIMESTAMP");
targetColumns("orders", ["customer_id", "shipping_address", "billing_address", "shipping_method", "payment_method", "notes", "shipped_at", "delivered_at", "tracking_number", "external_references", "extensions", "shipping_carrier"], "TEXT");

targetColumns("product_reviews", ["id"], "TEXT", 0, null, 1);
targetColumns("product_reviews", ["product_id", "order_id", "customer_id"], "TEXT", 1);
targetColumns("product_reviews", ["rating"], "INTEGER", 1);
targetColumns("product_reviews", ["status"], "TEXT", 1, "'pending'");
targetColumns("product_reviews", ["is_verified"], "INTEGER", 0, "1");
targetColumns("product_reviews", ["submitted_at", "created_at", "updated_at"], "TEXT", 0, "CURRENT_TIMESTAMP");
targetColumns("product_reviews", ["order_item_id", "title", "body", "automated_moderation", "moderation_notes", "admin_response", "response_author_id", "responded_at", "published_at", "metadata"], "TEXT");

targetColumns("redirect_map", ["id"], "INTEGER", 0, null, 1);
targetColumns("redirect_map", ["source_path", "target_path"], "TEXT", 1);
targetColumns("redirect_map", ["status_code"], "INTEGER", 1, "301");
targetColumns("redirect_map", ["entity_type"], "TEXT");
targetColumns("redirect_map", ["created_at"], "INTEGER", 1, "unixepoch()");

export const D1_TARGET_COLUMN_COUNT = TARGET_COLUMN_CONTRACTS.length;

function quotedList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

function quotedValue(value: string | null): string {
  return value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
}

function columnContractValues(): string {
  return TARGET_COLUMN_CONTRACTS.map((contract) =>
    `(${quotedValue(contract.table)}, ${quotedValue(contract.name)}, ${quotedValue(contract.type)}, ` +
    `${contract.notNull}, ${quotedValue(contract.defaultValue)}, ${contract.primaryKey})`).join(",\n    ");
}

export const D1_PREFLIGHT_SQL = `
WITH
  expected_tables(name) AS (VALUES ${EXPECTED_TABLES.map((table) => `(${quotedValue(table)})`).join(", ")}),
  expected_columns(table_name, column_name, column_type, is_not_null, default_value, is_primary_key) AS (
    VALUES ${columnContractValues()}
  )
SELECT
  (SELECT COUNT(*) FROM d1_migrations) AS migration_count,
  (SELECT COUNT(*) FROM d1_migrations WHERE name IN (${quotedList(EXPECTED_MIGRATIONS)})) AS expected_migration_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (${quotedList(EXPECTED_TABLES)})) AS table_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name IN (${quotedList(EXPECTED_INDEXES)})) AS index_count,
  (SELECT COUNT(*) FROM expected_columns) AS target_column_count,
  (
    SELECT COUNT(*) FROM expected_columns AS expected
    JOIN pragma_table_info(expected.table_name) AS actual
      ON actual.name = expected.column_name
      AND upper(actual.type) = expected.column_type
      AND actual."notnull" = expected.is_not_null
      AND actual.dflt_value IS expected.default_value
      AND actual.pk = expected.is_primary_key
  ) AS compatible_target_column_count,
  (
    SELECT COUNT(*) FROM expected_tables AS target
    JOIN pragma_table_info(target.name) AS actual
    LEFT JOIN expected_columns AS expected
      ON expected.table_name = target.name AND expected.column_name = actual.name
    WHERE expected.column_name IS NULL AND actual.pk = 0
      AND actual."notnull" = 1
      AND (actual.dflt_value IS NULL OR upper(trim(actual.dflt_value)) = 'NULL')
  ) AS incompatible_additive_column_count,
  (
    (SELECT COUNT(*) FROM pragma_table_info('categories') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('products') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('product_variants') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('inventory') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('pages') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('page_versions') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('blog_categories') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('blog_posts') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('customers') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('product_reviews') WHERE name = 'id' AND pk = 1) +
    (SELECT COUNT(*) FROM pragma_table_info('redirect_map') WHERE name = 'id' AND pk = 1)
  ) AS primary_key_count,
  (
    (SELECT COUNT(*) FROM pragma_index_list('product_variants') WHERE origin = 'u') +
    (SELECT COUNT(*) FROM pragma_index_list('pages') WHERE origin = 'u') +
    (SELECT COUNT(*) FROM pragma_index_list('blog_categories') WHERE origin = 'u') +
    (SELECT COUNT(*) FROM pragma_index_list('blog_posts') WHERE origin = 'u') +
    (SELECT COUNT(*) FROM pragma_index_list('redirect_map') WHERE origin = 'u')
  ) AS unique_constraint_count,
  (
    (SELECT COUNT(*) FROM pragma_foreign_key_list('categories')) +
    (SELECT COUNT(*) FROM pragma_foreign_key_list('product_variants')) +
    (SELECT COUNT(*) FROM pragma_foreign_key_list('pages')) +
    (SELECT COUNT(*) FROM pragma_foreign_key_list('page_versions')) +
    (SELECT COUNT(*) FROM pragma_foreign_key_list('blog_posts')) +
    (SELECT COUNT(*) FROM pragma_foreign_key_list('orders'))
  ) AS foreign_key_count,
  (SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name = 'shipping_carrier') AS evolved_column_count,
  (
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'categories' AND lower(sql) LIKE '%check%status%active%inactive%archived%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'products' AND lower(sql) LIKE '%check%fulfillment_type%physical%digital%service%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'product_variants' AND lower(sql) LIKE '%check%shipping_required%0%1%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'inventory' AND lower(sql) LIKE '%check%version%0%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'pages' AND lower(sql) LIKE '%check%status%draft%published%archived%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'blog_categories' AND lower(sql) LIKE '%check%length(slug)%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'blog_posts' AND lower(sql) LIKE '%check%reading_time%1440%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'customers' AND lower(sql) LIKE '%check%type%person%company%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'orders' AND lower(sql) LIKE '%check%length(currency_code)%3%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'product_reviews' AND lower(sql) LIKE '%check%status%pending%published%suppressed%') +
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'redirect_map' AND lower(sql) LIKE '%status_code%301%308%')
  ) AS check_constraint_count;
`.trim();

const PREFLIGHT_EXPECTED: Readonly<Record<string, number>> = {
  expected_migration_count: EXPECTED_MIGRATIONS.length,
  table_count: EXPECTED_TABLES.length,
  index_count: EXPECTED_INDEXES.length,
  target_column_count: D1_TARGET_COLUMN_COUNT,
  compatible_target_column_count: D1_TARGET_COLUMN_COUNT,
  incompatible_additive_column_count: 0,
  primary_key_count: EXPECTED_TABLES.length,
  unique_constraint_count: 5,
  foreign_key_count: 6,
  evolved_column_count: 1,
  check_constraint_count: 11,
};

const OUTPUT_LIMIT = 1024 * 1024;
export const DEFAULT_WRANGLER_TIMEOUT_MS = 120_000;
export const MAX_WRANGLER_TIMEOUT_MS = 15 * 60_000;
export const DEFAULT_WRANGLER_KILL_GRACE_MS = 5_000;
export const MAX_WRANGLER_KILL_GRACE_MS = 30_000;

function boundedMilliseconds(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return resolved;
}

/** A bounded no-shell backend. It is never selected implicitly by the runner. */
export function createNodeCommandRunner(options: NodeCommandRunnerOptions = {}): CommandRunner {
  const timeoutMs = boundedMilliseconds(
    options.timeoutMs,
    DEFAULT_WRANGLER_TIMEOUT_MS,
    1_000,
    MAX_WRANGLER_TIMEOUT_MS,
    "timeoutMs",
  );
  const killGraceMs = boundedMilliseconds(
    options.killGraceMs,
    DEFAULT_WRANGLER_KILL_GRACE_MS,
    100,
    MAX_WRANGLER_KILL_GRACE_MS,
    "killGraceMs",
  );
  const spawnCommand: SpawnCommand = options.spawnCommand ?? ((file, args, spawnOptions) =>
    spawn(file, [...args], spawnOptions) as SpawnedCommand);
  return {
    run(file, args) {
      return new Promise((resolve, reject) => {
        let child: SpawnedCommand;
        try {
          child = spawnCommand(file, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
        } catch {
          reject(new Error("Wrangler process could not be started"));
          return;
        }
        let stdout = "";
        let stderr = "";
        let settled = false;
        let terminationReason: "timeout" | "overflow" | undefined;
        let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
        let timeoutTimer: ReturnType<typeof setTimeout>;
        const finish = (result: CommandResult | Error): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutTimer);
          if (forceKillTimer) clearTimeout(forceKillTimer);
          if (result instanceof Error) reject(result);
          else resolve(result);
        };
        const terminate = (reason: "timeout" | "overflow"): void => {
          if (settled || terminationReason) return;
          terminationReason = reason;
          try { child.kill("SIGTERM"); } catch { /* continue to the bounded hard-stop */ }
          forceKillTimer = setTimeout(() => {
            if (settled) return;
            try { child.kill("SIGKILL"); } catch { /* rejection below remains generic */ }
            finish(new Error(reason === "timeout" ? "Wrangler command timed out" : "Wrangler output exceeded the safety limit"));
          }, killGraceMs);
        };
        timeoutTimer = setTimeout(() => terminate("timeout"), timeoutMs);
        const append = (target: "stdout" | "stderr", chunk: Buffer): void => {
          if (settled || terminationReason) return;
          const current = target === "stdout" ? stdout : stderr;
          if (Buffer.byteLength(current, "utf8") + chunk.byteLength > OUTPUT_LIMIT) {
            terminate("overflow");
            return;
          }
          if (target === "stdout") stdout += chunk.toString("utf8");
          else stderr += chunk.toString("utf8");
        };
        child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
        child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
        child.once("error", () => finish(new Error(
          terminationReason === "timeout" ? "Wrangler command timed out"
            : terminationReason === "overflow" ? "Wrangler output exceeded the safety limit"
              : "Wrangler process could not be started",
        )));
        child.once("close", (code) => {
          if (terminationReason) {
            finish(new Error(
              terminationReason === "timeout" ? "Wrangler command timed out" : "Wrangler output exceeded the safety limit",
            ));
          } else finish({ exitCode: code ?? -1, stdout, stderr });
        });
      });
    },
  };
}

export function createPrivateSqlFiles(): PrivateSqlFiles {
  return {
    createDirectory: () => mkdtemp(join(tmpdir(), "mercora-shopify-d1-")),
    async write(directory, filename, contents) {
      if (!isAbsolute(directory) || !/^\d{4}-(?:chunk|validation)\.sql$/.test(filename)) {
        throw new Error("Private SQL file target is invalid");
      }
      const path = join(directory, filename);
      await writeFile(path, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
      return path;
    },
    cleanup: (directory) => rm(directory, { recursive: true, force: true }),
  };
}

export function createD1ProjectFiles(): D1ProjectFiles {
  return {
    realpath,
    readFile,
    async stat(path) {
      const value = await stat(path);
      return {
        kind: value.isFile() ? "file" : value.isDirectory() ? "directory" : (() => {
          throw new Error("D1 project path has an unsupported file type");
        })(),
        size: value.size,
        mode: value.mode,
      };
    },
  };
}

interface D1ProjectSnapshot {
  root: string;
  configPath: string;
  configBytes: Buffer;
  configText: string;
  executablePath: string;
  executableBytes: Buffer;
  packageJsonPath: string;
  packageJsonBytes: Buffer;
}

function projectDigest(snapshot: D1ProjectSnapshot): string {
  const hash = createHash("sha256");
  for (const value of [
    snapshot.root,
    snapshot.configPath,
    snapshot.executablePath,
    snapshot.packageJsonPath,
  ]) hash.update(value, "utf8").update("\0", "utf8");
  hash.update(snapshot.configBytes).update(snapshot.packageJsonBytes).update(snapshot.executableBytes);
  return hash.digest("hex");
}

const MAX_PACKAGE_JSON_BYTES = 256 * 1024;
const MAX_WRANGLER_ENTRY_BYTES = 8 * 1024 * 1024;

function exactChild(root: string, path: string): boolean {
  const child = relative(root, path);
  return child !== "" && child !== ".." && !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(child);
}

async function boundedProjectFile(
  files: D1ProjectFiles,
  path: string,
  maximum: number,
  executable = false,
): Promise<Buffer> {
  const metadata = await files.stat(path);
  if (metadata.kind !== "file" || metadata.size < 1 || metadata.size > maximum ||
      (executable && process.platform !== "win32" && (metadata.mode & 0o111) === 0)) {
    throw new Error("D1 project file does not satisfy the local execution contract");
  }
  const bytes = await files.readFile(path);
  if (bytes.byteLength !== metadata.size || bytes.byteLength > maximum) {
    throw new Error("D1 project file changed while it was being read");
  }
  return Buffer.from(bytes);
}

function wranglerBin(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Local Wrangler package metadata is invalid");
  }
  const packageJson = value as Record<string, unknown>;
  if (packageJson.name !== "wrangler" || typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+/.test(packageJson.version)) {
    throw new Error("Local Wrangler package metadata is invalid");
  }
  const candidate = typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin && typeof packageJson.bin === "object" && !Array.isArray(packageJson.bin)
      ? (packageJson.bin as Record<string, unknown>).wrangler
      : undefined;
  if (typeof candidate !== "string" || !candidate || candidate.length > 512 || isAbsolute(candidate) ||
      candidate.split(/[\\/]/).includes("..") || /[\0\r\n]/.test(candidate)) {
    throw new Error("Local Wrangler package bin metadata is invalid");
  }
  return candidate;
}

async function loadD1ProjectSnapshot(root: string, files: D1ProjectFiles): Promise<D1ProjectSnapshot> {
  if (!isAbsolute(root) || root.length > 4_096 || /[\0\r\n]/.test(root)) {
    throw new Error("D1 project root is invalid");
  }
  const canonicalRoot = await files.realpath(root);
  const rootMetadata = await files.stat(canonicalRoot);
  if (canonicalRoot !== root || rootMetadata.kind !== "directory") {
    throw new Error("D1 project root must be an explicit canonical directory");
  }

  const configPath = join(canonicalRoot, "wrangler.jsonc");
  const packageRoot = join(canonicalRoot, "node_modules", "wrangler");
  const packageJsonPath = join(packageRoot, "package.json");
  const executableShim = join(canonicalRoot, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
  const [canonicalConfig, canonicalPackageRoot, canonicalPackageJson] = await Promise.all([
    files.realpath(configPath),
    files.realpath(packageRoot),
    files.realpath(packageJsonPath),
  ]);
  if (canonicalConfig !== configPath || canonicalPackageRoot !== packageRoot || canonicalPackageJson !== packageJsonPath ||
      !exactChild(canonicalRoot, canonicalPackageRoot)) {
    throw new Error("Wrangler config and package must be local to the canonical project root");
  }
  const [configBytes, packageJsonBytes] = await Promise.all([
    boundedProjectFile(files, configPath, 1024 * 1024),
    boundedProjectFile(files, packageJsonPath, MAX_PACKAGE_JSON_BYTES),
  ]);
  let packageJson: unknown;
  try { packageJson = JSON.parse(packageJsonBytes.toString("utf8")); } catch {
    throw new Error("Local Wrangler package metadata is invalid");
  }
  const expectedExecutable = join(packageRoot, wranglerBin(packageJson));
  const [canonicalShim, canonicalExecutable] = await Promise.all([
    files.realpath(executableShim),
    files.realpath(expectedExecutable),
  ]);
  if (canonicalShim !== canonicalExecutable || canonicalExecutable !== expectedExecutable ||
      !exactChild(packageRoot, canonicalExecutable)) {
    throw new Error("Local Wrangler executable is not owned by the local package");
  }
  const executableBytes = await boundedProjectFile(files, canonicalExecutable, MAX_WRANGLER_ENTRY_BYTES, true);
  return {
    root: canonicalRoot,
    configPath,
    configBytes,
    configText: configBytes.toString("utf8"),
    executablePath: canonicalExecutable,
    executableBytes,
    packageJsonPath,
    packageJsonBytes,
  };
}

async function verifyD1ProjectSnapshot(snapshot: D1ProjectSnapshot, files: D1ProjectFiles): Promise<void> {
  const current = await loadD1ProjectSnapshot(snapshot.root, files);
  if (current.configPath !== snapshot.configPath || current.executablePath !== snapshot.executablePath ||
      current.packageJsonPath !== snapshot.packageJsonPath || !current.configBytes.equals(snapshot.configBytes) ||
      !current.packageJsonBytes.equals(snapshot.packageJsonBytes) || !current.executableBytes.equals(snapshot.executableBytes)) {
    throw new Error("D1 project configuration or local Wrangler changed before execution");
  }
}

function dependencies(plan: D1ImportPlan): Array<{ dependency: D1Dependency; count: number }> {
  return D1_DEPENDENCIES.map((dependency) => ({ dependency, count: plan.counts[dependency] }));
}

function targetArgs(target: WranglerTarget): string[] {
  if (target === "local") return ["--local"];
  if (target === "preview") return ["--remote", "--preview"];
  return ["--remote"];
}

function baseArgs(
  databaseName: string,
  target: WranglerTarget,
  configPath: string,
  environment: string | undefined,
): string[] {
  return [
    "d1", "execute", databaseName,
    ...targetArgs(target),
    "--config", configPath,
    ...(environment ? ["--env", environment] : []),
    "--json",
  ];
}

function exactJsonRow(stdout: string): Record<string, unknown> {
  const json = stdout.trim();
  if (!json) throw new Error("Wrangler JSON response is malformed");
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error("Wrangler JSON response is malformed"); }
  if (!Array.isArray(parsed) || parsed.length !== 1) throw new Error("Wrangler JSON response is ambiguous");
  const result = parsed[0];
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Wrangler JSON result is malformed");
  const envelope = result as Record<string, unknown>;
  if (envelope.success !== true || !Array.isArray(envelope.results) || envelope.results.length !== 1) {
    throw new Error("Wrangler JSON result is unsuccessful or ambiguous");
  }
  const row = envelope.results[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Wrangler JSON row is malformed");
  return row as Record<string, unknown>;
}

function assertPreflight(stdout: string): void {
  const row = exactJsonRow(stdout);
  if (Object.keys(row).length !== Object.keys(PREFLIGHT_EXPECTED).length + 1 ||
      !Number.isSafeInteger(row.migration_count) || (row.migration_count as number) < EXPECTED_MIGRATIONS.length) {
    throw new Error("D1 schema preflight result is incomplete");
  }
  for (const [name, expected] of Object.entries(PREFLIGHT_EXPECTED)) {
    if (row[name] !== expected) throw new Error("D1 schema preflight does not match the required ledger");
  }
}

function assertValidation(stdout: string): void {
  const row = exactJsonRow(stdout);
  if (Object.keys(row).length !== 2 || !Number.isSafeInteger(row.expected_count) || !Number.isSafeInteger(row.actual_count)) {
    throw new Error("D1 post-write validation result is malformed");
  }
  if (row.expected_count !== row.actual_count) throw new Error("D1 post-write validation failed");
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function assertMediaEvidence(paths: readonly string[], evidence: readonly D1MediaEvidence[]): void {
  const byPath = new Map<string, D1MediaEvidence>();
  for (const item of evidence) {
    if (byPath.has(item.publicPath)) throw new Error("D1 media evidence contains duplicate public paths");
    if (!/^(?:products|categories|blog|pages)\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\/(?:cover\/|inline\/)?[1-9][0-9]{0,5}\.(?:jpe?g|png|webp)$/i.test(item.objectKey) ||
        item.publicPath !== `/media/${item.objectKey}`) {
      throw new Error("D1 media evidence path is invalid");
    }
    const extension = item.objectKey.split(".").at(-1)!.toLowerCase();
    if ((item.status !== "written" && item.status !== "verified-existing") ||
        !/^[a-f0-9]{64}$/.test(item.sha256 ?? "") ||
        item.contentType !== CONTENT_TYPES[extension] ||
        !Number.isSafeInteger(item.byteLength) || (item.byteLength ?? 0) < 1 || (item.byteLength ?? 0) > 25 * 1024 * 1024) {
      throw new Error("D1 media evidence is not cryptographically verified");
    }
    byPath.set(item.publicPath, item);
  }
  for (const path of paths) {
    if (!byPath.has(path)) throw new Error("D1 row references media without verified persistence evidence");
  }
}

async function checkedRun(
  commandRunner: CommandRunner,
  executable: string,
  args: readonly string[],
  stage: "preflight" | "chunk" | "validation",
  verifyProject: () => Promise<void>,
): Promise<CommandResult> {
  try {
    await verifyProject();
    const result = await commandRunner.run(executable, args);
    if (result.exitCode !== 0) throw new Error("nonzero");
    return result;
  } catch {
    throw new Error(`D1 ${stage} failed`);
  }
}

function receiptFor(
  project: D1ProjectSnapshot,
  target: ReturnType<typeof resolveDatabaseTarget>,
): D1PreflightReceipt {
  return {
    version: 1,
    target: target.target,
    databaseName: target.databaseName,
    databaseId: target.databaseId ?? null,
    environment: target.environment ?? null,
    projectDigest: projectDigest(project),
  };
}

function assertPreflightReceipt(
  receipt: D1PreflightReceipt,
  project: D1ProjectSnapshot,
  target: ReturnType<typeof resolveDatabaseTarget>,
): void {
  const expected = receiptFor(project, target);
  if (
    receipt.version !== expected.version || receipt.target !== expected.target ||
    receipt.databaseName !== expected.databaseName || receipt.databaseId !== expected.databaseId ||
    receipt.environment !== expected.environment || receipt.projectDigest !== expected.projectDigest
  ) {
    throw new Error("D1 preflight receipt does not match the current canonical target");
  }
}

/**
 * Execute the canonical target/schema/ledger query without creating SQL files
 * or running any mutating statement. Call this before R2 or Clerk apply phases.
 */
export async function preflightD1Target(options: PreflightD1Options): Promise<D1PreflightReceipt> {
  assertExecutionGates(options.execution, false);
  if (options.execution.dryRun || !options.execution.apply) {
    throw new Error("D1 target preflight is reserved for confirmed apply runs");
  }
  const projectFiles = options.projectFiles ?? createD1ProjectFiles();
  const project = await loadD1ProjectSnapshot(options.projectRoot, projectFiles);
  const verifyProject = () => verifyD1ProjectSnapshot(project, projectFiles);
  const target = resolveDatabaseTarget(parseWranglerJsonc(project.configText), {
    target: options.execution.target,
    ...(options.wranglerEnvironment ? { environment: options.wranglerEnvironment } : {}),
    ...(options.expectedDatabaseName ? { expectedName: options.expectedDatabaseName } : {}),
  });
  const result = await checkedRun(
    options.commandRunner,
    project.executablePath,
    [...baseArgs(target.databaseName, target.target, project.configPath, target.environment), "--command", D1_PREFLIGHT_SQL],
    "preflight",
    verifyProject,
  );
  try { assertPreflight(result.stdout); } catch { throw new Error("D1 preflight failed"); }
  await verifyProject();
  return receiptFor(project, target);
}

export async function runD1Import(options: RunD1ImportOptions): Promise<D1DryRunResult | D1ApplyResult> {
  const plan = buildD1ImportPlan(options.input, { ...options.planOptions, overwrite: options.execution.overwrite });
  assertExecutionGates(options.execution, plan.containsSensitiveRows);
  const projectFiles = options.projectFiles ?? createD1ProjectFiles();
  const project = await loadD1ProjectSnapshot(options.projectRoot, projectFiles);
  const verifyProject = () => verifyD1ProjectSnapshot(project, projectFiles);
  const wranglerConfig = parseWranglerJsonc(project.configText);
  const target = resolveDatabaseTarget(wranglerConfig, {
    target: options.execution.target,
    ...(options.wranglerEnvironment ? { environment: options.wranglerEnvironment } : {}),
    ...(options.expectedDatabaseName ? { expectedName: options.expectedDatabaseName } : {}),
  });
  const dependencyCounts = dependencies(plan);
  const totalRows = dependencyCounts.reduce((sum, item) => sum + item.count, 0);

  if (options.execution.dryRun) {
    return {
      dryRun: true,
      dependencies: dependencyCounts,
      totalRows,
      chunkCount: plan.chunks.length,
      requiredMediaCount: plan.requiredMediaPaths.length,
    };
  }

  if (options.preflightReceipt) assertPreflightReceipt(options.preflightReceipt, project, target);

  assertMediaEvidence(plan.requiredMediaPaths, options.mediaEvidence ?? []);
  const commandBase = baseArgs(target.databaseName, target.target, project.configPath, target.environment);

  const preflight = await checkedRun(
    options.commandRunner,
    project.executablePath,
    [...commandBase, "--command", D1_PREFLIGHT_SQL],
    "preflight",
    verifyProject,
  );
  try { assertPreflight(preflight.stdout); } catch { throw new Error("D1 preflight failed"); }

  const privateFiles = options.privateFiles ?? createPrivateSqlFiles();
  let directory: string | undefined;
  let failure: Error | undefined;
  try {
    directory = await privateFiles.createDirectory();
    for (let index = 0; index < plan.chunks.length; index += 1) {
      const path = await privateFiles.write(directory, `${String(index + 1).padStart(4, "0")}-chunk.sql`, plan.chunks[index]);
      await checkedRun(options.commandRunner, project.executablePath, [...commandBase, "--file", path], "chunk", verifyProject);
    }
    for (let index = 0; index < plan.validation.length; index += 1) {
      const unit = plan.validation[index];
      const path = await privateFiles.write(
        directory,
        `${String(index + 1).padStart(4, "0")}-validation.sql`,
        `${unit.sql}\n`,
      );
      const result = await checkedRun(
        options.commandRunner,
        project.executablePath,
        [...commandBase, "--file", path],
        "validation",
        verifyProject,
      );
      try { assertValidation(result.stdout); } catch { throw new Error("D1 validation failed"); }
    }
  } catch (error) {
    failure = error instanceof Error && /^D1 (?:chunk|validation) failed$/.test(error.message)
      ? error
      : new Error("D1 import failed");
  } finally {
    if (directory) {
      try { await privateFiles.cleanup(directory); } catch {
        failure ??= new Error("D1 private SQL cleanup failed");
      }
    }
  }
  if (failure) throw failure;

  return {
    dryRun: false,
    dependencies: dependencyCounts,
    totalRows,
    chunksApplied: plan.chunks.length,
    validationsPassed: plan.validation.length,
  };
}
