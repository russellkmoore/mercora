#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseWranglerConfig } from "./lib/d1-migrate-plan.mjs";

try {
  const config = parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8"));
  const serialized = JSON.stringify(config);
  if (serialized.includes("REPLACE_WITH_")) {
    throw new Error("wrangler.jsonc contains REPLACE_WITH_ placeholder(s). Configure a real deployment before deploying.");
  }
  const vars = config.vars ?? {};
  if (vars.NEXT_PUBLIC_ROBOTS_INDEX === "true" && !/^https:\/\//.test(vars.NEXT_PUBLIC_SITE_URL ?? "")) {
    throw new Error("indexable deployments require a valid https NEXT_PUBLIC_SITE_URL.");
  }
  console.log("[deploy-check] configuration contains no deployment placeholders.");
  console.log("[deploy-check] remote D1 migrations are intentionally not auto-applied; run db:migrate:status first.");
} catch (error) {
  console.error(`[deploy-check] ABORT: ${error.message}`);
  process.exit(1);
}
