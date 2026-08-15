import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  D1_TARGET_COLUMN_COUNT,
  createPrivateSqlFiles,
  createNodeCommandRunner,
  preflightD1Target,
  runD1Import,
  type CommandRunner,
  type D1ProjectFiles,
  type PrivateSqlFiles,
  type SpawnCommand,
} from "@/scripts/shopify-migration/adapters/d1/runner";
import type { ExecutionPlan } from "@/scripts/shopify-migration/lib/config";

const preflight = `${JSON.stringify([{ success: true, results: [{
  migration_count: 20,
  expected_migration_count: 20,
  table_count: 12,
  index_count: 12,
  target_column_count: D1_TARGET_COLUMN_COUNT,
  compatible_target_column_count: D1_TARGET_COLUMN_COUNT,
  incompatible_additive_column_count: 0,
  primary_key_count: 12,
  unique_constraint_count: 5,
  foreign_key_count: 6,
  evolved_column_count: 1,
  check_constraint_count: 11,
}] }])}\n`;
const validation = JSON.stringify([{ success: true, results: [{ expected_count: 1, actual_count: 1 }] }]);
const wrangler = JSON.stringify({
  d1_databases: [{ binding: "DB", database_name: "local-db", database_id: "prod-id", preview_database_id: "preview-id" }],
});
const wranglerExecutablePath = join(process.cwd(), "node_modules", ".bin", "wrangler");
const projectRoot = "/repo";
const projectConfigPath = `${projectRoot}/wrangler.jsonc`;
const projectPackageRoot = `${projectRoot}/node_modules/wrangler`;
const projectPackageJsonPath = `${projectPackageRoot}/package.json`;
const projectExecutablePath = `${projectPackageRoot}/bin/wrangler.js`;
const projectShimPath = `${projectRoot}/node_modules/.bin/wrangler`;
const packageJson = Buffer.from(JSON.stringify({
  name: "wrangler",
  version: "4.120.0",
  bin: { wrangler: "bin/wrangler.js" },
}));
const executable = Buffer.from("#!/usr/bin/env node\n");

function memoryProjectFiles(configReads: readonly string[] = [wrangler]): D1ProjectFiles {
  let configIndex = 0;
  return {
    realpath: vi.fn(async (path: string) => path === projectShimPath ? projectExecutablePath : path),
    readFile: vi.fn(async (path: string) => {
      if (path === projectConfigPath) {
        const value = configReads[Math.min(configIndex, configReads.length - 1)];
        configIndex += 1;
        return Buffer.from(value);
      }
      if (path === projectPackageJsonPath) return Buffer.from(packageJson);
      if (path === projectExecutablePath) return Buffer.from(executable);
      throw new Error("unexpected project read");
    }),
    stat: vi.fn(async (path: string) => {
      if (path === projectRoot || path === projectPackageRoot) return { kind: "directory" as const, size: 0, mode: 0o755 };
      if (path === projectConfigPath) {
        const current = configReads[Math.min(configIndex, configReads.length - 1)];
        return { kind: "file" as const, size: Buffer.byteLength(current), mode: 0o644 };
      }
      if (path === projectPackageJsonPath) return { kind: "file" as const, size: packageJson.byteLength, mode: 0o644 };
      if (path === projectExecutablePath) return { kind: "file" as const, size: executable.byteLength, mode: 0o755 };
      throw new Error("unexpected project stat");
    }),
  };
}

function project(configReads?: readonly string[]) {
  return { projectRoot, projectFiles: memoryProjectFiles(configReads) };
}

function execution(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  return {
    dryRun: true,
    apply: false,
    target: "local",
    includeSensitive: false,
    overwrite: false,
    confirmedSensitiveData: false,
    confirmedPreview: false,
    confirmedProduction: false,
    confirmedOverwrite: false,
    ...overrides,
  };
}

function input(path?: string) {
  return {
    categories: [{ category: {
      id: "shopify_category_private",
      name: "Private Name",
      ...(path ? { primary_image: JSON.stringify({ file: { url: path } }) } : {}),
    } }] as never,
  };
}

