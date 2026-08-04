#!/usr/bin/env node
/** Inject only NEXT_PUBLIC_* Wrangler vars into the build process, never secrets. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseWranglerConfig } from "./lib/d1-migrate-plan.mjs";

const args = process.argv.slice(2);
const envIndex = args.indexOf("--env");
const environment = envIndex >= 0 ? args[envIndex + 1] : undefined;
const command = envIndex < 0 ? args : args.filter((_, index) => index !== envIndex && index !== envIndex + 1);
if (!command.length || (envIndex >= 0 && !environment)) {
  console.error("Usage: node scripts/build-with-public-env.mjs [--env <name>] <command> [args...]");
  process.exit(1);
}

try {
  const config = parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8"));
  if (environment && !config.env?.[environment]) {
    throw new Error(`no env.${environment} block exists in wrangler.jsonc`);
  }
  const vars = (environment ? config.env[environment].vars : config.vars) ?? {};
  const publicVars = Object.fromEntries(Object.entries(vars).filter(([key]) => key.startsWith("NEXT_PUBLIC_")));
  const placeholders = Object.entries(publicVars).filter(([, value]) => String(value).includes("REPLACE_WITH_"));
  if (placeholders.length) throw new Error(`unfilled public placeholder(s): ${placeholders.map(([key]) => key).join(", ")}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    env: { ...process.env, ...publicVars },
  });
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(`[build-with-public-env] ABORT: ${error.message}`);
  process.exit(1);
}
