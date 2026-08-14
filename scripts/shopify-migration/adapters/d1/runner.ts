import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

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

export interface PrivateSqlFiles {
  createDirectory(): Promise<string>;
  write(directory: string, filename: string, contents: string): Promise<string>;
  cleanup(directory: string): Promise<void>;
}

export type D1MediaEvidence = AppliedMediaImportResult;

export interface RunD1ImportOptions {
  input: MaterializedD1Input;
  execution: ExecutionPlan;
  wranglerConfigText: string;
  wranglerConfigPath: string;
  wranglerEnvironment?: string;
  expectedDatabaseName?: string;
  mediaEvidence?: readonly D1MediaEvidence[];
  commandRunner: CommandRunner;
  privateFiles?: PrivateSqlFiles;
  planOptions?: Omit<D1PlanOptions, "overwrite">;
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

function quotedList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

export const D1_PREFLIGHT_SQL = `
SELECT
  (SELECT COUNT(*) FROM d1_migrations) AS migration_count,
  (SELECT COUNT(*) FROM d1_migrations WHERE name IN (${quotedList(EXPECTED_MIGRATIONS)})) AS expected_migration_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (${quotedList(EXPECTED_TABLES)})) AS table_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name IN (${quotedList(EXPECTED_INDEXES)})) AS index_count,
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
  primary_key_count: EXPECTED_TABLES.length,
  unique_constraint_count: 5,
  foreign_key_count: 6,
  evolved_column_count: 1,
  check_constraint_count: 11,
};

const OUTPUT_LIMIT = 1024 * 1024;

/** A bounded no-shell backend. It is never selected implicitly by the runner. */
export function createNodeCommandRunner(): CommandRunner {
  return {
    run(file, args) {
      return new Promise((resolve, reject) => {
        const child = spawn(file, [...args], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        let overflow = false;
        const append = (target: "stdout" | "stderr", chunk: Buffer): void => {
          const current = target === "stdout" ? stdout : stderr;
          if (Buffer.byteLength(current, "utf8") + chunk.byteLength > OUTPUT_LIMIT) {
            overflow = true;
            child.kill();
            return;
          }
          if (target === "stdout") stdout += chunk.toString("utf8");
          else stderr += chunk.toString("utf8");
        };
        child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
        child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
        child.once("error", () => reject(new Error("Wrangler process could not be started")));
        child.once("close", (code) => {
          if (overflow) reject(new Error("Wrangler output exceeded the safety limit"));
          else resolve({ exitCode: code ?? -1, stdout, stderr });
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
    "wrangler", "d1", "execute", databaseName,
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
  args: readonly string[],
  stage: "preflight" | "chunk" | "validation",
): Promise<CommandResult> {
  try {
    const result = await commandRunner.run("npx", args);
    if (result.exitCode !== 0) throw new Error("nonzero");
    return result;
  } catch {
    throw new Error(`D1 ${stage} failed`);
  }
}

export async function runD1Import(options: RunD1ImportOptions): Promise<D1DryRunResult | D1ApplyResult> {
  const plan = buildD1ImportPlan(options.input, { ...options.planOptions, overwrite: options.execution.overwrite });
  assertExecutionGates(options.execution, plan.containsSensitiveRows);
  if (!options.wranglerConfigPath || options.wranglerConfigPath.startsWith("-") ||
      options.wranglerConfigPath.length > 4_096 || /[\0\r\n]/.test(options.wranglerConfigPath)) {
    throw new Error("Wrangler config path is invalid");
  }
  const wranglerConfig = parseWranglerJsonc(options.wranglerConfigText);
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

  assertMediaEvidence(plan.requiredMediaPaths, options.mediaEvidence ?? []);
  const commandBase = baseArgs(target.databaseName, target.target, options.wranglerConfigPath, target.environment);

  const preflight = await checkedRun(
    options.commandRunner,
    [...commandBase, "--command", D1_PREFLIGHT_SQL],
    "preflight",
  );
  try { assertPreflight(preflight.stdout); } catch { throw new Error("D1 preflight failed"); }

  const files = options.privateFiles ?? createPrivateSqlFiles();
  let directory: string | undefined;
  let failure: Error | undefined;
  try {
    directory = await files.createDirectory();
    for (let index = 0; index < plan.chunks.length; index += 1) {
      const path = await files.write(directory, `${String(index + 1).padStart(4, "0")}-chunk.sql`, plan.chunks[index]);
      await checkedRun(options.commandRunner, [...commandBase, "--file", path], "chunk");
    }
    for (let index = 0; index < plan.validation.length; index += 1) {
      const unit = plan.validation[index];
      const path = await files.write(
        directory,
        `${String(index + 1).padStart(4, "0")}-validation.sql`,
        `${unit.sql}\n`,
      );
      const result = await checkedRun(options.commandRunner, [...commandBase, "--file", path], "validation");
      try { assertValidation(result.stdout); } catch { throw new Error("D1 validation failed"); }
    }
  } catch (error) {
    failure = error instanceof Error && /^D1 (?:chunk|validation) failed$/.test(error.message)
      ? error
      : new Error("D1 import failed");
  } finally {
    if (directory) {
      try { await files.cleanup(directory); } catch {
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
