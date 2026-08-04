#!/usr/bin/env node
/**
 * Explicit D1 migration status and apply command.
 *
 * A deploy never calls this script.  Remote schemas are changed only after an
 * operator selects the target and supplies the matching confirmation guard.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  canApply,
  interpretMigrationList,
  migrationArgs,
  parseWranglerConfig,
  resolveTarget,
} from "./lib/d1-migrate-plan.mjs";

const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const target = valueAfter("--target");
const selectedEnvironment = args.includes("--env") ? valueAfter("--env") : undefined;
const apply = args.includes("--apply");

if (!target || (args.includes("--env") && !selectedEnvironment)) {
  console.error("Usage: node scripts/d1-migrate.mjs --target <local|preview|production> [--env <name>] [--apply]");
  process.exit(1);
}

let plan;
try {
  plan = resolveTarget(parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8")), {
    target,
    environment: selectedEnvironment,
  });
} catch (error) {
  console.error(`[d1-migrate] ABORT: ${error.message}`);
  process.exit(1);
}

// Check write authorization before any remote status call. A typo such as
// `--apply --target production` must not even begin a production operation.
if (apply) {
  const permission = canApply({ target, flags: args, environment: process.env });
  if (!permission.allowed) {
    console.error(`[d1-migrate] ABORT: ${permission.reason}`);
    process.exit(1);
  }
}

const run = (wranglerArgs, capture = false) =>
  spawnSync("npx", ["wrangler", ...wranglerArgs], {
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });

const listed = run(migrationArgs(plan, "list"), true);
const output = `${listed.stdout ?? ""}\n${listed.stderr ?? ""}`;
const status = interpretMigrationList(output);
if (listed.status !== 0 || status.status === "unrecognized") {
  process.stderr.write(output);
  console.error("[d1-migrate] ABORT: unable to determine migration status; no migration was applied.");
  process.exit(1);
}

if (status.status === "up-to-date") {
  console.log(`[d1-migrate] ${target} is up to date.`);
  process.exit(0);
}

console.log(`[d1-migrate] ${target} pending: ${status.pending.join(", ")}`);
if (!apply) {
  console.log("[d1-migrate] Plan only. Re-run with --apply and the target confirmation guard to write.");
  process.exit(0);
}

const applied = run(migrationArgs(plan, "apply"));
if (applied.status !== 0) process.exit(applied.status ?? 1);

const verified = run(migrationArgs(plan, "list"), true);
const verifiedStatus = interpretMigrationList(`${verified.stdout ?? ""}\n${verified.stderr ?? ""}`);
if (verified.status !== 0 || verifiedStatus.status !== "up-to-date") {
  console.error("[d1-migrate] ABORT: post-apply status is not up to date. Do not deploy until it is resolved.");
  process.exit(1);
}
console.log(`[d1-migrate] ${target} migration apply verified.`);
