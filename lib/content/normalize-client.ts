/**
 * === Client-Safe Content Settings Normalizers ===
 *
 * Pure, side-effect-free mirrors of `lib/content/settings.ts`'s resolver
 * clamps (`resolveContentText`/`Flag`/`Count`/`Enum`), minus the telemetry
 * signal those resolvers emit — `recordTelemetry` calls `getCloudflareContext()`
 * and is server-only, so it cannot run from a `"use client"` module.
 *
 * Used by `app/admin/settings/page.tsx` to clamp/enum-validate a loaded
 * `content.*` value on read, so the admin form can never display a
 * number/placement the storefront's `getContentSettings()` wouldn't
 * actually use (WR-01). Extracted to this shared module (rather than kept
 * as page-local functions) so a plain unit test can import and call them
 * directly, and assert parity against `getContentSettings()` for the same
 * input (WR-03) — a future edit that silently diverges the two now fails a
 * test, not just a source-contract regex.
 *
 * `BLOG_HOME_BLOCK_COUNT_MIN/MAX` and `BLOG_HOME_BLOCK_PLACEMENTS` are
 * imported from `lib/content/settings.ts` rather than retyped, the same
 * bounds/enum `getContentSettings()`'s own resolvers use — the two can
 * never drift apart on what "in range"/"a known placement" means.
 *
 * No React import, no `"use client"` directive, no D1/Cloudflare access —
 * safe to import from both the client settings page and a Node test file.
 */

import {
  BLOG_HOME_BLOCK_COUNT_MAX,
  BLOG_HOME_BLOCK_COUNT_MIN,
  BLOG_HOME_BLOCK_PLACEMENTS,
  type BlogHomeBlockPlacement,
} from "@/lib/content/settings";

/**
 * Resolves a stored text value the same way `resolveContentText` does,
 * minus the telemetry signal: non-string, empty-after-trim, or
 * over-`maxLength`-after-trim all fall back; a valid value is returned
 * trimmed (never truncated).
 */
export function normalizeContentText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > maxLength) return fallback;
  return trimmed;
}

/**
 * Resolves a stored boolean flag the same way `resolveContentFlag` does,
 * minus the telemetry signal: a real boolean is returned as-is, anything
 * else falls back.
 */
export function normalizeContentFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Resolves the home-block article count the same way `resolveContentCount`
 * does, minus the telemetry signal: a finite number is clamped
 * unconditionally into `[BLOG_HOME_BLOCK_COUNT_MIN, BLOG_HOME_BLOCK_COUNT_MAX]`
 * and truncated to an integer; anything else falls back.
 */
export function normalizeContentCount(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(
    BLOG_HOME_BLOCK_COUNT_MIN,
    Math.min(BLOG_HOME_BLOCK_COUNT_MAX, Math.trunc(value)),
  );
}

/**
 * Resolves a stored placement the same way `resolveContentEnum` does,
 * minus the telemetry signal: membership is tested against
 * `BLOG_HOME_BLOCK_PLACEMENTS` (never by indexing an object with the
 * stored string), a non-string or non-member value falls back.
 */
export function normalizeContentPlacement(
  value: unknown,
  fallback: BlogHomeBlockPlacement,
): BlogHomeBlockPlacement {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return (BLOG_HOME_BLOCK_PLACEMENTS as readonly string[]).includes(trimmed)
    ? (trimmed as BlogHomeBlockPlacement)
    : fallback;
}
