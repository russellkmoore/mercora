import type { EmailCategory } from "./policy";

const VERSION = 1;
const MIN_SECRET_LENGTH = 32;
const MAX_TOKEN_LENGTH = 1_024;
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_TTL_SECONDS = 90 * 24 * 60 * 60;

type TokenPayload = { v: 1; email: string; category: EmailCategory; iat: number; exp: number };

function encode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function secrets(): string[] {
  const current = process.env.EMAIL_UNSUBSCRIBE_SECRET_CURRENT ?? process.env.EMAIL_UNSUBSCRIBE_SECRET;
  const previous = process.env.EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS;
  return [current, previous].filter((value): value is string => Boolean(value && value.length >= MIN_SECRET_LENGTH));
}

export function isUnsubscribeConfigured(): boolean { return secrets().length > 0; }

function ttlSeconds(): number {
  const configured = Number(process.env.EMAIL_UNSUBSCRIBE_TTL_SECONDS);
  return Number.isSafeInteger(configured) && configured > 0
    ? Math.min(configured, MAX_TTL_SECONDS)
    : DEFAULT_TTL_SECONDS;
}

async function sign(secret: string, body: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

export async function createUnsubscribeToken(
  email: string,
  category: EmailCategory = "review_reminders",
  now = new Date(),
): Promise<string | null> {
  const [current] = secrets();
  if (!current) return null;
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return null;
  const iat = Math.floor(now.getTime() / 1_000);
  const payload: TokenPayload = { v: VERSION, email: normalized, category, iat, exp: iat + ttlSeconds() };
  const body = encode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${encode(await sign(current, body))}`;
}

export async function verifyUnsubscribeToken(token: string, now = new Date()): Promise<TokenPayload | null> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload: TokenPayload;
  let signature: Uint8Array;
  try {
    payload = JSON.parse(new TextDecoder().decode(decode(parts[0]))) as TokenPayload;
    signature = decode(parts[1]);
  } catch { return null; }
  const currentSeconds = Math.floor(now.getTime() / 1_000);
  if (payload.v !== VERSION || payload.category !== "review_reminders" ||
      payload.email !== normalizeEmail(payload.email) || payload.email.length > 254 ||
      !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) ||
      payload.exp <= currentSeconds || payload.iat > currentSeconds + 300 ||
      payload.exp - payload.iat <= 0 || payload.exp - payload.iat > MAX_TTL_SECONDS) return null;
  for (const secret of secrets()) {
    if (equal(signature, await sign(secret, parts[0]))) return payload;
  }
  return null;
}
