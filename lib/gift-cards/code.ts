/**
 * Gift-card bearer-code generation and one-way lookup identities.
 *
 * This module intentionally uses Web Crypto only so the same contract runs in
 * Cloudflare Workers and the Node test environment. Raw bearer codes leave
 * this module only when they are generated or explicitly normalized; lookup
 * results contain only a key version and HMAC digest.
 */

const CODE_PREFIX = "GC";
const CODE_GROUPS = 7;
const CODE_GROUP_LENGTH = 4;
const CODE_SYMBOL_COUNT = CODE_GROUPS * CODE_GROUP_LENGTH;

// Uppercase symbols with the most common lookalike pairs removed: 0/O and 1/I.
// Thirty-two symbols preserve exactly five bits of entropy per output symbol.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_ALPHABET_PATTERN = "23456789A-HJ-NP-Z";

const RANDOM_BATCH_BYTES = 64;
const MAX_RANDOM_BATCHES = 128;
// Seven complete 32-symbol buckets. Values 224..255 are deliberately rejected,
// making the absence of modulo bias explicit and adversarially testable.
const RANDOM_ACCEPTANCE_LIMIT = CODE_ALPHABET.length * 7;

const HMAC_PURPOSE = "mercora:gift-card:bearer-code";
const DIGEST_CONTRACT_VERSION = 1;
const MIN_KEY_BYTES = 32;
const MAX_KEY_BYTES = 4_096;
const MAX_KEY_VERSIONS = 4;

const encoder = new TextEncoder();

export const GIFT_CARD_CODE_ENTROPY_BITS = CODE_SYMBOL_COUNT * Math.log2(CODE_ALPHABET.length);
export const GIFT_CARD_CODE_LENGTH = CODE_PREFIX.length + CODE_GROUPS + CODE_SYMBOL_COUNT;
export const GIFT_CARD_CODE_DIGEST_CONTRACT_VERSION = DIGEST_CONTRACT_VERSION;
export const MAX_GIFT_CARD_CODE_KEY_VERSIONS = MAX_KEY_VERSIONS;

export interface GiftCardKeyRing {
  currentVersion: number;
  keys: Readonly<Record<number, string | Uint8Array>>;
}

export interface GiftCardCodeLookup {
  keyVersion: number;
  digest: string;
}

export interface GenerateGiftCardCodeOptions {
  /** Test seam. Production callers must omit this and use crypto.getRandomValues. */
  randomFill?: (target: Uint8Array) => void;
}

export class GiftCardCodeConfigurationError extends Error {
  constructor() {
    super("Gift-card code key ring is invalid or unavailable");
    this.name = "GiftCardCodeConfigurationError";
  }
}

export class GiftCardCodeGenerationError extends Error {
  constructor() {
    super("Gift-card code generation failed");
    this.name = "GiftCardCodeGenerationError";
  }
}

export class GiftCardCodeCryptoError extends Error {
  constructor() {
    super("Gift-card code digest could not be computed");
    this.name = "GiftCardCodeCryptoError";
  }
}

interface ResolvedKey {
  version: number;
  bytes: Uint8Array<ArrayBuffer>;
}

interface ResolvedKeyRing {
  current: ResolvedKey;
  verification: ResolvedKey[];
}

function validKeyVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function canonicalVersionKey(value: string): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const version = Number(value);
  return validKeyVersion(version) && String(version) === value ? version : null;
}

function keyBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
  let bytes: Uint8Array<ArrayBuffer>;
  if (typeof value === "string") {
    bytes = encoder.encode(value);
  } else if (value instanceof Uint8Array) {
    // Uint8Array.from always creates an ordinary ArrayBuffer-backed copy, even
    // when the caller provides a SharedArrayBuffer-backed view.
    bytes = Uint8Array.from(value);
  } else {
    return null;
  }
  return bytes.length >= MIN_KEY_BYTES && bytes.length <= MAX_KEY_BYTES ? bytes : null;
}

function resolveKeyRingUnsafe(value: GiftCardKeyRing): ResolvedKeyRing | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !validKeyVersion(value.currentVersion)) {
    return null;
  }
  const keys = value.keys as unknown;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return null;
  const prototype = Object.getPrototypeOf(keys);
  if (prototype !== Object.prototype && prototype !== null) return null;

  const entries = Object.entries(keys);
  if (entries.length === 0 || entries.length > MAX_KEY_VERSIONS) return null;
  const resolved: ResolvedKey[] = [];
  for (const [rawVersion, rawKey] of entries) {
    const version = canonicalVersionKey(rawVersion);
    const bytes = keyBytes(rawKey);
    if (version === null || !bytes) return null;
    resolved.push({ version, bytes });
  }
  const current = resolved.find((entry) => entry.version === value.currentVersion);
  if (!current) return null;

  // Current first keeps creation and the common lookup path aligned. Remaining
  // versions are newest-first so key rotation order is deterministic.
  const verification = [
    current,
    ...resolved
      .filter((entry) => entry.version !== current.version)
      .sort((left, right) => right.version - left.version),
  ];
  return { current, verification };
}

