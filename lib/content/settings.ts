/**
 * === Content Settings Resolution ===
 *
 * Resolves the five `content.*` admin settings (blog nav label, home-page
 * "latest articles" block enabled/heading/count/placement) for the current
 * request. Each stored value is validated against its own type/enum/bound;
 * an absent, empty, malformed, or out-of-range value falls back to that
 * key's documented default. Always returns five fully-typed values —
 * never throws.
 *
 * Server-only. Never import this from a client component — it reads the
 * D1-backed settings helper.
 *
 * === No auto-seeding (D-17) ===
 * `getSettings()` does NOT seed `defaultSettings` on read — only the admin
 * settings API's own GET handler does that seeding. A server component
 * reading `content.*` directly (outside that API route) sees an empty
 * record on a fresh database, so every key here carries its own in-code
 * fallback, mirroring `lib/layout/settings.ts` `getLayoutSettings()`'s
 * pattern for `appearance.*`.
 *
 * === Caching ===
 * Deliberately holds no state between requests: no module-scope mutable
 * binding, no cross-request memoisation helper, no framework-level or
 * request-scoped memoisation wrapper anywhere in this file. Two
 * independent reads of the `content` category (e.g. one from
 * `Header.tsx`, one from `app/page.tsx`) on the same request is the
 * accepted, precedented pattern — see `lib/layout/settings.ts` and
 * 16-RESEARCH.md.
 */

import { recordTelemetry } from "@/lib/observability/telemetry";
import { getSettings } from "@/lib/utils/settings";

export const CONTENT_SETTING_KEYS = {
  blogNavLabel: "content.blog_nav_label",
  blogHomeBlockEnabled: "content.blog_home_block_enabled",
  blogHomeBlockHeading: "content.blog_home_block_heading",
  blogHomeBlockCount: "content.blog_home_block_count",
  blogHomeBlockPlacement: "content.blog_home_block_placement",
} as const;

export const BLOG_HOME_BLOCK_PLACEMENTS = ["before_featured", "after_featured"] as const;
export type BlogHomeBlockPlacement = (typeof BLOG_HOME_BLOCK_PLACEMENTS)[number];

export const CONTENT_SETTING_DEFAULTS = {
  blogNavLabel: "Blog",
  blogHomeBlockEnabled: true,
  blogHomeBlockHeading: "From the Blog",
  blogHomeBlockCount: 3,
  blogHomeBlockPlacement: "after_featured",
} as const satisfies {
  blogNavLabel: string;
  blogHomeBlockEnabled: boolean;
  blogHomeBlockHeading: string;
  blogHomeBlockCount: number;
  blogHomeBlockPlacement: BlogHomeBlockPlacement;
};

export const BLOG_NAV_LABEL_MAX_LENGTH = 60;
export const BLOG_HOME_BLOCK_HEADING_MAX_LENGTH = 120;
export const BLOG_HOME_BLOCK_COUNT_MIN = 1;
export const BLOG_HOME_BLOCK_COUNT_MAX = 6;

export interface ContentSettings {
  blogNavLabel: string;
  blogHomeBlockEnabled: boolean;
  blogHomeBlockHeading: string;
  blogHomeBlockCount: number;
  blogHomeBlockPlacement: BlogHomeBlockPlacement;
}

const CONTENT_CATEGORY = "content";

/**
 * Resolves a stored text value. Absent/null falls back silently (a normal
 * first-run state, not an anomaly). A present non-string, or a string that
 * trims empty, or a string longer than `maxLength` after trimming, records
 * exactly one `content.unknown_selection` signal (`{ outcome: "invalid" }`
 * — never the stored value, T-16-05) and falls back. A structurally valid
 * value is returned trimmed. Over-length values fall back rather than
 * being truncated — a silently cut label is worse than the default.
 */
function resolveContentText(stored: unknown, fallback: string, maxLength: number): string {
  if (stored === undefined || stored === null) {
    return fallback;
  }

  if (typeof stored !== "string") {
    recordTelemetry("content.unknown_selection", { outcome: "invalid" });
    return fallback;
  }

  const trimmed = stored.trim();
  if (trimmed === "") {
    return fallback;
  }

  if (trimmed.length > maxLength) {
    recordTelemetry("content.unknown_selection", { outcome: "invalid" });
    return fallback;
  }

  return trimmed;
}

