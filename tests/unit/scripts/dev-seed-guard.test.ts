import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEV_SEED_FILE = "data/d1/seed-dev.sql";
const PROD_SEED_FILE = "data/d1/seed.sql";
const MIGRATIONS_DIR = "migrations";
const SCRIPTS_DIR = "scripts";
const FIXTURE_ORDER_ID = "dev-order-001";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

describe("dev seed guard: the local order fixture can never reach a production seed path", () => {
  it("the dev seed file contains the fixture id guarded by an ON CONFLICT clause", () => {
    const devSeed = readRepoFile(DEV_SEED_FILE);
    const fixtureLineIndex = devSeed.indexOf(`'${FIXTURE_ORDER_ID}'`);
    expect(fixtureLineIndex).toBeGreaterThan(-1);
    expect(devSeed).toMatch(/ON CONFLICT\(id\) DO NOTHING/);
  });

  it("the fixture id appears in no production seed and no migration", () => {
    const prodSeed = readRepoFile(PROD_SEED_FILE);
    expect(prodSeed).not.toContain(FIXTURE_ORDER_ID);

    const migrationsDir = path.join(REPO_ROOT, MIGRATIONS_DIR);
    const migrationFiles = listFilesRecursive(migrationsDir);
    expect(migrationFiles.length).toBeGreaterThan(0);
    for (const file of migrationFiles) {
      const contents = readFileSync(file, "utf8");
      expect(contents).not.toContain(FIXTURE_ORDER_ID);
    }
  });

  it("the dev seed file's path is referenced by exactly one file under scripts/", () => {
    const scriptsDir = path.join(REPO_ROOT, SCRIPTS_DIR);
    const scriptFiles = listFilesRecursive(scriptsDir);
    const referencingFiles = scriptFiles.filter((file) =>
      readFileSync(file, "utf8").includes(DEV_SEED_FILE),
    );
    expect(referencingFiles).toHaveLength(1);

    const referencingScript = readFileSync(referencingFiles[0], "utf8");
    expect(referencingScript).toMatch(/--local/);
  });
});
