import { normalizeGiftCardCode } from "./code";

const AEAD_PURPOSE = "mercora:gift-card:delivery-code";
const AEAD_CONTRACT_VERSION = 1;
const AES_KEY_BYTES = 32;
const NONCE_BYTES = 12;
const GCM_TAG_BITS = 128;
const GCM_TAG_BYTES = GCM_TAG_BITS / 8;
const MAX_KEY_VERSIONS = 4;
const MAX_ID_LENGTH = 128;
const KEY_STRING_PREFIX = "base64:";

const STANDARD_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BOUNDED_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const GIFT_CARD_DELIVERY_ENCRYPTION_CONTRACT_VERSION = AEAD_CONTRACT_VERSION;
export const GIFT_CARD_DELIVERY_KEY_BYTES = AES_KEY_BYTES;
export const GIFT_CARD_DELIVERY_NONCE_BYTES = NONCE_BYTES;
export const MAX_GIFT_CARD_DELIVERY_KEY_VERSIONS = MAX_KEY_VERSIONS;

export interface GiftCardEncryptionKeyRing {
  currentVersion: number;
  /**
   * String keys use the exact `base64:<canonical padded standard-base64>`
   * contract. Uint8Array keys are copied before use. Both must be 32 bytes.
   */
  keys: Readonly<Record<number, string | Uint8Array>>;
}

export interface EncryptedGiftCardDeliveryCode {
  keyVersion: number;
  nonce: string;
  ciphertext: string;
}

export interface GiftCardDeliveryAad {
  giftCardId: string;
  deliveryId: string;
}

export interface EncryptGiftCardDeliveryCodeInput extends GiftCardDeliveryAad {
  code: string;
  keyRing: GiftCardEncryptionKeyRing;
  /** Test seam. Production callers must omit this and use crypto.getRandomValues. */
  randomFill?: (target: Uint8Array) => void;
}

export interface DecryptGiftCardDeliveryCodeInput extends GiftCardDeliveryAad {
  encrypted: unknown;
  keyRing: GiftCardEncryptionKeyRing;
}

export class GiftCardEncryptionConfigurationError extends Error {
  constructor() {
    super("Gift-card delivery encryption key ring is invalid or unavailable");
    this.name = "GiftCardEncryptionConfigurationError";
  }
}

export class GiftCardEncryptionInputError extends Error {
  constructor() {
    super("Gift-card delivery encryption input is invalid");
    this.name = "GiftCardEncryptionInputError";
  }
}

export class GiftCardEncryptionError extends Error {
  constructor() {
    super("Gift-card delivery code could not be encrypted");
    this.name = "GiftCardEncryptionError";
  }
}

export class GiftCardDecryptionError extends Error {
  constructor() {
    super("Gift-card delivery code could not be decrypted");
    this.name = "GiftCardDecryptionError";
  }
}

interface ResolvedKey {
  version: number;
  bytes: Uint8Array<ArrayBuffer>;
}

interface ResolvedKeyRing {
  current: ResolvedKey;
  byVersion: Map<number, ResolvedKey>;
  all: ResolvedKey[];
}

function validKeyVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function canonicalVersionKey(value: string): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const version = Number(value);
  return validKeyVersion(version) && String(version) === value ? version : null;
}

