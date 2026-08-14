import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createPrivateSqlFiles,
  createNodeCommandRunner,
  runD1Import,
  type CommandRunner,
  type PrivateSqlFiles,
  type SpawnCommand,
} from "@/scripts/shopify-migration/adapters/d1/runner";
import type { ExecutionPlan } from "@/scripts/shopify-migration/lib/config";

const preflight = `${JSON.stringify([{ success: true, results: [{
  migration_count: 20,
  expected_migration_count: 20,
  table_count: 12,
  index_count: 12,
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
  it("returns a PII-free dry-run plan without subprocesses or temporary writes", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    const { files } = memoryFiles();
    const result = await runD1Import({
      input: input(), execution: execution(), wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath, commandRunner, privateFiles: files,
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
      wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc",
      wranglerExecutablePath,
      commandRunner,
      privateFiles: files,
    });
    expect(result.dryRun).toBe(false);
    expect(events).toEqual(["preflight", "temp", "chunk", "validation"]);
    const calls = (commandRunner.run as ReturnType<typeof vi.fn>).mock.calls as Array<[string, string[]]>;
    expect(calls[0][0]).toBe(wranglerExecutablePath);
    expect(calls[0][1]).toEqual(expect.arrayContaining(["d1", "execute", "local-db", "--remote", "--preview", "--config", "wrangler.jsonc", "--json", "--command"]));
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
        input: input(), execution: execution({ dryRun: false, apply: true }), wranglerConfigText: wrangler,
        wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath, commandRunner, privateFiles: files,
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
      input: input(), execution: execution({ dryRun: false, apply: true }), wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath, commandRunner, privateFiles: files,
    })).resolves.toMatchObject({ dryRun: false });
  });

  it("requires both overwrite and sensitive confirmations", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(runD1Import({
      input: input(), execution: execution({ dryRun: false, apply: true, overwrite: true }),
      wranglerConfigText: wrangler, wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath, commandRunner,
    })).rejects.toThrow(/Overwrite apply/);
    await expect(runD1Import({
      input: { customers: [{ id: "user_12345678", type: "person" }] },
      execution: execution(), wranglerConfigText: wrangler, wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath, commandRunner,
    })).rejects.toThrow(/Sensitive rows/);
  });

  it("rejects planned/plain-exists media and accepts only complete cryptographic evidence", async () => {
    const path = "/media/categories/owner/1.jpg";
    const commandRunner: CommandRunner = { run: vi.fn(async (_file: string, args: readonly string[]) => ({
      exitCode: 0,
      stdout: args.includes("--command") ? preflight : args.some((value) => value.includes("validation")) ? validation : "",
      stderr: "",
    })) };
    const common = {
      input: input(path), execution: execution({ dryRun: false, apply: true }), wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath, commandRunner,
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
      wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc",
      wranglerExecutablePath,
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

  it("fails closed instead of invoking npx or an arbitrary executable", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(runD1Import({
      input: input(), execution: execution(), wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath: "npx", commandRunner,
    })).rejects.toThrow(/Local Wrangler executable path/);
    await expect(runD1Import({
      input: input(), execution: execution(), wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc",
      wranglerExecutablePath: "/tmp/unrelated/node_modules/.bin/wrangler",
      commandRunner,
    })).rejects.toThrow(/Local Wrangler executable path/);
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
      input: input(), execution: execution({ dryRun: false, apply: true }), wranglerConfigText: wrangler,
      wranglerConfigPath: "wrangler.jsonc", wranglerExecutablePath, commandRunner, privateFiles: files,
    })).rejects.toThrow(/^D1 chunk failed$/);
    expect(calls).toBe(2);
    expect(files.cleanup).toHaveBeenCalledOnce();
  });
});
