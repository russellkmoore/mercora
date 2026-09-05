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

/**
 * Resolves the active theme's token set for an outbound email. Never
 * rejects: `getActiveTheme()` already degrades a failed appearance read to
 * the manifest default, so this function inherits that same never-throws
 * contract with no extra try/catch of its own.
 */
export async function resolveEmailTheme(): Promise<ThemeTokens> {
  return getThemeTokens(await getActiveTheme());
}
