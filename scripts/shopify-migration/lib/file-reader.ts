import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { parse } from "csv-parse/sync";

export const DEFAULT_MAX_INPUT_BYTES = 50 * 1024 * 1024;
export const DEFAULT_MAX_INPUT_RECORDS = 100_000;
export const DEFAULT_MAX_CSV_COLUMNS = 256;
export const DEFAULT_MAX_CSV_RECORD_BYTES = 1024 * 1024;

export interface FileReadLimits {
  maxBytes?: number;
  maxRecords?: number;
  maxColumns?: number;
  maxRecordBytes?: number;
}

function positiveLimit(value: number | undefined, fallback: number, name: string): number {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > Number.MAX_SAFE_INTEGER) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return limit;
}

function isWithin(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

/** Resolve an existing regular file, rejecting absolute paths, traversal, and symlink escapes. */
export function resolveInputFile(inputRoot: string, requestedPath: string): string {
  if (!requestedPath || isAbsolute(requestedPath) || requestedPath.includes("\0")) {
    throw new Error("Input path must be a non-empty relative path");
  }
  const root = realpathSync(inputRoot);
  const lexical = resolve(root, requestedPath);
  if (!isWithin(root, lexical)) throw new Error("Input path escapes the configured input root");
  const actual = realpathSync(lexical);
  if (!isWithin(root, actual)) throw new Error("Input symlink escapes the configured input root");
  if (!lstatSync(actual).isFile()) throw new Error("Input path must identify a regular file");
  return actual;
}

function readBoundedText(inputRoot: string, requestedPath: string, limits: FileReadLimits): string {
  const path = resolveInputFile(inputRoot, requestedPath);
  const maxBytes = positiveLimit(limits.maxBytes, DEFAULT_MAX_INPUT_BYTES, "maxBytes");
  const size = lstatSync(path).size;
  if (size > maxBytes) throw new Error(`Input file exceeds the ${maxBytes}-byte limit`);
  const content = readFileSync(path, "utf8");
  if (Buffer.byteLength(content, "utf8") > maxBytes) throw new Error(`Input file exceeds the ${maxBytes}-byte limit`);
  return content;
}

function assertRecordCount(records: readonly unknown[], limits: FileReadLimits): void {
  const maxRecords = positiveLimit(limits.maxRecords, DEFAULT_MAX_INPUT_RECORDS, "maxRecords");
  if (records.length > maxRecords) throw new Error(`Input contains more than ${maxRecords} records`);
}

export function readCsvFile<T extends Record<string, string> = Record<string, string>>(
  inputRoot: string,
  requestedPath: string,
  limits: FileReadLimits = {},
): T[] {
  const content = readBoundedText(inputRoot, requestedPath, limits);
  const maxColumns = positiveLimit(limits.maxColumns, DEFAULT_MAX_CSV_COLUMNS, "maxColumns");
  const records = parse(content, {
    bom: true,
    columns(headers: string[]) {
      if (headers.length > maxColumns) throw new Error(`CSV contains more than ${maxColumns} columns`);
      const normalized = headers.map((header) => header.trim());
      if (normalized.some((header) => !header)) throw new Error("CSV contains an empty column name");
      if (new Set(normalized).size !== normalized.length) throw new Error("CSV contains duplicate column names");
      if (normalized.some((header) => ["__proto__", "prototype", "constructor"].includes(header.toLowerCase()))) {
        throw new Error("CSV contains an unsafe column name");
      }
      return normalized;
    },
    max_record_size: positiveLimit(limits.maxRecordBytes, DEFAULT_MAX_CSV_RECORD_BYTES, "maxRecordBytes"),
    skip_empty_lines: true,
    trim: true,
  }) as T[];
  assertRecordCount(records, limits);
  return records;
}

export function readJsonFile<T>(
  inputRoot: string,
  requestedPath: string,
  limits: FileReadLimits = {},
): T[] {
  const content = readBoundedText(inputRoot, requestedPath, limits);
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("Input file is not valid JSON");
  }
  let records: unknown[];
  if (Array.isArray(value)) {
    records = value;
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    records = entries.length === 1 && Array.isArray(entries[0][1]) ? entries[0][1] : [value];
  } else {
    throw new Error("JSON input must be an object, array, or single array wrapper");
  }
  assertRecordCount(records, limits);
  return records as T[];
}
