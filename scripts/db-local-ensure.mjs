#!/usr/bin/env node
/** Prepare only the local D1 database used by `npm run dev`; never contacts Cloudflare. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { migrationArgs, parseWranglerConfig, resolveTarget } from "./lib/d1-migrate-plan.mjs";

try {
  const config = parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8"));
  const plan = resolveTarget(config, { target: "local" });
  console.log(`[db:local] Applying local migrations for ${plan.database}...`);
  const result = spawnSync("npx", ["wrangler", ...migrationArgs(plan, "apply")], { stdio: "inherit" });
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(`[db:local] ABORT: ${error.message}`);
  process.exit(1);
}
