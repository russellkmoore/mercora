#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseWranglerConfig } from "./lib/d1-migrate-plan.mjs";

const ORDER_STATUS_SECRET_PLACEHOLDER = "replace_with_at_least_32_random_characters";
const MIN_ORDER_STATUS_SECRET_LENGTH = 32;

export function validateOrderStatusConfig(env = {}, vars = {}) {
  const rawFlag = env.ORDER_STATUS_GUEST_LINKS_ENABLED ?? vars.ORDER_STATUS_GUEST_LINKS_ENABLED;
  const flag = rawFlag === undefined ? undefined : String(rawFlag).trim().toLowerCase();
  if (flag !== undefined && flag !== "true" && flag !== "false") {
    throw new Error("ORDER_STATUS_GUEST_LINKS_ENABLED must be true or false.");
  }
  if (flag === "false") return;

  const rawSecret = env.ORDER_STATUS_SECRET;
  const configured = flag === "true" || rawSecret !== undefined;
  if (!configured) return;

  const secret = typeof rawSecret === "string" ? rawSecret : "";
  if (
    !secret ||
    secret.trim() !== secret ||
    secret === ORDER_STATUS_SECRET_PLACEHOLDER ||
    secret.length < MIN_ORDER_STATUS_SECRET_LENGTH
  ) {
    throw new Error(
      "guest order-status links require a non-placeholder ORDER_STATUS_SECRET of at least 32 characters.",
    );
  }
}

function main() {
  try {
    const config = parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8"));
    const serialized = JSON.stringify(config);
    if (serialized.includes("REPLACE_WITH_")) {
      throw new Error("wrangler.jsonc contains REPLACE_WITH_ placeholder(s). Configure a real deployment before deploying.");
    }
    const vars = config.vars ?? {};
    validateOrderStatusConfig(process.env, vars);
    if (vars.NEXT_PUBLIC_ROBOTS_INDEX === "true" && !/^https:\/\//.test(vars.NEXT_PUBLIC_SITE_URL ?? "")) {
      throw new Error("indexable deployments require a valid https NEXT_PUBLIC_SITE_URL.");
    }
    console.log("[deploy-check] configuration contains no deployment placeholders.");
    console.log("[deploy-check] remote D1 migrations are intentionally not auto-applied; run db:migrate:status first.");
  } catch (error) {
    console.error(`[deploy-check] ABORT: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
