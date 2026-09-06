/**
 * === Shared Appearance Settings Read (D-04) ===
 *
 * Single request-scoped read of the `appearance` settings category, shared
 * by `getActiveTheme()` (`lib/themes/active-theme.ts`) and
 * `getLayoutSettings()` (`lib/layout/settings.ts`) — both resolvers read
 * the same D1 category on every request, so this collapses that into one
 * read per request instead of two.
 *
 * Wrapped in React's `cache()` — the same request-scoped memoisation
 * primitive `lib/db.ts` already uses for its connection helpers
 * (`getDb`/`getDbAsync`). `cache()` only de-duplicates calls made during a
 * single React render/request dispatch; it holds no state between
 * requests and therefore cannot serve a stale theme to a later request on
 * a reused Cloudflare Workers isolate (RESEARCH Pitfall 4 — verified with
 * a live `node` probe of this project's installed `react` package: calling
 * a `cache()`-wrapped function twice outside an active render executes it
 * twice, with zero memoisation). This module deliberately holds no
 * top-level mutable binding, no reference to the global object, and no
 * cross-request cache helper (Next's own cross-request cache primitive,
 * for instance) anywhere — the
 * *only* memoisation in this file is React's own per-render
 * de-duplication, which is why the grep guards in
 * `tests/unit/app/layout-switch-contract.test.ts` name this file as a
 * deliberate, explained exception rather than treating it as a hole.
 *
 * Because `cache()` is a pure passthrough outside an active render, unit
 * tests that mock `@/lib/utils/settings` and assert an exact call count
 * (e.g. `tests/unit/lib/themes/active-theme.test.ts`) are unaffected by
 * this wrapper — each call in a test still reaches the mock.
 *
 * Server-only. A read failure returns `{}` (never throws) so callers keep
 * their own "never throws" contract without needing their own try/catch
 * around this read.
 */

import { cache } from "react";
import { getSettings } from "@/lib/utils/settings";

export const APPEARANCE_SETTINGS_CATEGORY = "appearance";

export const readAppearanceSettings = cache(
  async (): Promise<Record<string, unknown>> => {
    try {
      return await getSettings(APPEARANCE_SETTINGS_CATEGORY);
    } catch {
      // A DB hiccup degrades every caller to its own defaults, not a
      // broken route — this is the one place that decision is made.
      return {};
    }
  },
);
