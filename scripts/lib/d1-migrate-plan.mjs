/** Pure, testable planning helpers for explicit D1 migration commands. */

export function stripJsonComments(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
        output += current;
      }
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      output += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') inString = false;
      continue;
    }
    if (current === '"') {
      inString = true;
      output += current;
    } else if (current === "/" && next === "/") {
      lineComment = true;
      index += 1;
    } else if (current === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else {
      output += current;
    }
  }
  let result = "";
  inString = false;
  escaped = false;

  for (let index = 0; index < output.length; index += 1) {
    const current = output[index];
    if (inString) {
      result += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') inString = false;
      continue;
    }
    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }
    if (current === ",") {
      let next = index + 1;
      while (/\s/.test(output[next] ?? "")) next += 1;
      if (output[next] === "}" || output[next] === "]") continue;
    }
    result += current;
  }

  return result;
}

export function parseWranglerConfig(text) {
  return JSON.parse(stripJsonComments(text));
}

export function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  const value = index === -1 ? undefined : args[index + 1];
  return value?.startsWith("--") ? undefined : value;
}

function databaseFor(config, environment) {
  const environmentConfig = environment ? config.env?.[environment] : undefined;
  const databases = environmentConfig?.d1_databases ?? config.d1_databases;
  const database = databases?.find((candidate) => candidate.binding === "DB") ?? databases?.[0];
  if (!database?.database_name) {
    throw new Error(`No D1 database is configured${environment ? ` for environment "${environment}"` : ""}.`);
  }
  return database;
}

export function resolveTarget(config, { target, environment }) {
  if (!new Set(["local", "preview", "production"]).has(target)) {
    throw new Error(`Unknown target "${target}". Expected local, preview, or production.`);
  }
  const database = databaseFor(config, environment);
  if (target === "preview" && !database.preview_database_id) {
    throw new Error(
      "Preview migration target requested, but the selected D1 binding has no preview_database_id. Refusing to fall back to production.",
    );
  }
  return { database: database.database_name, target, environment };
}

function environmentArgs(environment) {
  return environment ? ["--env", environment] : [];
}

export function migrationArgs(plan, action) {
  const mode = plan.target === "local" ? ["--local"] : ["--remote"];
  const preview = plan.target === "preview" ? ["--preview"] : [];
  return ["d1", "migrations", action, plan.database, ...mode, ...preview, ...environmentArgs(plan.environment)];
}

const migrationFilename = /\b\d{4}_[A-Za-z0-9._-]+\.sql\b/g;

/** Fail closed on output drift instead of treating unknown output as no-op. */
export function interpretMigrationList(output) {
  const clean = String(output ?? "").replace(/\x1b\[[0-9;]*m/g, "");
  const pending = [...new Set(clean.match(migrationFilename) ?? [])];
  if (pending.length) return { status: "pending", pending };
  if (/no migrations to apply/i.test(clean)) return { status: "up-to-date", pending: [] };
  return { status: "unrecognized", pending: [] };
}

export function canApply({ target, flags, environment }) {
  if (target === "local") return { allowed: true };
  if (target === "preview") {
    return flags.includes("--confirm-preview")
      ? { allowed: true }
      : { allowed: false, reason: "Preview apply requires --confirm-preview." };
  }
  return flags.includes("--confirm-production") && environment.MERCORA_ALLOW_PRODUCTION_MIGRATIONS === "1"
    ? { allowed: true }
    : {
        allowed: false,
        reason:
          "Production apply requires --confirm-production and MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1. It is never run by deploy.",
      };
}
