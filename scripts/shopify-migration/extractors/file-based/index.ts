import { existsSync } from "node:fs";
import type { ExtractResult } from "../../lib/types.js";
import { readCsvFile, readJsonFile, resolveInputFile, type FileReadLimits } from "../../lib/file-reader.js";

export function extractFileRecords<T>(
  inputRoot: string,
  basename: string,
  limits: FileReadLimits = {},
): ExtractResult<T> {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(basename)) throw new Error("Input entity basename is invalid");
  const json = `${basename}.json`;
  const csv = `${basename}.csv`;
  let records: T[];
  try {
    const path = resolveInputFile(inputRoot, json);
    if (!existsSync(path)) throw new Error("unreachable");
    records = readJsonFile<T>(inputRoot, json, limits);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
    records = readCsvFile(inputRoot, csv, limits) as T[];
  }
  return { records, source: "file", extractedAt: new Date().toISOString() };
}
