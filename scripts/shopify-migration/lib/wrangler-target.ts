export type WranglerTarget = "local" | "preview" | "production";

interface D1Binding {
  binding?: unknown;
  database_name?: unknown;
  database_id?: unknown;
  preview_database_id?: unknown;
}

interface R2Binding {
  binding?: unknown;
  bucket_name?: unknown;
  preview_bucket_name?: unknown;
}

interface WranglerSection {
  d1_databases?: unknown;
  r2_buckets?: unknown;
}

interface WranglerConfig extends WranglerSection {
  env?: Record<string, WranglerSection>;
}

export interface WranglerTargetOptions {
  target: WranglerTarget;
  environment?: string;
  expectedName?: string;
}

const MAX_CONFIG_BYTES = 1024 * 1024;
const resourceName = /^[a-z0-9][a-z0-9_-]{1,126}[a-z0-9]$/i;

/** Remove JSONC comments and trailing commas without altering string contents. */
export function stripJsonc(text: string): string {
  let uncommented = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (current === "\n") { lineComment = false; uncommented += current; }
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (inString) {
      uncommented += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') inString = false;
      continue;
    }
    if (current === '"') { inString = true; uncommented += current; }
    else if (current === "/" && next === "/") { lineComment = true; index += 1; }
    else if (current === "/" && next === "*") { blockComment = true; index += 1; }
    else uncommented += current;
  }
  if (inString || blockComment) throw new Error("Wrangler JSONC is truncated");

  let output = "";
  inString = false;
  escaped = false;
  for (let index = 0; index < uncommented.length; index += 1) {
    const current = uncommented[index];
    if (inString) {
      output += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') inString = false;
      continue;
    }
    if (current === '"') { inString = true; output += current; continue; }
    if (current === ",") {
      let next = index + 1;
      while (/\s/.test(uncommented[next] ?? "")) next += 1;
      if (uncommented[next] === "}" || uncommented[next] === "]") continue;
    }
    output += current;
  }
  return output;
}

export function parseWranglerJsonc(text: string): WranglerConfig {
  if (Buffer.byteLength(text, "utf8") > MAX_CONFIG_BYTES) throw new Error("Wrangler config is too large");
  let parsed: unknown;
  try { parsed = JSON.parse(stripJsonc(text)); }
  catch (error) {
    if (error instanceof Error && error.message === "Wrangler JSONC is truncated") throw error;
    throw new Error("Wrangler config is not valid JSONC");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Wrangler config must be an object");
  return parsed as WranglerConfig;
}

function section(config: WranglerConfig, environment: string | undefined): WranglerSection {
  if (!environment) return config;
  const selected = config.env?.[environment];
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
    throw new Error(`Wrangler environment "${environment}" is not configured; refusing root fallback`);
  }
  return selected;
}

function exactBinding<T extends { binding?: unknown }>(value: unknown, binding: string, kind: string): T {
  if (!Array.isArray(value)) throw new Error(`No ${kind} bindings are configured in the selected Wrangler section`);
  const matches = value.filter((candidate): candidate is T =>
    Boolean(candidate) && typeof candidate === "object" && (candidate as T).binding === binding);
  if (matches.length !== 1) throw new Error(`Expected exactly one ${kind} binding named ${binding}`);
  return matches[0];
}

function requiredName(value: unknown, field: string): string {
  if (typeof value !== "string" || !resourceName.test(value)) throw new Error(`${field} is missing or invalid`);
  return value;
}

function assertExpected(actual: string, expected: string | undefined, kind: string): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`Configured ${kind} "${actual}" does not match expected name; refusing override`);
  }
}

export function resolveMediaTarget(config: WranglerConfig, options: WranglerTargetOptions): {
  bucketName: string;
  target: WranglerTarget;
  environment?: string;
} {
  const binding = exactBinding<R2Binding>(section(config, options.environment).r2_buckets, "MEDIA", "R2");
  const bucketName = options.target === "preview"
    ? requiredName(binding.preview_bucket_name, "MEDIA preview_bucket_name")
    : requiredName(binding.bucket_name, "MEDIA bucket_name");
  assertExpected(bucketName, options.expectedName, "MEDIA bucket");
  return { bucketName, target: options.target, ...(options.environment ? { environment: options.environment } : {}) };
}

export function resolveDatabaseTarget(config: WranglerConfig, options: WranglerTargetOptions): {
  databaseName: string;
  databaseId?: string;
  target: WranglerTarget;
  environment?: string;
} {
  const binding = exactBinding<D1Binding>(section(config, options.environment).d1_databases, "DB", "D1");
  const databaseName = requiredName(binding.database_name, "DB database_name");
  const databaseId = options.target === "preview"
    ? requiredName(binding.preview_database_id, "DB preview_database_id")
    : options.target === "production"
      ? requiredName(binding.database_id, "DB database_id")
      : undefined;
  assertExpected(databaseName, options.expectedName, "DB database");
  return {
    databaseName,
    ...(databaseId ? { databaseId } : {}),
    target: options.target,
    ...(options.environment ? { environment: options.environment } : {}),
  };
}
