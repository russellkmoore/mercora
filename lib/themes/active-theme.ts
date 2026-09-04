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
 * and no cross-request memoisation helper anywhere in this file.
 * `getSettings()`'s own request-scoped read caching (inside the shared
 * database helper) is the only caching anywhere in this path — a
 * Cloudflare Workers isolate can be reused across requests, so any
 * additional caching here would risk serving a stale theme after an admin
 * save (RESEARCH Pitfall 2).
 */

import { getSettings } from "@/lib/utils/settings";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";

export const APPEARANCE_SETTINGS_CATEGORY = "appearance";
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

  let stored: unknown;
  try {
    const settings = await getSettings(APPEARANCE_SETTINGS_CATEGORY);
    stored = settings[APPEARANCE_THEME_SETTING_KEY];
  } catch {
    // This function runs in the root layout on every request; a database
    // hiccup must degrade to the default theme, not take down every route.
    return resolveEnvOrManifestDefault(manifestNames);
  }

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
    // Present but doesn't match any manifest theme name: genuinely unknown
    // (RESEARCH Pitfall 6, case b). Emit exactly one telemetry signal. Do
    // not pass the stored string in any field — the sanitiser would drop it
    // anyway, and reflecting an untrusted value into a log line is the
    // disclosure this plan's threat register (T-06-06) closes.
    recordTelemetry("theme.unknown_selection", { outcome: "invalid" });
    return resolveEnvOrManifestDefault(manifestNames);
  }

  // A present non-string value (number, object, boolean, ...) is also
  // genuinely unknown.
  recordTelemetry("theme.unknown_selection", { outcome: "invalid" });
  return resolveEnvOrManifestDefault(manifestNames);
}
