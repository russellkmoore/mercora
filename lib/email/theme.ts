/**
 * === Send-Time Email Theme Resolution (D-01) ===
 *
 * A transactional email's theme is resolved exactly once, at send time, in
 * the server context that is already sending the email — the same webhook
 * handler, admin route, or subscription-repository call that already has D1
 * access. It is never resolved inside a pure HTML generator (those take
 * `tokens` as a parameter) and never from a context that has no request
 * scope.
 *
 * The one exception: `sendOrderConfirmationEmail` and
 * `sendNewOrderMerchantNotification` can also be invoked from the cron
 * recovery drain (`drainOrderEffects`), which runs in a `scheduled()` handler
 * with no Cloudflare request context — `getActiveTheme()` cannot be called
 * from there (see `08.1-RESEARCH.md` Pitfall 1). Do NOT "fix" this by
 * threading a resolver call into the drain path. Plan 04 resolves the theme
 * once when the effect is staged (inside the original request) and passes it
 * back through a caller-supplied `tokens` override on those two senders'
 * `options`, so this exception is a deliberate, load-bearing seam — not a gap
 * to close here.
 */

import { getActiveTheme } from "@/lib/themes/active-theme";
import { getThemeTokens, type ThemeTokens } from "@/lib/themes/tokens";
import { THEME_MANIFEST } from "@/lib/themes/manifest.generated";
import { recordTelemetry } from "@/lib/observability/telemetry";

/**
 * Resolves the active theme's token set for an outbound email. Never
 * rejects: `getActiveTheme()` already degrades a failed appearance read to
 * the manifest default, so this function inherits that same never-throws
 * contract with no extra try/catch of its own.
 */
export async function resolveEmailTheme(): Promise<ThemeTokens> {
  return getThemeTokens(await getActiveTheme());
}

/**
 * The trust boundary between a stored `order_effects.payload` string and a
 * rendered inline style (T-08.1-15). Plan 04's staging step writes
 * `{ themeName }` into the payload of a confirmation/merchant-notification
 * effect row inside the request that stages it (D-10); the drain — which may
 * run from the scheduled recovery sweep with no request context — passes the
 * raw payload here instead of resolving the theme itself. Only a string
 * `themeName` that is present in `THEME_MANIFEST` is trusted; every other
 * shape (absent payload, unparseable JSON, non-object JSON, a non-string or
 * missing `themeName` field) falls back to the manifest default silently,
 * since a row staged before this migration has no payload at all and that is
 * the normal, expected case — not an anomaly.
 *
 * The one genuinely anomalous case — a present, non-empty theme name that is
 * not a manifest key — emits the existing `theme.unknown_selection` event
 * with `{ outcome: "invalid" }` and nothing else, matching the identical rule
 * already enforced in `lib/themes/active-theme.ts`: never put the stored
 * string into an event field.
 */
export function emailThemeForStagedPayload(
  payload: string | null | undefined,
): ThemeTokens {
  if (!payload) return getThemeTokens();

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return getThemeTokens();
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return getThemeTokens();
  }

  const themeName = (parsed as Record<string, unknown>).themeName;
  if (typeof themeName !== "string" || themeName === "") {
    return getThemeTokens();
  }

  const known = THEME_MANIFEST.some((theme) => theme.name === themeName);
  if (!known) {
    recordTelemetry("theme.unknown_selection", { outcome: "invalid" });
    return getThemeTokens();
  }

  return getThemeTokens(themeName);
}
