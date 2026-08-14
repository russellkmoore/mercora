import { createHash } from "node:crypto";

function label(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(normalized)) {
    throw new Error(`${field} must be a short lowercase identifier`);
  }
  return normalized;
}

function source(value: string | number): string {
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 512) throw new Error("Provider source ID must be 1-512 characters");
  return normalized;
}

/** One-way identity used in artifacts; the raw provider identifier is never persisted. */
export function providerFingerprint(provider: string, entity: string, sourceId: string | number): string {
  const material = `${label(provider, "provider")}\0${label(entity, "entity")}\0${source(sourceId)}`;
  return createHash("sha256").update(material, "utf8").digest("hex");
}

/** Stable, merchant-neutral Mercora ID derived from a provider identity. */
export function deterministicProviderId(provider: string, entity: string, sourceId: string | number): string {
  const providerName = label(provider, "provider");
  const entityName = label(entity, "entity");
  return `${providerName}_${entityName}_${providerFingerprint(providerName, entityName, sourceId).slice(0, 24)}`;
}