function standardBase64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function standardBase64Decode(value: unknown, maximumLength: number): Uint8Array<ArrayBuffer> | null {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximumLength
    || value.length % 4 !== 0
    || !STANDARD_BASE64_PATTERN.test(value)
  ) {
    return null;
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return standardBase64Encode(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function keyBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (value instanceof Uint8Array) {
    const copied = Uint8Array.from(value);
    if (copied.length === AES_KEY_BYTES) return copied;
    copied.fill(0);
    return null;
  }
  if (typeof value !== "string" || !value.startsWith(KEY_STRING_PREFIX)) return null;
  const decoded = standardBase64Decode(value.slice(KEY_STRING_PREFIX.length), 44);
  if (!decoded || decoded.length === AES_KEY_BYTES) return decoded;
  decoded.fill(0);
  return null;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataEntries(value: Record<string, unknown>): Array<[string, unknown]> | null {
  const properties = Reflect.ownKeys(value);
  if (properties.some((property) => typeof property !== "string")) return null;
  const entries: Array<[string, unknown]> = [];
  for (const property of properties as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, property);
    if (!descriptor?.enumerable || !("value" in descriptor)) return null;
    entries.push([property, descriptor.value]);
  }
  return entries;
}

function resolveKeyRingUnsafe(value: GiftCardEncryptionKeyRing): ResolvedKeyRing | null {
  if (!plainRecord(value) || !validKeyVersion(value.currentVersion) || !plainRecord(value.keys)) {
    return null;
  }
  const entries = ownDataEntries(value.keys);
  if (!entries || entries.length === 0 || entries.length > MAX_KEY_VERSIONS) return null;

  const all: ResolvedKey[] = [];
  const byVersion = new Map<number, ResolvedKey>();
  let valid = false;
  try {
    for (const [rawVersion, rawKey] of entries) {
      const version = canonicalVersionKey(rawVersion);
      const bytes = keyBytes(rawKey);
      if (version === null || !bytes || byVersion.has(version)) {
        bytes?.fill(0);
        return null;
      }
      const resolved = { version, bytes };
      all.push(resolved);
      byVersion.set(version, resolved);
    }
    const current = byVersion.get(value.currentVersion);
    if (!current) return null;
    valid = true;
    return { current, byVersion, all };
  } finally {
    if (!valid) {
      for (const key of all) key.bytes.fill(0);
    }
  }
}

function resolveKeyRing(value: GiftCardEncryptionKeyRing): ResolvedKeyRing {
  try {
    const resolved = resolveKeyRingUnsafe(value);
    if (resolved) return resolved;
  } catch {
    // Hostile proxies and getters are configuration too. Their original errors
    // may contain key material and must never escape this boundary.
  }
  throw new GiftCardEncryptionConfigurationError();
}

function zeroizeKeyRing(keyRing: ResolvedKeyRing): void {
  for (const key of keyRing.all) key.bytes.fill(0);
}

function validAadId(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= MAX_ID_LENGTH
    && BOUNDED_ID_PATTERN.test(value);
}

function additionalData(
  giftCardId: string,
  deliveryId: string,
  keyVersion: number,
): Uint8Array<ArrayBuffer> {
  return encoder.encode([
    AEAD_PURPOSE,
    `aead:v${AEAD_CONTRACT_VERSION}`,
    `key:${keyVersion}`,
    `gift-card:${giftCardId}`,
    `delivery:${deliveryId}`,
  ].join("\u0000"));
}

async function importEncryptionKey(
  bytes: Uint8Array<ArrayBuffer>,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [usage]);
}

function exactEncryptedPayload(value: unknown): EncryptedGiftCardDeliveryCode | null {
  try {
    if (!plainRecord(value)) return null;
    const entries = ownDataEntries(value);
    if (!entries || entries.map(([key]) => key).sort().join(",") !== "ciphertext,keyVersion,nonce") {
      return null;
    }
    const keyVersion = value.keyVersion;
    const nonce = standardBase64Decode(value.nonce, 16);
    // A canonical 37-byte gift code plus the 16-byte GCM tag is exactly 53
    // encrypted bytes and therefore 72 padded standard-base64 characters.
    const ciphertext = standardBase64Decode(value.ciphertext, 72);
    if (
      !validKeyVersion(keyVersion)
      || nonce?.length !== NONCE_BYTES
      || ciphertext?.length !== 37 + GCM_TAG_BYTES
    ) {
      nonce?.fill(0);
      ciphertext?.fill(0);
      return null;
    }
    nonce.fill(0);
    ciphertext.fill(0);
    return {
      keyVersion,
      nonce: value.nonce as string,
      ciphertext: value.ciphertext as string,
    };
  } catch {
    return null;
  }
}

