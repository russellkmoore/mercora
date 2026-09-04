/**
 * Typed, non-CSS-cascade bridge for the four consumers that cannot read a
 * `[data-theme]` CSS custom property: Stripe Elements' `appearance` config,
 * Clerk's `appearance.variables`, the standalone `app/global-error.tsx`
 * page (which renders without `globals.css`), and the transactional email
 * builders (mail clients cannot read CSS variables).
 *
 * This is a plain object literal, not a CSS-file reader. Workers cannot
 * reliably read the filesystem at request time under the OpenNext build,
 * and D-09 rejected that approach explicitly. `getThemeTokens()` reads the
 * generated manifest (`lib/themes/manifest.generated.ts`), which is itself
 * parsed from `themes/*.css` at build time by `scripts/build-themes.mjs` —
 * so the CSS file remains the single source of truth and the two can never
 * silently drift.
 *
 * Do not read the environment here and do not import anything server-only —
 * Stripe's provider is a client component and will import this module into
 * the browser bundle.
 *
 * getThemeTokens(name?) is a synchronous manifest lookup, defaulting to
 * DEFAULT_THEME_NAME when no name is given or the name is not a manifest
 * key. Callers never change again (D-11); this is the last body swap this
 * function needs.
 */

import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";

export type ThemeTokens = {
  primary: string;
  onPrimary: string;
  surface: string;
  surfaceElevated: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  ring: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  surfaceInverse: string;
  surfaceInverseElevated: string;
  onInverse: string;
  mutedOnInverse: string;
  borderInverse: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  fontSans: string;
  fontDisplay: string;
};

/**
 * Returns the named theme's typed token values, falling back to
 * DEFAULT_THEME_NAME when `name` is absent or not a manifest key.
 */
export function getThemeTokens(name: string = DEFAULT_THEME_NAME): ThemeTokens {
  const entry =
    THEME_MANIFEST.find((theme) => theme.name === name) ??
    THEME_MANIFEST.find((theme) => theme.name === DEFAULT_THEME_NAME) ??
    THEME_MANIFEST[0];
  return entry.tokens as ThemeTokens;
}
