/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Produced by scripts/build-themes.mjs from themes/*.css. Edit the theme
 * files instead, then rerun `npm run build:themes` (or `predev` /
 * `build:worker`, which run it automatically) to regenerate this file.
 *
 * Plain data only — no imports, no environment reads. This module is
 * pulled into the browser bundle through lib/themes/tokens.ts.
 */

export type ThemeTokenValues = {
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

export type ThemeManifestEntry = {
  name: string;
  label: string;
  meta: { industry?: string; synopsis?: string };
  tokens: ThemeTokenValues;
};

export const THEME_MANIFEST: ThemeManifestEntry[] = [
  {
    name: "volt-dark",
    label: "Volt Dark",
    meta: { industry: "outdoor & technical gear", synopsis: "The store's original look — high-contrast black, electric-orange accent, built for gear that gets used hard." },
    tokens: {
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
      fontSans: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontDisplay: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
  },
];

export const DEFAULT_THEME_NAME = "volt-dark";
