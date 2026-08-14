import { stat } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  createPrivateSqlFiles,
  runD1Import,
  type CommandRunner,
  type PrivateSqlFiles,
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
      wranglerConfigPath: "wrangler.jsonc", commandRunner, privateFiles: files,
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
      wranglerConfigPath: "/repo/wrangler.jsonc",
      commandRunner,
      privateFiles: files,
    });
    expect(result.dryRun).toBe(false);
    expect(events).toEqual(["preflight", "temp", "chunk", "validation"]);
    const calls = (commandRunner.run as ReturnType<typeof vi.fn>).mock.calls as Array<[string, string[]]>;
    expect(calls[0][0]).toBe("npx");
    expect(calls[0][1]).toEqual(expect.arrayContaining(["wrangler", "d1", "execute", "local-db", "--remote", "--preview", "--config", "/repo/wrangler.jsonc", "--json", "--command"]));
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
        wranglerConfigPath: "wrangler.jsonc", commandRunner, privateFiles: files,
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
      wranglerConfigPath: "wrangler.jsonc", commandRunner, privateFiles: files,
    })).resolves.toMatchObject({ dryRun: false });
  });

  it("requires both overwrite and sensitive confirmations", async () => {
    const commandRunner: CommandRunner = { run: vi.fn() };
    await expect(runD1Import({
      input: input(), execution: execution({ dryRun: false, apply: true, overwrite: true }),
      wranglerConfigText: wrangler, wranglerConfigPath: "wrangler.jsonc", commandRunner,
    })).rejects.toThrow(/Overwrite apply/);
    await expect(runD1Import({
      input: { customers: [{ id: "user_12345678", type: "person" }] },
      execution: execution(), wranglerConfigText: wrangler, wranglerConfigPath: "wrangler.jsonc", commandRunner,
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
      wranglerConfigPath: "wrangler.jsonc", commandRunner,
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
});
