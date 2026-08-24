import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { providerFingerprint } from "./ids.js";
import { atomicWritePrivateFile, resolvePrivateArtifactPath } from "./private-atomic-file.js";

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
    const path = resolvePrivateArtifactPath(root, requestedPath);
    atomicWritePrivateFile(path, `${JSON.stringify(this.toArtifact(), null, 2)}\n`, { maxBytes: MAX_ARTIFACT_BYTES });
  }

  static load(root: string, requestedPath: string): IdMap {
    const path = resolvePrivateArtifactPath(root, requestedPath);
    const pathMetadata = lstatSync(path);
    if (pathMetadata.isSymbolicLink() || !pathMetadata.isFile()) throw new Error("ID map artifact must be a regular non-symlink file");
    if (pathMetadata.size > MAX_ARTIFACT_BYTES) throw new Error("ID map artifact is too large");
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let content: string;
    try {
      const descriptorMetadata = fstatSync(fd);
      if (!descriptorMetadata.isFile()) throw new Error("ID map artifact must be a regular non-symlink file");
      if (descriptorMetadata.size > MAX_ARTIFACT_BYTES) throw new Error("ID map artifact is too large");
      const bytes = Buffer.allocUnsafe(MAX_ARTIFACT_BYTES + 1);
      let offset = 0;
      while (offset < bytes.byteLength) {
        const read = readSync(fd, bytes, offset, bytes.byteLength - offset, null);
        if (read === 0) break;
        offset += read;
      }
      if (offset > MAX_ARTIFACT_BYTES) throw new Error("ID map artifact is too large");
      content = bytes.toString("utf8", 0, offset);
    } finally {
      closeSync(fd);
    }
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
  const path = resolvePrivateArtifactPath(root, requestedPath);
  atomicWritePrivateFile(path, `${JSON.stringify({ ...manifest, entities }, null, 2)}\n`, { maxBytes: MAX_ARTIFACT_BYTES });
}
