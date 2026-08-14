export type SqlScalar = string | number | boolean | null;
export type SqlRecord = Readonly<Record<string, SqlScalar>>;

export type ConflictMode = "abort" | "insert-only" | "compare" | "overwrite";

export interface InsertStatementOptions {
  table: string;
  row: SqlRecord;
  conflictColumns?: readonly string[];
  mode?: ConflictMode;
  /** A NOT NULL column used to make a compare mismatch abort the import. */
  guardColumn?: string;
}

export interface SqlChunkOptions {
  maxBytes?: number;
  maxStatements?: number;
}

export const MAX_D1_STATEMENT_BYTES = 96 * 1024;
export const DEFAULT_D1_CHUNK_BYTES = 4 * 1024 * 1024;
export const DEFAULT_D1_CHUNK_STATEMENTS = 500;

const IDENTIFIER = /^[a-z][a-z0-9_]{0,63}$/;

function identifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new TypeError(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) {
    throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
  }
  return resolved;
}

export function sqlLiteral(value: SqlScalar): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError("SQL numeric values must be safe integers");
    return String(value);
  }
  if (typeof value !== "string" || value.includes("\0")) {
    throw new TypeError("SQL text values must be NUL-free strings");
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function conflictTarget(columns: readonly string[]): string {
  if (columns.length < 1 || columns.length > 4 || new Set(columns).size !== columns.length) {
    throw new TypeError("Conflict columns must contain 1-4 distinct identifiers");
  }
  return `(${columns.map(identifier).join(", ")})`;
}

/**
 * Build one bounded D1 statement. Compare mode is an idempotent
 * insert-or-compare: an exact rerun is a no-op update, while drift sets a
 * caller-declared NOT NULL guard column to NULL so the SQL-file import aborts.
 */
export function buildInsertStatement(options: InsertStatementOptions): string {
  const table = identifier(options.table);
  const entries = Object.entries(options.row);
  if (entries.length < 1 || entries.length > 64) throw new TypeError("SQL rows must contain 1-64 columns");
  const columns = entries.map(([column]) => column);
  if (new Set(columns).size !== columns.length) throw new TypeError("SQL row contains duplicate columns");
  columns.forEach(identifier);

  const mode = options.mode ?? "abort";
  const conflictColumns = options.conflictColumns ?? [];
  const prefix = `INSERT INTO ${table} (${columns.map(identifier).join(", ")}) VALUES (${entries
    .map(([, value]) => sqlLiteral(value))
    .join(", ")})`;

  let suffix = "";
  if (mode !== "abort") {
    const target = conflictTarget(conflictColumns);
    for (const column of conflictColumns) {
      if (!Object.hasOwn(options.row, column)) throw new TypeError(`Conflict column is absent from row: ${column}`);
    }
    if (mode === "insert-only") {
      suffix = ` ON CONFLICT ${target} DO NOTHING`;
    } else if (mode === "overwrite") {
      const mutable = columns.filter((column) => !conflictColumns.includes(column));
      suffix = mutable.length
        ? ` ON CONFLICT ${target} DO UPDATE SET ${mutable.map((column) => `${identifier(column)} = excluded.${identifier(column)}`).join(", ")}`
        : ` ON CONFLICT ${target} DO NOTHING`;
    } else {
      const guard = options.guardColumn;
      if (!guard || !Object.hasOwn(options.row, guard) || options.row[guard] === null) {
        throw new TypeError("Compare mode requires a present, non-null NOT NULL guard column");
      }
      const comparisons = columns
        .map((column) => `${table}.${identifier(column)} IS excluded.${identifier(column)}`)
        .join(" AND ");
      suffix = ` ON CONFLICT ${target} DO UPDATE SET ${identifier(guard)} = CASE WHEN ${comparisons} THEN ${table}.${identifier(guard)} ELSE NULL END`;
    }
  }

  const statement = `${prefix}${suffix};`;
  if (Buffer.byteLength(statement, "utf8") > MAX_D1_STATEMENT_BYTES) {
    throw new RangeError(`SQL statement exceeds the ${MAX_D1_STATEMENT_BYTES}-byte safety limit`);
  }
  return statement;
}

/** D1 SQL imports intentionally omit BEGIN/COMMIT; Wrangler owns file rollback. */
export function chunkSqlStatements(
  statements: readonly string[],
  options: SqlChunkOptions = {},
): string[] {
  const maxBytes = boundedInteger(options.maxBytes, DEFAULT_D1_CHUNK_BYTES, 16 * 1024 * 1024, "maxBytes");
  const maxStatements = boundedInteger(options.maxStatements, DEFAULT_D1_CHUNK_STATEMENTS, 10_000, "maxStatements");
  const chunks: string[] = [];
  let current: string[] = [];
  let currentBytes = 0;

  for (const statement of statements) {
    if (!statement.endsWith(";") || Buffer.byteLength(statement, "utf8") > MAX_D1_STATEMENT_BYTES) {
      throw new TypeError("SQL chunks accept only bounded complete statements");
    }
    const bytes = Buffer.byteLength(`${statement}\n`, "utf8");
    if (bytes > maxBytes) throw new RangeError("A SQL statement exceeds the configured chunk byte limit");
    if (current.length && (current.length >= maxStatements || currentBytes + bytes > maxBytes)) {
      chunks.push(`${current.join("\n")}\n`);
      current = [];
      currentBytes = 0;
    }
    current.push(statement);
    currentBytes += bytes;
  }
  if (current.length) chunks.push(`${current.join("\n")}\n`);
  return chunks;
}
