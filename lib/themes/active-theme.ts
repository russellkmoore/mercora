/**
 * === Active Theme Resolution ===
 *
 * Resolves the storefront's active theme for the current request in three
 * tiers: the admin's stored D1 selection (`appearance.theme`), then the
 * deploy-time environment default (`NEXT_PUBLIC_THEME_DEFAULT`), then the
 * manifest default (`DEFAULT_THEME_NAME`). Always returns a manifest key —
 * the returned name is never a raw, untrusted string.
 *
 * Server-only. Never import this from a client component — it reads
 * `process.env` and the D1-backed settings helper.
 *
 * === Caching ===
 * Deliberately holds no state between requests: no module-scope variable
 * and no cross-request memoisation helper anywhere in this file. The read
 * itself goes through `readAppearanceSettings()`
 * (`lib/themes/appearance-read.ts`), the one request-scoped mechanism in
 * this path (D-04) — shared with `getLayoutSettings()` so the two
 * resolvers issue one D1 read per request between them, not two. That
 * helper's own `React.cache()` wrapper is per-render, not per-isolate, so
 * a Cloudflare Workers isolate reused across requests can never be served
 * a stale theme (RESEARCH Pitfall 4).
 */

import { recordTelemetry } from "@/lib/observability/telemetry";
import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";
import {
  APPEARANCE_SETTINGS_CATEGORY,
  readAppearanceSettings,
} from "@/lib/themes/appearance-read";

export { APPEARANCE_SETTINGS_CATEGORY };
export const APPEARANCE_THEME_SETTING_KEY = "appearance.theme";

/**
 * Resolves the environment default if it is itself a manifest key, else the
 * manifest default. A misconfigured `NEXT_PUBLIC_THEME_DEFAULT` is treated
 * as an operator error surfaced at deploy time, not a per-request anomaly —
 * no telemetry for this case (flagged planner decision, D-12 covers only an
 * unknown *stored* theme name, not a misconfigured env default).
 */
function resolveEnvOrManifestDefault(manifestNames: ReadonlySet<string>): string {
  const envDefault = process.env.NEXT_PUBLIC_THEME_DEFAULT;
  return envDefault && manifestNames.has(envDefault) ? envDefault : DEFAULT_THEME_NAME;
}

/**
 * Resolves the active theme name for the current request. Always returns a
 * manifest key; never throws.
 */
export async function getActiveTheme(): Promise<string> {
  const manifestNames = new Set(THEME_MANIFEST.map((theme) => theme.name));

  // readAppearanceSettings() already degrades a database hiccup to `{}`;
  // this function runs in the root layout on every request, so an absent
  // key here falls through the same default chain as a genuine D1 error.
  const settings = await readAppearanceSettings();
  const stored: unknown = settings[APPEARANCE_THEME_SETTING_KEY];

  // Absent, or explicitly null: the normal first-load state (no admin
  // selection has ever been saved), not an anomaly. No telemetry
  // (RESEARCH Pitfall 6, case a).
  if (stored === undefined || stored === null) {
    return resolveEnvOrManifestDefault(manifestNames);
  }

  if (typeof stored === "string") {
    const trimmed = stored.trim();
    if (trimmed === "") {
      // Empty / whitespace-only: same as absent. No telemetry.
      return resolveEnvOrManifestDefault(manifestNames);
    }
    if (manifestNames.has(trimmed)) {
      return trimmed;
    }
  }

  // Reaching here means `stored` is either a non-empty string absent from
  // the manifest, or a present non-string value (number, object, boolean,
  // ...) — both outcomes are genuinely unknown (RESEARCH Pitfall 6, case
  // b), so they funnel through one telemetry signal and one fallback
  // return rather than two duplicated pairs. Do not pass the stored string
  // in any field — the sanitiser would drop it anyway, and reflecting an
  // untrusted value into a log line is the disclosure this plan's threat
  // register (T-06-06) closes.
  recordTelemetry("theme.unknown_selection", { outcome: "invalid" });
  return resolveEnvOrManifestDefault(manifestNames);
}
