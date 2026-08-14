import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { providerFingerprint } from "./ids.js";

const ARTIFACT_VERSION = 1;
const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const safeLabel = /^[a-z][a-z0-9_-]{0,31}$/;

export interface IdMapArtifact {
  version: 1;
  authoritative: false;
  provider: string;
  mappings: Record<string, Record<string, string>>;
}

export interface MigrationManifest {
  version: 1;
  authoritative: false;
  generatedAt: string;
  dryRun: boolean;
  target: "local" | "preview" | "production";
  entities: Record<string, { source: number; transformed: number; written: number; skipped: number; errors: number }>;
}

function normalizeLabel(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!safeLabel.test(normalized)) throw new Error(`${field} is invalid`);
  return normalized;
}

function outputPath(root: string, requestedPath: string): string {
  if (!requestedPath || isAbsolute(requestedPath) || requestedPath.includes("\0")) {
    throw new Error("Artifact path must be a relative path");
  }
  mkdirSync(resolve(root), { recursive: true, mode: 0o700 });
  const absoluteRoot = realpathSync(root);
  const candidate = resolve(absoluteRoot, requestedPath);
  const child = relative(absoluteRoot, candidate);
  if (child.startsWith("..") || isAbsolute(child)) throw new Error("Artifact path escapes the configured output root");
  let cursor = absoluteRoot;
  for (const part of child.split(sep)) {
    cursor = resolve(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error("Artifact path may not traverse a symbolic link");
    }
  }
  return candidate;
}

function validateTargetId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,255}$/.test(normalized)) {
    throw new Error("Target ID is invalid or may contain sensitive data");
  }
  return normalized;
}

export class IdMap {
  private readonly mappings = new Map<string, Map<string, string>>();
  readonly provider: string;

  constructor(provider: string) {
    this.provider = normalizeLabel(provider, "provider");
  }

  register(entity: string, providerSourceId: string | number, targetId: string): void {
    const entityName = normalizeLabel(entity, "entity");
    const fingerprint = providerFingerprint(this.provider, entityName, providerSourceId);
    const normalizedTarget = validateTargetId(targetId);
    const entries = this.mappings.get(entityName) ?? new Map<string, string>();
    const existing = entries.get(fingerprint);
    if (existing && existing !== normalizedTarget) throw new Error("Provider identity is already mapped to a different target");
    entries.set(fingerprint, normalizedTarget);
    this.mappings.set(entityName, entries);
  }

  resolve(entity: string, providerSourceId: string | number): string | undefined {
    const entityName = normalizeLabel(entity, "entity");
    return this.mappings.get(entityName)?.get(providerFingerprint(this.provider, entityName, providerSourceId));
  }

  count(entity: string): number {
    return this.mappings.get(normalizeLabel(entity, "entity"))?.size ?? 0;
  }

  toArtifact(): IdMapArtifact {
    const mappings: Record<string, Record<string, string>> = {};
    for (const [entity, values] of [...this.mappings].sort(([left], [right]) => left.localeCompare(right))) {
      mappings[entity] = Object.fromEntries([...values].sort(([left], [right]) => left.localeCompare(right)));
    }
    return { version: ARTIFACT_VERSION, authoritative: false, provider: this.provider, mappings };
  }

  save(root: string, requestedPath: string): void {
    const path = outputPath(root, requestedPath);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, `${JSON.stringify(this.toArtifact(), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  static load(root: string, requestedPath: string): IdMap {
    const path = outputPath(root, requestedPath);
    const content = readFileSync(path, "utf8");
    if (Buffer.byteLength(content) > MAX_ARTIFACT_BYTES) throw new Error("ID map artifact is too large");
    const raw: unknown = JSON.parse(content);
    if (!raw || typeof raw !== "object") throw new Error("ID map artifact is invalid");
    const artifact = raw as Partial<IdMapArtifact>;
    if (artifact.version !== 1 || artifact.authoritative !== false || !artifact.provider || !artifact.mappings) {
      throw new Error("ID map artifact has an unsupported or authoritative format");
    }
    const map = new IdMap(artifact.provider);
    for (const [entity, entries] of Object.entries(artifact.mappings)) {
      normalizeLabel(entity, "entity");
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("ID map entries are invalid");
      const values = new Map<string, string>();
      for (const [fingerprint, targetId] of Object.entries(entries)) {
        if (!/^[a-f0-9]{64}$/.test(fingerprint) || typeof targetId !== "string") throw new Error("ID map entry is invalid");
        values.set(fingerprint, validateTargetId(targetId));
      }
      map.mappings.set(entity, values);
    }
    return map;
  }
}

export function writeManifest(root: string, requestedPath: string, manifest: MigrationManifest): void {
  if (manifest.version !== 1 || manifest.authoritative !== false) throw new Error("Manifest must be explicitly non-authoritative");
  if (!Number.isFinite(Date.parse(manifest.generatedAt))) throw new Error("Manifest generatedAt must be an ISO timestamp");
  if (typeof manifest.dryRun !== "boolean" || !(["local", "preview", "production"] as const).includes(manifest.target)) {
    throw new Error("Manifest execution metadata is invalid");
  }
  const entities: MigrationManifest["entities"] = {};
  for (const [entity, counts] of Object.entries(manifest.entities)) {
    const entityName = normalizeLabel(entity, "entity");
    for (const [name, count] of Object.entries(counts)) {
      if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Manifest ${entityName}.${name} count is invalid`);
    }
    entities[entityName] = { ...counts };
  }
  const path = outputPath(root, requestedPath);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify({ ...manifest, entities }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