/**
 * Resolves a stored boolean flag. Absent/null falls back silently; a real
 * boolean is returned as-is; anything else present records exactly one
 * `content.unknown_selection` signal and falls back.
 */
function resolveContentFlag(stored: unknown, fallback: boolean): boolean {
  if (stored === undefined || stored === null) {
    return fallback;
  }

  if (typeof stored === "boolean") {
    return stored;
  }

  recordTelemetry("content.unknown_selection", { outcome: "invalid" });
  return fallback;
}

/**
 * Resolves a stored enum value against its own allowed member list (never
 * by indexing an object with the stored string — a value naming an
 * object-prototype member must fall back, not resolve through the
 * prototype chain; T-16-03, mirroring `resolveLayoutEnum`'s T-07-01
 * precedent). Mirrors `resolveLayoutEnum`'s exact fallback chain.
 */
function resolveContentEnum<T extends string>(
  stored: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (stored === undefined || stored === null) {
    return fallback;
  }

  if (typeof stored !== "string") {
    recordTelemetry("content.unknown_selection", { outcome: "invalid" });
    return fallback;
  }

  const trimmed = stored.trim();
  if (trimmed === "") {
    return fallback;
  }

  if ((allowed as readonly string[]).includes(trimmed)) {
    return trimmed as T;
  }

  recordTelemetry("content.unknown_selection", { outcome: "invalid" });
  return fallback;
}

/**
 * Resolves the home-block article count. Absent/null falls back silently;
 * a finite number is clamped unconditionally into
 * [`BLOG_HOME_BLOCK_COUNT_MIN`, `BLOG_HOME_BLOCK_COUNT_MAX`] and truncated
 * to an integer — the clamp does not trust that the admin UI enforced its
 * own bounds (D-04, T-16-01). Anything else present records exactly one
 * `content.unknown_selection` signal and falls back.
 */
function resolveContentCount(stored: unknown, fallback: number): number {
  if (stored === undefined || stored === null) {
    return fallback;
  }

  if (typeof stored === "number" && Number.isFinite(stored)) {
    return Math.max(
      BLOG_HOME_BLOCK_COUNT_MIN,
      Math.min(BLOG_HOME_BLOCK_COUNT_MAX, Math.trunc(stored)),
    );
  }

  recordTelemetry("content.unknown_selection", { outcome: "invalid" });
  return fallback;
}

/**
 * Reads the raw `content` category. A database hiccup degrades to an
 * empty record, rather than a 500 on every storefront page (D-17) — every
 * resolver below then falls back to its own documented default.
 */
async function readContentSettings(): Promise<Record<string, unknown>> {
  try {
    return await getSettings(CONTENT_CATEGORY);
  } catch {
    return {};
  }
}

/**
 * Resolves the five `content.*` settings for the current request. Always
 * returns five fully-typed, fully-defaulted values; never throws.
 */
export async function getContentSettings(): Promise<ContentSettings> {
  const stored = await readContentSettings();

  return {
    blogNavLabel: resolveContentText(
      stored[CONTENT_SETTING_KEYS.blogNavLabel],
      CONTENT_SETTING_DEFAULTS.blogNavLabel,
      BLOG_NAV_LABEL_MAX_LENGTH,
    ),
    blogHomeBlockEnabled: resolveContentFlag(
      stored[CONTENT_SETTING_KEYS.blogHomeBlockEnabled],
      CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled,
    ),
    blogHomeBlockHeading: resolveContentText(
      stored[CONTENT_SETTING_KEYS.blogHomeBlockHeading],
      CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading,
      BLOG_HOME_BLOCK_HEADING_MAX_LENGTH,
    ),
    blogHomeBlockCount: resolveContentCount(
      stored[CONTENT_SETTING_KEYS.blogHomeBlockCount],
      CONTENT_SETTING_DEFAULTS.blogHomeBlockCount,
    ),
    blogHomeBlockPlacement: resolveContentEnum(
      stored[CONTENT_SETTING_KEYS.blogHomeBlockPlacement],
      BLOG_HOME_BLOCK_PLACEMENTS,
      CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement,
    ),
  };
}
