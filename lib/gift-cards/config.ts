import {
  MAX_GIFT_CARD_CODE_KEY_VERSIONS,
  type GiftCardKeyRing,
} from "./code";
import {
  MAX_GIFT_CARD_DELIVERY_KEY_VERSIONS,
  type GiftCardEncryptionKeyRing,
} from './encryption';

export const GIFT_CARD_HMAC_CURRENT_VERSION_ENV = "GIFT_CARD_CODE_HMAC_CURRENT_VERSION";
export const GIFT_CARD_HMAC_KEYS_ENV = "GIFT_CARD_CODE_HMAC_KEYS_JSON";
export const GIFT_CARD_DELIVERY_CURRENT_VERSION_ENV = 'GIFT_CARD_DELIVERY_CURRENT_VERSION';
export const GIFT_CARD_DELIVERY_KEYS_ENV = 'GIFT_CARD_DELIVERY_KEYS_JSON';

const MIN_KEY_BYTES = 32;
const MAX_KEY_BYTES = 4_096;
const MAX_KEY_RING_JSON_LENGTH = 20_000;
const encoder = new TextEncoder();

export type GiftCardSecretEnvironment = Record<string, unknown>;

export class GiftCardRuntimeConfigurationError extends Error {
  constructor() {
    super("Gift-card runtime configuration is unavailable");
    this.name = "GiftCardRuntimeConfigurationError";
  }
}

function positiveSafeInteger(value: string | undefined): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && String(parsed) === value ? parsed : null;
}

/**
 * Parse the server-only HMAC rotation ring from the current request's runtime
 * environment. These values must never travel through StoreConfig or a public
 * `NEXT_PUBLIC_*` variable.
 */
export function parseGiftCardCodeKeyRing(
  environment: GiftCardSecretEnvironment,
): GiftCardKeyRing {
  try {
    const currentVersion = positiveSafeInteger(
      typeof environment[GIFT_CARD_HMAC_CURRENT_VERSION_ENV] === "string"
        ? environment[GIFT_CARD_HMAC_CURRENT_VERSION_ENV].trim()
        : undefined,
    );
    const serialized = environment[GIFT_CARD_HMAC_KEYS_ENV];
    if (
      currentVersion === null
      || typeof serialized !== "string"
      || serialized.length < 2
      || serialized.length > MAX_KEY_RING_JSON_LENGTH
    ) {
      throw new GiftCardRuntimeConfigurationError();
    }

    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new GiftCardRuntimeConfigurationError();
    }
    const keys = parsed as Record<string, unknown>;
    const versions = Object.keys(keys);
    if (versions.length < 1 || versions.length > MAX_GIFT_CARD_CODE_KEY_VERSIONS) {
      throw new GiftCardRuntimeConfigurationError();
    }

    const resolved: Record<number, string> = {};
    for (const rawVersion of versions) {
      const version = positiveSafeInteger(rawVersion);
      const key = keys[rawVersion];
      const byteLength = typeof key === "string" ? encoder.encode(key).length : 0;
      if (
        version === null
        || typeof key !== "string"
        || byteLength < MIN_KEY_BYTES
        || byteLength > MAX_KEY_BYTES
      ) {
        throw new GiftCardRuntimeConfigurationError();
      }
      resolved[version] = key;
    }
    if (!Object.hasOwn(resolved, currentVersion)) {
      throw new GiftCardRuntimeConfigurationError();
    }

    return Object.freeze({
      currentVersion,
      keys: Object.freeze(resolved),
    });
  } catch (error) {
    if (error instanceof GiftCardRuntimeConfigurationError) throw error;
    throw new GiftCardRuntimeConfigurationError();
  }
}

/** Parse the server-only AES-GCM delivery retry key ring. */
export function parseGiftCardDeliveryKeyRing(
  environment: GiftCardSecretEnvironment,
): GiftCardEncryptionKeyRing {
  try {
    const currentVersion = positiveSafeInteger(
      typeof environment[GIFT_CARD_DELIVERY_CURRENT_VERSION_ENV] === 'string'
        ? environment[GIFT_CARD_DELIVERY_CURRENT_VERSION_ENV].trim() : undefined,
    );
    const serialized = environment[GIFT_CARD_DELIVERY_KEYS_ENV];
    if (currentVersion === null || typeof serialized !== 'string' || serialized.length < 2 ||
        serialized.length > MAX_KEY_RING_JSON_LENGTH) throw new GiftCardRuntimeConfigurationError();
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new GiftCardRuntimeConfigurationError();
    }
    const keys = parsed as Record<string, unknown>;
    const versions = Object.keys(keys);
    if (versions.length < 1 || versions.length > MAX_GIFT_CARD_DELIVERY_KEY_VERSIONS) {
      throw new GiftCardRuntimeConfigurationError();
    }
    const resolved: Record<number, string> = {};
    for (const rawVersion of versions) {
      const version = positiveSafeInteger(rawVersion);
      const key = keys[rawVersion];
      if (version === null || typeof key !== 'string' || !/^base64:[A-Za-z0-9+/]+={0,2}$/.test(key)) {
        throw new GiftCardRuntimeConfigurationError();
      }
      resolved[version] = key;
    }
    if (!Object.hasOwn(resolved, currentVersion)) throw new GiftCardRuntimeConfigurationError();
    return Object.freeze({ currentVersion, keys: Object.freeze(resolved) });
  } catch (error) {
    if (error instanceof GiftCardRuntimeConfigurationError) throw error;
    throw new GiftCardRuntimeConfigurationError();
  }
}
