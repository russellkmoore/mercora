/**
 * Best-effort rate limiting for public and AI-backed API routes.
 *
 * Cloudflare's native rate-limit bindings are unavailable during some local
 * development and test runs. These helpers therefore fail open, while logging
 * every unavailable/error path so a deployment mistake remains observable.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type RateLimiterBinding = "AI_RATE_LIMITER" | "PUBLIC_RATE_LIMITER";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const MAX_IP_KEY_LENGTH = 128;
const MAX_FORWARDED_HEADER_LENGTH = 1024;
const MAX_RATE_LIMIT_KEY_LENGTH = 256;

function sanitizeKeyPart(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Return a bounded, sanitized client identifier suitable for a rate-limit key.
 * Cloudflare's edge header is authoritative when present; the first forwarded
 * address is a development/proxy fallback only.
 */
export function getClientIp(req: NextRequest): string {
  const cloudflareIp = req.headers.get("CF-Connecting-IP");
  if (cloudflareIp) {
    const sanitized = sanitizeKeyPart(cloudflareIp, MAX_IP_KEY_LENGTH);
    if (sanitized) return sanitized;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.slice(0, MAX_FORWARDED_HEADER_LENGTH).split(",", 1)[0];
    const sanitized = sanitizeKeyPart(first ?? "", MAX_IP_KEY_LENGTH);
    if (sanitized) return sanitized;
  }

  return "unknown";
}

/**
 * Return a 429 response when the named limiter rejects the key, otherwise null.
 * Missing Workers context/bindings and limiter failures intentionally fail open.
 */
export async function enforceRateLimit(
  binding: RateLimiterBinding,
  key: string
): Promise<NextResponse | null> {
  let limiter: RateLimiter | undefined;

  try {
    const { env } = await getCloudflareContext({ async: true });
    limiter = (env as unknown as Record<string, RateLimiter | undefined>)[binding];
  } catch (error) {
    console.warn(
      `[rate-limit] Cloudflare context unavailable for ${binding}; allowing request`,
      error
    );
    return null;
  }

  if (!limiter || typeof limiter.limit !== "function") {
    console.warn(`[rate-limit] binding ${binding} not configured; allowing request`);
    return null;
  }

  try {
    const normalizedKey = sanitizeKeyPart(key, MAX_RATE_LIMIT_KEY_LENGTH) || "unknown";
    const { success } = await limiter.limit({ key: normalizedKey });
    if (success) return null;

    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again in a moment." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  } catch (error) {
    console.error(`[rate-limit] ${binding}.limit() failed; allowing request`, error);
    return null;
  }
}
