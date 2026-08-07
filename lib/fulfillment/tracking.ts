import {
  DEFAULT_CARRIER_REGISTRY,
  type Carrier,
  type CarrierDefinition,
  type CarrierRegistry,
} from "./types";

/** Generous upper bound that prevents unbounded values in storage and links. */
export const MAX_TRACKING_LENGTH = 100;

const TRACKING_ALLOWLIST = /[^A-Za-z0-9-]/g;
const STRICT_TRACKING_PATTERN = /^[A-Za-z0-9-]+$/;
const CARRIER_CODE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function definitions(registry: CarrierRegistry): readonly CarrierDefinition[] {
  return registry.definitions;
}

function compactCarrierToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s._-]/g, "");
}

function normalizedDefinitionCode(definition: CarrierDefinition): string | null {
  const code = definition.code.trim().toLowerCase();
  return CARRIER_CODE_PATTERN.test(code) ? code : null;
}

/** Strict API-input normalization against the selected registry. */
export function normalizeCarrier(
  raw: unknown,
  registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY,
): Carrier | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (!CARRIER_CODE_PATTERN.test(value)) return null;
  const match = definitions(registry).find(
    (definition) => normalizedDefinitionCode(definition) === value,
  );
  return match ? value : null;
}

/**
 * Lenient normalization for historical free-text carrier values. Unknown,
 * non-empty values become `other` when that fallback is registered.
 */
export function normalizeLegacyCarrier(
  raw: unknown,
  registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY,
): Carrier | null {
  if (typeof raw !== "string") return null;
  const token = compactCarrierToken(raw);
  if (!token) return null;

  let bestMatch: { code: Carrier; aliasLength: number } | null = null;
  let ambiguous = false;
  for (const definition of definitions(registry)) {
    const code = normalizedDefinitionCode(definition);
    if (!code || code === "other") continue;
    const aliases = [code, ...(definition.legacyAliases ?? [])]
      .map(compactCarrierToken)
      .filter(Boolean);
    for (const alias of aliases) {
      if (!token.startsWith(alias)) continue;
      if (!bestMatch || alias.length > bestMatch.aliasLength) {
        bestMatch = { code, aliasLength: alias.length };
        ambiguous = false;
      } else if (alias.length === bestMatch.aliasLength && code !== bestMatch.code) {
        ambiguous = true;
      }
    }
  }

  if (bestMatch && !ambiguous) return bestMatch.code;
  return normalizeCarrier("other", registry);
}

/** Strip everything outside the explicit ASCII tracking-number allowlist. */
export function sanitizeTrackingNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(TRACKING_ALLOWLIST, "");
  if (!stripped || stripped.length > MAX_TRACKING_LENGTH) return null;
  return stripped;
}

/** Validate API input exactly; never mutate operator-supplied shipment data. */
export function validateTrackingNumber(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.trim() !== raw ||
    raw.length === 0 ||
    raw.length > MAX_TRACKING_LENGTH ||
    !STRICT_TRACKING_PATTERN.test(raw)
  ) {
    return null;
  }
  return raw;
}

/**
 * Build a tracking link from trusted registry configuration only. Non-HTTPS,
 * credential-bearing, malformed, or non-carrier URLs are never returned.
 */
export function buildTrackingUrl(
  carrier: Carrier | null,
  trackingNumber: string | null,
  registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY,
): string | null {
  const normalizedCarrier = normalizeCarrier(carrier, registry);
  const validatedTrackingNumber = validateTrackingNumber(trackingNumber);
  if (!normalizedCarrier || !validatedTrackingNumber) return null;

  const definition = definitions(registry).find(
    (candidate) => normalizedDefinitionCode(candidate) === normalizedCarrier,
  );
  if (!definition?.trackingUrl) return null;

  try {
    const built = definition.trackingUrl(validatedTrackingNumber);
    if (!built) return null;
    const url = built instanceof URL ? new URL(built.toString()) : new URL(built);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
