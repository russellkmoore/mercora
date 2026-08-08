#!/usr/bin/env node
/** Prepare only the local D1 database used by `npm run dev`; never contacts Cloudflare. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { migrationArgs, parseWranglerConfig, resolveTarget } from "./lib/d1-migrate-plan.mjs";

const DEV_SEED_FILE = "data/d1/seed-dev.sql";

try {
  const config = parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8"));
  const plan = resolveTarget(config, { target: "local" });
  console.log(`[db:local] Applying local migrations for ${plan.database}...`);
  const result = spawnSync("npx", ["wrangler", ...migrationArgs(plan, "apply")], { stdio: "inherit" });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

  console.log(`[db:local] Applying development-only MCP seed from ${DEV_SEED_FILE}...`);
  const seedResult = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", plan.database, "--local", "--file", DEV_SEED_FILE],
    { stdio: "inherit" },
  );
  process.exit(seedResult.status ?? 1);
} catch (error) {
  console.error(`[db:local] ABORT: ${error.message}`);
  process.exit(1);
}