function resolveKeyRing(value: GiftCardKeyRing): ResolvedKeyRing {
  try {
    const resolved = resolveKeyRingUnsafe(value);
    if (resolved) return resolved;
  } catch {
    // Proxies/getters are configuration input too. Never preserve their errors,
    // which could contain key material or other operator secrets.
  }
  throw new GiftCardCodeConfigurationError();
}

function formatCode(symbols: string): string {
  const groups = Array.from({ length: CODE_GROUPS }, (_, index) =>
    symbols.slice(index * CODE_GROUP_LENGTH, (index + 1) * CODE_GROUP_LENGTH)
  );
  return `${CODE_PREFIX}-${groups.join("-")}`;
}

/** Generate one neutral, 140-bit bearer code with rejection-sampled CSPRNG bytes. */
export function generateGiftCardCode(options: GenerateGiftCardCodeOptions = {}): string {
  const randomFill = options.randomFill ?? ((target: Uint8Array) => {
    crypto.getRandomValues(target);
  });
  let symbols = "";
  try {
    for (let batch = 0; batch < MAX_RANDOM_BATCHES && symbols.length < CODE_SYMBOL_COUNT; batch += 1) {
      const bytes = new Uint8Array(RANDOM_BATCH_BYTES);
      randomFill(bytes);
      for (const byte of bytes) {
        if (byte >= RANDOM_ACCEPTANCE_LIMIT) continue;
        symbols += CODE_ALPHABET[byte % CODE_ALPHABET.length];
        if (symbols.length === CODE_SYMBOL_COUNT) break;
      }
    }
  } catch {
    throw new GiftCardCodeGenerationError();
  }
  if (symbols.length !== CODE_SYMBOL_COUNT) throw new GiftCardCodeGenerationError();
  return formatCode(symbols);
}

/**
 * Normalize only the exact public format. Lowercase ASCII is accepted for
 * human entry, but separator positions, length, prefix, and alphabet are fixed.
 */
export function normalizeGiftCardCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length !== GIFT_CARD_CODE_LENGTH) return null;
  if (!/^[A-Za-z0-9-]+$/.test(value)) return null;
  const normalized = value.toUpperCase();
  const pattern = new RegExp(
    `^${CODE_PREFIX}(?:-[${CODE_ALPHABET_PATTERN}]{${CODE_GROUP_LENGTH}}){${CODE_GROUPS}}$`,
  );
  return pattern.test(normalized) ? normalized : null;
}

function digestMessage(code: string, keyVersion: number): Uint8Array<ArrayBuffer> {
  return encoder.encode([
    HMAC_PURPOSE,
    `digest:v${DIGEST_CONTRACT_VERSION}`,
    `key:${keyVersion}`,
    code,
  ].join("\u0000"));
}

function hex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

async function lookupFor(code: string, key: ResolvedKey): Promise<GiftCardCodeLookup> {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key.bytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      digestMessage(code, key.version),
    );
    return Object.freeze({ keyVersion: key.version, digest: hex(new Uint8Array(signature)) });
  } catch {
    throw new GiftCardCodeCryptoError();
  }
}

/** Build the current-version identity stored when a new gift card is issued. */
export async function digestGiftCardCode(
  value: unknown,
  keyRing: GiftCardKeyRing,
): Promise<GiftCardCodeLookup | null> {
  const resolved = resolveKeyRing(keyRing);
  const code = normalizeGiftCardCode(value);
  return code ? lookupFor(code, resolved.current) : null;
}

/**
 * Build fixed-shape lookup identities for current and bounded rotation keys.
 * The raw bearer code is never included in a returned object.
 */
export async function giftCardLookupCandidates(
  value: unknown,
  keyRing: GiftCardKeyRing,
): Promise<readonly GiftCardCodeLookup[]> {
  const resolved = resolveKeyRing(keyRing);
  const code = normalizeGiftCardCode(value);
  if (!code) return Object.freeze([]);
  return Object.freeze(await Promise.all(
    resolved.verification.map((key) => lookupFor(code, key)),
  ));
}
