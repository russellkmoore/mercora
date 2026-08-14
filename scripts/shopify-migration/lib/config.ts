import { resolve } from "node:path";

export type SourceMode = "api" | "file";
export type MigrationTarget = "local" | "preview" | "production";

export interface ExecutionPlan {
  dryRun: boolean;
  apply: boolean;
  target: MigrationTarget;
  includeSensitive: boolean;
  overwrite: boolean;
  confirmedSensitiveData: boolean;
  confirmedPreview: boolean;
  confirmedProduction: boolean;
  confirmedOverwrite: boolean;
}

export interface MigrationConfig {
  sourceMode: SourceMode;
  shopify?: {
    origin: string;
    accessToken: string;
    apiVersion: string;
  };
  inputRoot?: string;
  outputRoot?: string;
  wranglerEnvironment?: string;
  execution: ExecutionPlan;
}

export type Environment = Record<string, string | undefined>;

function requiredValue(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

export function validateShopifyOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SHOPIFY_STORE_URL must be a valid HTTPS myshopify.com origin");
  }
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/i.test(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      "SHOPIFY_STORE_URL must be an exact HTTPS *.myshopify.com origin without credentials, port, path, query, or fragment",
    );
  }
  return url.origin;
}

export function validateShopifyApiVersion(value: string): string {
  const version = value.trim();
  if (!/^20\d{2}-(?:01|04|07|10)$/.test(version)) {
    throw new Error("SHOPIFY_API_VERSION must be an explicit quarterly version such as 2026-07");
  }
  return version;
}

function flagValue(args: readonly string[], name: string): string | undefined {
  const matches = args.filter((arg) => arg.startsWith(`${name}=`));
  if (matches.length > 1) throw new Error(`${name} may only be provided once`);
  return matches[0]?.slice(name.length + 1);
}

function hasFlag(args: readonly string[], name: string): boolean {
  return args.includes(name);
}

export function parseMigrationConfig(
  env: Environment = process.env,
  args: readonly string[] = process.argv.slice(2),
  cwd = process.cwd(),
): MigrationConfig {
  const supported = new Set([
    "--apply",
    "--dry-run",
    "--include-sensitive",
    "--confirm-sensitive-data",
    "--overwrite",
    "--confirm-overwrite",
    "--confirm-preview",
    "--confirm-production",
  ]);
  for (const argument of args) {
    if (supported.has(argument)) continue;
    if (["--source=", "--target=", "--input-root=", "--output-root=", "--env="].some((prefix) => argument.startsWith(prefix))) continue;
    throw new Error(`Unknown migration option: ${argument}`);
  }

  const apply = hasFlag(args, "--apply");
  if (apply && hasFlag(args, "--dry-run")) throw new Error("--apply and --dry-run are mutually exclusive");

  const sourceMode = (flagValue(args, "--source") ?? env.MIGRATION_SOURCE_MODE ?? "file") as SourceMode;
  if (sourceMode !== "api" && sourceMode !== "file") throw new Error("Migration source must be api or file");

  const target = (flagValue(args, "--target") ?? env.MIGRATION_TARGET ?? "local") as MigrationTarget;
  if (!(["local", "preview", "production"] as const).includes(target)) {
    throw new Error("Migration target must be local, preview, or production");
  }

  const includeSensitive = hasFlag(args, "--include-sensitive");
  const confirmedSensitiveData = hasFlag(args, "--confirm-sensitive-data");
  const confirmedPreview = hasFlag(args, "--confirm-preview");
  const confirmedProduction = hasFlag(args, "--confirm-production");
  const overwrite = hasFlag(args, "--overwrite");
  const confirmedOverwrite = hasFlag(args, "--confirm-overwrite");
  if (includeSensitive && !confirmedSensitiveData) {
    throw new Error("--include-sensitive requires --confirm-sensitive-data");
  }
  if (!includeSensitive && confirmedSensitiveData) {
    throw new Error("--confirm-sensitive-data requires --include-sensitive");
  }
  if (apply && target === "preview" && !confirmedPreview) {
    throw new Error("Preview apply requires --confirm-preview");
  }
  if (apply && target === "production" && !confirmedProduction) {
    throw new Error("Production apply requires --confirm-production");
  }
  if (apply && target === "production" && env.MERCORA_ALLOW_PRODUCTION_IMPORTS !== "1") {
    throw new Error("Production apply requires MERCORA_ALLOW_PRODUCTION_IMPORTS=1");
  }
  if (confirmedPreview && target !== "preview") {
    throw new Error("--confirm-preview may only be used with --target=preview");
  }
  if (confirmedProduction && target !== "production") {
    throw new Error("--confirm-production may only be used with --target=production");
  }
  if (overwrite && apply && !confirmedOverwrite) {
    throw new Error("Applying overwrite mode requires --confirm-overwrite");
  }
  if (!overwrite && confirmedOverwrite) {
    throw new Error("--confirm-overwrite requires --overwrite");
  }

  const inputRootValue = flagValue(args, "--input-root") ?? env.MIGRATION_INPUT_ROOT;
  const outputRootValue = flagValue(args, "--output-root") ?? env.MIGRATION_OUTPUT_ROOT;
  const inputRoot = inputRootValue ? resolve(cwd, inputRootValue) : undefined;
  const outputRoot = outputRootValue ? resolve(cwd, outputRootValue) : undefined;
  const wranglerEnvironment = flagValue(args, "--env")?.trim() || undefined;
  if (wranglerEnvironment && !/^[a-z][a-z0-9_-]{0,62}$/i.test(wranglerEnvironment)) {
    throw new Error("Wrangler environment name is invalid");
  }

  const config: MigrationConfig = {
    sourceMode,
    ...(inputRoot ? { inputRoot } : {}),
    ...(outputRoot ? { outputRoot } : {}),
    ...(wranglerEnvironment ? { wranglerEnvironment } : {}),
    execution: {
      dryRun: !apply,
      apply,
      target,
      includeSensitive,
      overwrite,
      confirmedSensitiveData,
      confirmedPreview,
      confirmedProduction,
      confirmedOverwrite,
    },
  };

  if (sourceMode === "file") {
    config.inputRoot = resolve(cwd, requiredValue(inputRootValue, "MIGRATION_INPUT_ROOT"));
  } else {
    config.shopify = {
      origin: validateShopifyOrigin(requiredValue(env.SHOPIFY_STORE_URL, "SHOPIFY_STORE_URL")),
      accessToken: requiredValue(env.SHOPIFY_ACCESS_TOKEN, "SHOPIFY_ACCESS_TOKEN"),
      apiVersion: validateShopifyApiVersion(requiredValue(env.SHOPIFY_API_VERSION, "SHOPIFY_API_VERSION")),
    };
  }

  return config;
}
