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

function strongSecret(value: string | undefined): string | undefined {
  return value && value.length >= MIN_SECRET_LENGTH ? value : undefined;
}

function currentSecret(): string | undefined {
  return strongSecret(process.env.EMAIL_UNSUBSCRIBE_SECRET_CURRENT);
}

function verificationSecrets(): string[] {
  return [currentSecret(), strongSecret(process.env.EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS)]
    .filter((value): value is string => Boolean(value));
}

export function isUnsubscribeConfigured(): boolean { return Boolean(currentSecret()); }

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
  const current = currentSecret();
  if (!current) return null;
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return null;
  const iat = Math.floor(now.getTime() / 1_000);
  const payload: TokenPayload = { v: VERSION, email: normalized, category, iat, exp: iat + ttlSeconds() };
  const body = encode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${encode(await sign(current, body))}`;
}

export async function verifyUnsubscribeToken(token: string, now = new Date()): Promise<TokenPayload | null> {
  try {
    if (!token || token.length > MAX_TOKEN_LENGTH) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Record<string, unknown>;
    if (candidate.v !== VERSION || candidate.category !== "review_reminders" ||
        typeof candidate.email !== "string" || candidate.email.length === 0 || candidate.email.length > 254 ||
        typeof candidate.iat !== "number" || !Number.isSafeInteger(candidate.iat) || candidate.iat < 0 ||
        typeof candidate.exp !== "number" || !Number.isSafeInteger(candidate.exp) || candidate.exp < 0) return null;
    const payload: TokenPayload = {
      v: VERSION,
      email: candidate.email,
      category: candidate.category,
      iat: candidate.iat,
      exp: candidate.exp,
    };
    const currentSeconds = Math.floor(now.getTime() / 1_000);
    if (payload.email !== normalizeEmail(payload.email) ||
        payload.exp <= currentSeconds || payload.iat > currentSeconds + 300 ||
        payload.exp - payload.iat <= 0 || payload.exp - payload.iat > MAX_TTL_SECONDS) return null;
    const signature = decode(parts[1]);
    for (const secret of verificationSecrets()) {
      if (equal(signature, await sign(secret, parts[0]))) return payload;
    }
    return null;
  } catch {
    return null;
  }
}
