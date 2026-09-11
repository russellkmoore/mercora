#!/usr/bin/env node
/**
 * Reject contract migrations that a deploy would apply before the code that
 * tolerates them is live.
 *
 * The Workers Builds deploy command applies migrations and then uploads the
 * Worker, so only additive migrations are safe to land in the same release as
 * the code that reads them. Removing or narrowing an existing object must ship
 * one release after the code that stopped depending on it.
 *
 * Only migrations *added* by the change under review are inspected. Already
 * applied history is not re-litigated.
 */
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  findDuplicateNumbers,
  inspectMigration,
  summarize,
  ACKNOWLEDGEMENT_PREFIX,
} from "./lib/migration-safety.mjs";
import { valueAfter } from "./lib/d1-migrate-plan.mjs";

const args = process.argv.slice(2);
const base = valueAfter(args, "--base") ?? "origin/main";

const listed = spawnSync(
  "git",
  ["diff", "--diff-filter=A", "--name-only", `${base}...HEAD`, "--", "migrations/"],
  { encoding: "utf8" },
);

if (listed.status !== 0) {
  process.stderr.write(listed.stderr ?? "");
  console.error(`[migration-safety] ABORT: unable to diff against "${base}".`);
  process.exit(1);
}

const files = (listed.stdout ?? "")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.endsWith(".sql"));

if (!files.length) {
  console.log("[migration-safety] no migrations added; nothing to check.");
  process.exit(0);
}

const { blocked, acknowledged, expand } = summarize(
  files.map((file) => inspectMigration(file, readFileSync(file, "utf8"))),
);

// Every migration on disk after this change, added or pre-existing, is the
// universe a reused number is compared against — not just the added set, or
// an added file colliding with an already-applied one is never detected.
const allMigrationFiles = readdirSync("migrations")
  .filter((name) => name.endsWith(".sql"))
  .map((name) => `migrations/${name}`);
const duplicates = findDuplicateNumbers(files, allMigrationFiles);

for (const { file } of expand) {
  console.log(`[migration-safety] ${file}: expand-only.`);
}
for (const { file, contractions, reason } of acknowledged) {
  console.log(`[migration-safety] ${file}: ${contractions.join(", ")} acknowledged — ${reason}`);
}

for (const { file, number, collidesWith } of duplicates) {
  console.error(
    `[migration-safety] BLOCKED ${file}: number ${number} is already used by ${collidesWith.join(", ")}.`,
  );
}
if (duplicates.length) {
  console.error(
    "\n[migration-safety] Two migrations sharing a number sort ambiguously relative to each\n" +
    "other and to any migration landing between them. Pick the next free number instead —\n" +
    "and never rename a migration that has already been applied; that changes the record a\n" +
    "production database already has.",
  );
}

if (!blocked.length && !duplicates.length) {
  console.log(`[migration-safety] ${files.length} added migration(s) are safe to auto-apply.`);
  process.exit(0);
}

for (const { file, contractions } of blocked) {
  console.error(`[migration-safety] BLOCKED ${file}: ${contractions.join(", ")}`);
}
if (blocked.length) {
  console.error(
    "\n[migration-safety] A deploy applies migrations before the new Worker is live, so the\n" +
    "previous code runs against this schema. Ship the code that tolerates the change first,\n" +
    "then land the contraction in a later release.\n\n" +
    `If the reading code already shipped, record why in the migration:\n  ${ACKNOWLEDGEMENT_PREFIX} <reason>`,
  );
}
process.exit(1);
