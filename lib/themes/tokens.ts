/**
 * Typed, non-CSS-cascade bridge for the four consumers that cannot read a
 * `[data-theme]` CSS custom property: Stripe Elements' `appearance` config,
 * Clerk's `appearance.variables`, the standalone `app/global-error.tsx`
 * page (which renders without `globals.css`), and the transactional email
 * builders (mail clients cannot read CSS variables).
 *
 * This is a plain object literal, not a CSS-file reader. Workers cannot
 * reliably read the filesystem at request time under the OpenNext build,
 * and D-09 rejected that approach explicitly. The values below are a
 * deliberate duplicate of `themes/volt-dark.css`; a contract test
 * (`tests/unit/lib/themes/token-contract.test.ts`) parses the CSS file and
 * asserts parity so the two can never silently drift.
 *
 * Do not read the environment here and do not import anything server-only —
 * Stripe's provider is a client component and will import this module into
 * the browser bundle.
 *
 * Phase 6 replaces only this function's body to read the generated
 * manifest for the active theme; callers never change again (D-09).
 */

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

const VOLT_DARK_TOKENS: ThemeTokens = {
  primary: "#f97316",
  onPrimary: "#000000",
  surface: "#000000",
  surfaceElevated: "#171717",
  foreground: "#ffffff",
  mutedForeground: "#a3a3a3",
  border: "#404040",
  ring: "#404040",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  surfaceInverse: "#fdfdfb",
  surfaceInverseElevated: "#f3f4f6",
  onInverse: "#000000",
  mutedOnInverse: "#6b7280",
  borderInverse: "#374151",
  radiusSm: "0.25rem",
  radiusMd: "0.375rem",
  radiusLg: "0.5rem",
  radiusXl: "0.75rem",
  fontSans:
    "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontDisplay:
    "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/** Returns the active theme's typed token values (currently always volt-dark). */
export function getThemeTokens(): ThemeTokens {
  return VOLT_DARK_TOKENS;
}
