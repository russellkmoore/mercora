/**
 * Expiring, order-bound guest credentials.
 *
 * Format: `base64url(payload).base64url(HMAC-SHA256(payloadSegment))`.
 * The authenticated payload contains only a version, order id, issued-at time,
 * and expiry time. It intentionally carries no customer or order data.
 */

const TOKEN_VERSION = 1;
const MIN_SECRET_LENGTH = 32;
const SIGNATURE_BYTES = 32;
const ORDER_STATUS_SECRET_PLACEHOLDER = "replace_with_at_least_32_random_characters";
const MAX_ORDER_ID_LENGTH = 200;
const MAX_FUTURE_SKEW_SECONDS = 5 * 60;

export const MIN_ORDER_STATUS_TTL_SECONDS = 5 * 60;
export const DEFAULT_ORDER_STATUS_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_ORDER_STATUS_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MAX_ORDER_STATUS_TOKEN_LENGTH = 1_024;

interface OrderStatusPayload {
  v: number;
  oid: string;
  iat: number;
  exp: number;
}

export interface CreateOrderStatusTokenOptions {
  ttlSeconds?: number;
}

function getSecret(): string | null {
  const enabled = process.env.ORDER_STATUS_GUEST_LINKS_ENABLED?.trim().toLowerCase();
  if (enabled === "false" || (enabled !== undefined && enabled !== "true")) return null;

  const secret = process.env.ORDER_STATUS_SECRET;
  return secret &&
    secret.trim() === secret &&
    secret !== ORDER_STATUS_SECRET_PLACEHOLDER &&
    secret.length >= MIN_SECRET_LENGTH
    ? secret
    : null;
}

function validOrderId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ORDER_ID_LENGTH &&
    value.trim() === value
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
  const padding = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(message)),
  );
}

/** Fixed-work comparison over fixed-length HMAC output. */
function signaturesEqual(expected: Uint8Array, presented: Uint8Array): boolean {
  if (expected.length !== SIGNATURE_BYTES || presented.length !== SIGNATURE_BYTES) return false;
  let mismatch = 0;
  for (let index = 0; index < SIGNATURE_BYTES; index += 1) {
    mismatch |= expected[index] ^ presented[index];
  }
  return mismatch === 0;
}

function parsePayload(bytes: Uint8Array): OrderStatusPayload | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (
      Object.keys(record).sort().join(",") !== "exp,iat,oid,v" ||
      record.v !== TOKEN_VERSION ||
      !validOrderId(record.oid) ||
      typeof record.iat !== "number" ||
      !Number.isSafeInteger(record.iat) ||
      typeof record.exp !== "number" ||
      !Number.isSafeInteger(record.exp)
    ) {
      return null;
    }
    return {
      v: TOKEN_VERSION,
      oid: record.oid,
      iat: record.iat,
      exp: record.exp,
    };
  } catch {
    return null;
  }
}

export function isOrderStatusTokenConfigured(): boolean {
  return getSecret() !== null;
}

export async function createOrderStatusToken(
  orderId: string,
  options: CreateOrderStatusTokenOptions = {},
): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !validOrderId(orderId)) return null;

  const ttlSeconds = options.ttlSeconds ?? DEFAULT_ORDER_STATUS_TTL_SECONDS;
  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < MIN_ORDER_STATUS_TTL_SECONDS ||
    ttlSeconds > MAX_ORDER_STATUS_TTL_SECONDS
  ) {
    return null;
  }

  const issuedAt = Math.floor(Date.now() / 1_000);
  const payload: OrderStatusPayload = {
    v: TOKEN_VERSION,
    oid: orderId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
  const payloadSegment = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256(secret, payloadSegment);
  return `${payloadSegment}.${b64urlEncode(signature)}`;
}

/** Verify signature, version, order binding and lifetime. Malformed input never throws. */
export async function verifyOrderStatusToken(
  token: string,
  orderId: string,
): Promise<boolean> {
  const secret = getSecret();
  if (
    !secret ||
    !validOrderId(orderId) ||
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_ORDER_STATUS_TOKEN_LENGTH
  ) {
    return false;
  }

  try {
    const segments = token.split(".");
    if (segments.length !== 2) return false;
    const [payloadSegment, signatureSegment] = segments;
    const presented = b64urlDecode(signatureSegment);
    if (presented.length !== SIGNATURE_BYTES) return false;

    // Authenticate the bounded encoded bytes before parsing attacker input.
    const expected = await hmacSha256(secret, payloadSegment);
    if (!signaturesEqual(expected, presented)) return false;

    const payload = parsePayload(b64urlDecode(payloadSegment));
    if (!payload || payload.oid !== orderId) return false;

    const lifetime = payload.exp - payload.iat;
    const now = Math.floor(Date.now() / 1_000);
    return (
      lifetime >= MIN_ORDER_STATUS_TTL_SECONDS &&
      lifetime <= MAX_ORDER_STATUS_TTL_SECONDS &&
      payload.iat <= now + MAX_FUTURE_SKEW_SECONDS &&
      payload.exp > now
    );
  } catch {
    return false;
  }
}