/** Encrypt one canonical bearer code for durable, retryable delivery. */
export async function encryptGiftCardDeliveryCode(
  input: EncryptGiftCardDeliveryCodeInput,
): Promise<EncryptedGiftCardDeliveryCode> {
  const keyRing = resolveKeyRing(input.keyRing);
  let plaintext: Uint8Array<ArrayBuffer> | undefined;
  let nonce: Uint8Array<ArrayBuffer> | undefined;
  try {
    if (
      normalizeGiftCardCode(input.code) !== input.code
      || !validAadId(input.giftCardId)
      || !validAadId(input.deliveryId)
    ) {
      throw new GiftCardEncryptionInputError();
    }
    plaintext = encoder.encode(input.code);
    nonce = new Uint8Array(NONCE_BYTES);
    const randomFill = input.randomFill ?? ((target: Uint8Array) => {
      crypto.getRandomValues(target);
    });
    try {
      randomFill(nonce);
    } catch {
      throw new GiftCardEncryptionError();
    }

    const cryptoKey = await importEncryptionKey(keyRing.current.bytes, "encrypt");
    const encrypted = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv: nonce,
      additionalData: additionalData(input.giftCardId, input.deliveryId, keyRing.current.version),
      tagLength: GCM_TAG_BITS,
    }, cryptoKey, plaintext);
    return Object.freeze({
      keyVersion: keyRing.current.version,
      nonce: standardBase64Encode(nonce),
      ciphertext: standardBase64Encode(new Uint8Array(encrypted)),
    });
  } catch (error) {
    if (error instanceof GiftCardEncryptionInputError || error instanceof GiftCardEncryptionError) {
      throw error;
    }
    throw new GiftCardEncryptionError();
  } finally {
    plaintext?.fill(0);
    nonce?.fill(0);
    zeroizeKeyRing(keyRing);
  }
}

/** Decrypt only for immediate delivery, binding ciphertext to both stored IDs. */
export async function decryptGiftCardDeliveryCode(
  input: DecryptGiftCardDeliveryCodeInput,
): Promise<string> {
  const keyRing = resolveKeyRing(input.keyRing);
  let nonce: Uint8Array<ArrayBuffer> | undefined;
  let ciphertext: Uint8Array<ArrayBuffer> | undefined;
  let plaintext: Uint8Array<ArrayBuffer> | undefined;
  try {
    if (!validAadId(input.giftCardId) || !validAadId(input.deliveryId)) {
      throw new GiftCardDecryptionError();
    }
    const encrypted = exactEncryptedPayload(input.encrypted);
    if (!encrypted) throw new GiftCardDecryptionError();
    const key = keyRing.byVersion.get(encrypted.keyVersion);
    if (!key) throw new GiftCardDecryptionError();
    nonce = standardBase64Decode(encrypted.nonce, 16) ?? undefined;
    ciphertext = standardBase64Decode(encrypted.ciphertext, 72) ?? undefined;
    if (!nonce || !ciphertext) throw new GiftCardDecryptionError();

    const cryptoKey = await importEncryptionKey(key.bytes, "decrypt");
    const decrypted = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: nonce,
      additionalData: additionalData(input.giftCardId, input.deliveryId, encrypted.keyVersion),
      tagLength: GCM_TAG_BITS,
    }, cryptoKey, ciphertext);
    plaintext = new Uint8Array(decrypted);
    const code = decoder.decode(plaintext);
    if (normalizeGiftCardCode(code) !== code) throw new GiftCardDecryptionError();
    return code;
  } catch {
    throw new GiftCardDecryptionError();
  } finally {
    nonce?.fill(0);
    ciphertext?.fill(0);
    plaintext?.fill(0);
    zeroizeKeyRing(keyRing);
  }
}
