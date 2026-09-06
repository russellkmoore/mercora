/**
 * === Theme Response Parsing (D-02, T-08.1-02) ===
 *
 * Parses a `GET /api/theme` response body into `ThemeTokens`. This is what
 * closes T-08.1-02: the crash page (`app/global-error.tsx`) interpolates
 * these values straight into inline `style` attributes, so a response body
 * must never be able to supply the values themselves. `parseThemeResponse`
 * accepts a payload only when it is a non-null object whose `name` is a
 * string present in `THEME_MANIFEST`, and then returns `getThemeTokens(name)`
 * — the token values always come from the caller's own bundled manifest,
 * never from the wire. Anything else (a non-object payload, a missing or
 * non-string `name`, or a name absent from the manifest) returns `null`.
 *
 * D-02's "applies the returned tokens" is therefore resolved through the
 * manifest *identity* (a theme name), not the wire values — the resulting
 * values are identical to what the route would have sent because the route
 * builds its own body from that same manifest.
 */

import { getThemeTokens, type ThemeTokens } from "@/lib/themes/tokens";
import { THEME_MANIFEST } from "@/lib/themes/manifest.generated";

const MANIFEST_THEME_NAMES = new Set(THEME_MANIFEST.map((theme) => theme.name));

export function parseThemeResponse(payload: unknown): ThemeTokens | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const name = (payload as Record<string, unknown>).name;
  if (typeof name !== "string" || !MANIFEST_THEME_NAMES.has(name)) {
    return null;
  }

  return getThemeTokens(name);
}