function memoryFiles() {
  const writes: Array<{ filename: string; contents: string }> = [];
  const files: PrivateSqlFiles = {
    createDirectory: vi.fn(async () => "/private/tmp/test-d1"),
    write: vi.fn(async (_directory, filename, contents) => {
      writes.push({ filename, contents });
      return `/private/tmp/test-d1/${filename}`;
    }),
    cleanup: vi.fn(async () => undefined),
  };
  return { files, writes };
}

describe("D1 runner", () => {
  it("exports a read-only canonical preflight receipt without creating SQL files", async () => {
    const commandRunner: CommandRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: preflight, stderr: "" })),
    };
    const receipt = await preflightD1Target({
      execution: execution({ dryRun: false, apply: true }),
      ...project(),
      commandRunner,
    });
    expect(receipt).toMatchObject({
      version: 1,
      target: "local",
      databaseName: "local-db",
      databaseId: null,
      environment: null,
    });
    expect(receipt.projectDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(commandRunner.run).toHaveBeenCalledOnce();
    const args = (commandRunner.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string[];
    expect(args).toContain("--command");
    expect(args).not.toContain("--file");
  });

  it("fails read-only preflight for a missing migration without exposing command output", async () => {
    const stale = preflight.replace('"migration_count":20', '"migration_count":19');
    const commandRunner: CommandRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: stale, stderr: "private database output" })),
    };
    await expect(preflightD1Target({
      execution: execution({ dryRun: false, apply: true }),
      ...project(),
      commandRunner,
    })).rejects.toThrow(/^D1 preflight failed$/);
  });

  it("rejects the wrong canonical database target before spawning a command", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(preflightD1Target({
      execution: execution({ dryRun: false, apply: true }),
      ...project(),
      expectedDatabaseName: "another-database",
      commandRunner,
    })).rejects.toThrow("does not match expected");
    expect(commandRunner.run).not.toHaveBeenCalled();
  });

  it("rejects a stale preflight receipt before media checks, subprocesses, or SQL files", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    const { files } = memoryFiles();
    await expect(runD1Import({
      input: input(),
      execution: execution({ dryRun: false, apply: true }),
      ...project(),
      commandRunner,
      privateFiles: files,
      preflightReceipt: {
        version: 1,
        target: "local",
        databaseName: "local-db",
        databaseId: null,
        environment: null,
        projectDigest: "f".repeat(64),
      },
    })).rejects.toThrow("receipt does not match");
    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(files.createDirectory).not.toHaveBeenCalled();
  });

  it("binds a dry run to the real project's config and package-local Wrangler", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(runD1Import({
      input: {}, execution: execution(), projectRoot: process.cwd(), commandRunner,
    })).resolves.toMatchObject({ dryRun: true, totalRows: 0 });
    expect(commandRunner.run).not.toHaveBeenCalled();
  });

  it("returns a PII-free dry-run plan without subprocesses or temporary writes", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    const { files } = memoryFiles();
    const result = await runD1Import({
      input: input(), execution: execution(), ...project(), commandRunner, privateFiles: files,
    });
    expect(result.dryRun).toBe(true);
    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(files.createDirectory).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("Private Name");
    expect(JSON.stringify(result)).not.toContain("shopify_category_private");
  });

  it("pins preview argv, preflights before files, and never auto-confirms", async () => {
    const events: string[] = [];
    const commandRunner: CommandRunner = { run: vi.fn(async (_file: string, args: readonly string[]) => {
      events.push(args.includes("--command") ? "preflight" : args.some((value) => value.includes("chunk")) ? "chunk" : "validation");
      return { exitCode: 0, stdout: args.includes("--command") ? preflight : args.some((value) => value.includes("validation")) ? validation : "", stderr: "" };
    }) };
    const { files } = memoryFiles();
    (files.createDirectory as ReturnType<typeof vi.fn>).mockImplementation(async () => { events.push("temp"); return "/private/tmp/test-d1"; });
    const result = await runD1Import({
      input: input(),
      execution: execution({ dryRun: false, apply: true, target: "preview", confirmedPreview: true }),
      ...project(),
      commandRunner,
      privateFiles: files,
    });
    expect(result.dryRun).toBe(false);
    expect(events).toEqual(["preflight", "temp", "chunk", "validation"]);
    const calls = (commandRunner.run as ReturnType<typeof vi.fn>).mock.calls as Array<[string, string[]]>;
    expect(calls[0][0]).toBe(projectExecutablePath);
    expect(calls[0][1]).toEqual(expect.arrayContaining(["d1", "execute", "local-db", "--remote", "--preview", "--config", projectConfigPath, "--json", "--command"]));
    expect(calls.flatMap((call) => call[1])).not.toContain("wrangler");
    expect(calls.flatMap((call) => call[1])).not.toContain("--yes");
    expect(files.cleanup).toHaveBeenCalledOnce();
  });

  it("blocks schema mismatch before temp files and rejects ambiguous/prose JSON", async () => {
    for (const stdout of [
      JSON.stringify([{ success: true, results: [{ migration_count: 19 }] }]),
      `${preflight}\nwarning`,
      JSON.stringify([{ success: true, results: [{}] }, { success: true, results: [{}] }]),
    ]) {
      const commandRunner: CommandRunner = { run: vi.fn(async () => ({ exitCode: 0, stdout, stderr: "private row" })) };
      const { files } = memoryFiles();
      await expect(runD1Import({
        input: input(), execution: execution({ dryRun: false, apply: true }), ...project(), commandRunner, privateFiles: files,
      })).rejects.toThrow(/^D1 preflight failed$/);
      expect(files.createDirectory).not.toHaveBeenCalled();
    }
  });

  it("accepts later additive migrations when the complete O05 baseline remains", async () => {
    const future = preflight.replace('"migration_count":20', '"migration_count":21');
    const commandRunner: CommandRunner = { run: vi.fn(async (_file: string, args: readonly string[]) => ({
      exitCode: 0,
      stdout: args.includes("--command") ? future : args.some((value) => value.includes("validation")) ? validation : "",
      stderr: "",
    })) };
    const { files } = memoryFiles();
    await expect(runD1Import({
      input: input(), execution: execution({ dryRun: false, apply: true }), ...project(), commandRunner, privateFiles: files,
    })).resolves.toMatchObject({ dryRun: false });
  });

  it("requires both overwrite and sensitive confirmations", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(runD1Import({
      input: input(), execution: execution({ dryRun: false, apply: true, overwrite: true }),
      ...project(), commandRunner,
    })).rejects.toThrow(/Overwrite apply/);
    await expect(runD1Import({
      input: { customers: [{ id: "user_12345678", type: "person" }] },
      execution: execution(), ...project(), commandRunner,
    })).rejects.toThrow(/Sensitive rows/);
  });

  it("rejects a divergent initial page version before project reads or command execution", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    const projectFiles = memoryProjectFiles();
    await expect(runD1Import({
      input: { pages: [{
        sourceFingerprint: "page-fingerprint",
        page: {
          title: "Page", slug: "page", content: "<p>Page</p>", excerpt: null,
          meta_title: "Page", meta_description: null, meta_keywords: null,
          template: "default", parent_id: null, created_by: "actor", updated_by: "actor",
          version: 1, custom_css: null, custom_js: null,
        },
        initialVersion: {
          pageReference: { provider: "shopify", sourceFingerprint: "page-fingerprint", slug: "page" },
          record: {
            title: "Page", content: "<p>Different</p>", excerpt: null,
            meta_title: "Page", meta_description: null, meta_keywords: null,
            version: 1, created_by: "actor",
          },
        },
        conflict: { strategy: "insert-only", key: "slug", onConflict: "skip" },
        media: [],
      }] as never },
      execution: execution(), projectRoot, projectFiles, commandRunner,
    })).rejects.toThrow(/page snapshot contract/);
    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(projectFiles.readFile).not.toHaveBeenCalled();
  });

  it("rejects planned/plain-exists media and accepts only complete cryptographic evidence", async () => {
    const path = "/media/categories/owner/1.jpg";
    const commandRunner: CommandRunner = { run: vi.fn(async (_file: string, args: readonly string[]) => ({
      exitCode: 0,
      stdout: args.includes("--command") ? preflight : args.some((value) => value.includes("validation")) ? validation : "",
      stderr: "",
    })) };
    const common = {
      input: input(path), execution: execution({ dryRun: false, apply: true }), ...project(), commandRunner,
    };
    await expect(runD1Import({ ...common, mediaEvidence: [{ objectKey: "categories/owner/1.jpg", publicPath: path, status: "planned" } as never] }))
      .rejects.toThrow(/cryptographically verified/);
    await expect(runD1Import({ ...common, mediaEvidence: [{ objectKey: "categories/owner/1.jpg", publicPath: path, status: "exists" } as never] }))
      .rejects.toThrow(/cryptographically verified/);
    const { files } = memoryFiles();
    await expect(runD1Import({
      ...common,
      privateFiles: files,
      mediaEvidence: [{
        objectKey: "categories/owner/1.jpg", publicPath: path, status: "verified-existing",
        sha256: "a".repeat(64), contentType: "image/jpeg", byteLength: 100,
      }],
    })).resolves.toMatchObject({ dryRun: false });
  });

  it("stops after a failed chunk, cleans up, and redacts command output", async () => {
    let calls = 0;
    const commandRunner: CommandRunner = { run: vi.fn(async (_file: string, args: readonly string[]) => {
      calls += 1;
      if (args.includes("--command")) return { exitCode: 0, stdout: preflight, stderr: "" };
      return calls === 3
        ? { exitCode: 1, stdout: "customer@example.invalid", stderr: "secret" }
        : { exitCode: 0, stdout: "", stderr: "" };
    }) };
    const { files } = memoryFiles();
    await expect(runD1Import({
      input: { categories: [
        { category: { id: "one", name: "One" } },
        { category: { id: "two", name: "Two" } },
        { category: { id: "three", name: "Three" } },
      ] as never },
      execution: execution({ dryRun: false, apply: true }),
      ...project(),
      commandRunner,
      privateFiles: files,
      planOptions: { maxChunkStatements: 3, maxChunkBytes: 1024 },
    })).rejects.toThrow(/^D1 chunk failed$/);
    expect(commandRunner.run).toHaveBeenCalledTimes(3);
    expect(files.cleanup).toHaveBeenCalledOnce();
  });

  it("creates private mode-0600 SQL files and removes their directory", async () => {
    const files = createPrivateSqlFiles();
    const directory = await files.createDirectory();
    const path = await files.write(directory, "0001-chunk.sql", "SELECT 1;\n");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await files.cleanup(directory);
    await expect(stat(directory)).rejects.toThrow();
  });

  it("fails closed for a non-canonical or unrelated project root", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(runD1Import({
      input: input(), execution: execution(), projectRoot: "relative", projectFiles: memoryProjectFiles(), commandRunner,
    })).rejects.toThrow(/project root/);
    expect(commandRunner.run).not.toHaveBeenCalled();
  });

  it("rejects same-name config bytes with a different database ID before spawn", async () => {
    const changed = JSON.stringify({
      d1_databases: [{
        binding: "DB",
        database_name: "local-db",
        database_id: "different-prod-id",
        preview_database_id: "different-preview-id",
      }],
    });
    const commandRunner: CommandRunner = { run: vi.fn() };
    const { files } = memoryFiles();
    await expect(runD1Import({
      input: input(), execution: execution({ dryRun: false, apply: true }),
      ...project([wrangler, changed]), commandRunner, privateFiles: files,
    })).rejects.toThrow(/^D1 preflight failed$/);
    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(files.createDirectory).not.toHaveBeenCalled();
  });

  it("rechecks config bytes before a write and cleans up when they change after preflight", async () => {
    const changed = JSON.stringify({
      d1_databases: [{
        binding: "DB", database_name: "local-db",
        database_id: "later-prod-id", preview_database_id: "later-preview-id",
      }],
    });
    const commandRunner: CommandRunner = { run: vi.fn(async () => ({ exitCode: 0, stdout: preflight, stderr: "" })) };
    const { files } = memoryFiles();
    await expect(runD1Import({
      input: input(), execution: execution({ dryRun: false, apply: true }),
      ...project([wrangler, wrangler, changed]), commandRunner, privateFiles: files,
    })).rejects.toThrow(/^D1 chunk failed$/);
    expect(commandRunner.run).toHaveBeenCalledOnce();
    expect(files.createDirectory).toHaveBeenCalledOnce();
    expect(files.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects a Wrangler shim resolving into unrelated tmp node_modules", async () => {
    const projectFiles = memoryProjectFiles();
    projectFiles.realpath = vi.fn(async (path: string) =>
      path === projectShimPath ? "/tmp/unrelated/node_modules/wrangler/bin/wrangler.js" : path);
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(runD1Import({
      input: input(), execution: execution(), projectRoot, projectFiles, commandRunner,
    })).rejects.toThrow(/not owned by the local package/);
    expect(commandRunner.run).not.toHaveBeenCalled();
  });

  it("times out stalled processes with TERM, bounded KILL, and exactly-once settlement", async () => {
    vi.useFakeTimers();
    try {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const process = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      };
      process.stdout = stdout;
      process.stderr = stderr;
      process.kill = vi.fn(() => true);
      const spawnCommand = vi.fn(() => process) as unknown as SpawnCommand;
      const runner = createNodeCommandRunner({ timeoutMs: 1_000, killGraceMs: 100, spawnCommand });
      let settlements = 0;
      const result = runner.run(wranglerExecutablePath, ["d1"]).then(
        (value) => { settlements += 1; return value; },
        (error: unknown) => { settlements += 1; throw error; },
      );
      const rejected = expect(result).rejects.toThrow(/^Wrangler command timed out$/);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(process.kill).toHaveBeenCalledWith("SIGTERM");
      await vi.advanceTimersByTimeAsync(100);
      expect(process.kill).toHaveBeenCalledWith("SIGKILL");
      await rejected;
      process.emit("error", new Error("late private error"));
      process.emit("close", 1);
      expect(settlements).toBe(1);
      expect(spawnCommand).toHaveBeenCalledWith(
        wranglerExecutablePath,
        ["d1"],
        { shell: false, stdio: ["ignore", "pipe", "pipe"] },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not hard-kill after a timeout-close race and bounds timeout options", async () => {
    vi.useFakeTimers();
    try {
      const process = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      };
      process.stdout = new EventEmitter();
      process.stderr = new EventEmitter();
      process.kill = vi.fn(() => true);
      const runner = createNodeCommandRunner({
        timeoutMs: 1_000,
        killGraceMs: 100,
        spawnCommand: (() => process) as unknown as SpawnCommand,
      });
      const result = runner.run(wranglerExecutablePath, ["d1"]);
      const rejected = expect(result).rejects.toThrow(/^Wrangler command timed out$/);
      await vi.advanceTimersByTimeAsync(1_000);
      process.emit("close", null);
      await rejected;
      await vi.advanceTimersByTimeAsync(200);
      expect(process.kill).toHaveBeenCalledTimes(1);
      expect(process.kill).toHaveBeenCalledWith("SIGTERM");
      expect(() => createNodeCommandRunner({ timeoutMs: 999 })).toThrow(/timeoutMs/);
      expect(() => createNodeCommandRunner({ killGraceMs: 31_000 })).toThrow(/killGraceMs/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("settles once when output overflow races process error and close", async () => {
    const process = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    process.stdout = new EventEmitter();
    process.stderr = new EventEmitter();
    process.kill = vi.fn(() => true);
    const runner = createNodeCommandRunner({
      spawnCommand: (() => process) as unknown as SpawnCommand,
    });
    let settlements = 0;
    const result = runner.run(wranglerExecutablePath, ["d1"]).then(
      (value) => { settlements += 1; return value; },
      (error: unknown) => { settlements += 1; throw error; },
    );
    const rejected = expect(result).rejects.toThrow(/^Wrangler output exceeded the safety limit$/);
    process.stdout.emit("data", Buffer.alloc(1024 * 1024 + 1));
    expect(process.kill).toHaveBeenCalledWith("SIGTERM");
    process.emit("error", new Error("private overflow detail"));
    process.emit("close", 1);
    await rejected;
    expect(settlements).toBe(1);
  });

  it("cleans private SQL after a command timeout", async () => {
    let calls = 0;
    const commandRunner: CommandRunner = { run: vi.fn(async (_file: string, args: readonly string[]) => {
      calls += 1;
      if (args.includes("--command")) return { exitCode: 0, stdout: preflight, stderr: "" };
      throw new Error("Wrangler command timed out");
    }) };
    const { files } = memoryFiles();
    await expect(runD1Import({
      input: input(), execution: execution({ dryRun: false, apply: true }), ...project(), commandRunner, privateFiles: files,
    })).rejects.toThrow(/^D1 chunk failed$/);
    expect(calls).toBe(2);
    expect(files.cleanup).toHaveBeenCalledOnce();
  });
});
