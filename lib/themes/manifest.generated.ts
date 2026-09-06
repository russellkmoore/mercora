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
    name: "atelier",
    label: "Atelier",
    meta: { industry: "furniture, ceramics, home goods, handmade & small-batch", synopsis: "Warm linen surfaces, a clay accent, a sage secondary, and soft serif headlines — feels like a maker's studio page." },
    tokens: {
      primary: "#a65f46",
      onPrimary: "#fdfaf4",
      surface: "#f5f1e9",
      surfaceElevated: "#fdfaf4",
      foreground: "#261d16",
      mutedForeground: "#6e6055",
      border: "#e8e0d3",
      ring: "#a65f46",
      success: "#49814c",
      warning: "#b7752b",
      danger: "#a83634",
      info: "#6d8967",
      surfaceInverse: "#0f0703",
      surfaceInverseElevated: "#1b110a",
      onInverse: "#f5f1e9",
      mutedOnInverse: "#90847a",
      borderInverse: "#2b221a",
      radiusSm: "0.25rem",
      radiusMd: "0.375rem",
      radiusLg: "0.5rem",
      radiusXl: "0.75rem",
      fontSans: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontDisplay: "var(--font-fraunces), 'Fraunces', Georgia, 'Times New Roman', serif",
    },
  },
  {
    name: "clinical",
    label: "Clinical",
    meta: { industry: "skincare, wellness, supplements, pharmacy, dental", synopsis: "Trustworthy and regulated — pure white surfaces, cool graphite text, one sea-teal accent, and a lot of air. Reads like a well-designed pharmacy label." },
    tokens: {
      primary: "#00828a",
      onPrimary: "#ffffff",
      surface: "#ffffff",
      surfaceElevated: "#f3f8f9",
      foreground: "#202a32",
      mutedForeground: "#67737c",
      border: "#d7e0e3",
      ring: "#00828a",
      success: "#06915f",
      warning: "#ce871b",
      danger: "#be222a",
      info: "#0e84b7",
      surfaceInverse: "#030a11",
      surfaceInverseElevated: "#0a151d",
      onInverse: "#ffffff",
      mutedOnInverse: "#7c8891",
      borderInverse: "#1b252d",
      radiusSm: "0.25rem",
      radiusMd: "0.375rem",
      radiusLg: "0.5rem",
      radiusXl: "0.75rem",
      fontSans: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontDisplay: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
  },
  {
    name: "luxe",
    label: "Luxe",
    meta: { industry: "fashion, jewelry, watches, fragrance", synopsis: "A small luxury house that wants the site to feel like a printed lookbook — ivory paper, a single champagne-gold accent, serif headlines." },
    tokens: {
      primary: "#c49f4d",
      onPrimary: "#15110d",
      surface: "#f8f5ef",
      surfaceElevated: "#fdfbf9",
      foreground: "#15110d",
      mutedForeground: "#645c55",
      border: "#ece7df",
      ring: "#8b6100",
      success: "#397949",
      warning: "#b76b1c",
      danger: "#a5292b",
      info: "#42789c",
      surfaceInverse: "#0e0804",
      surfaceInverseElevated: "#1a120c",
      onInverse: "#f8f5ef",
      mutedOnInverse: "#90847a",
      borderInverse: "#2b221a",
      radiusSm: "0rem",
      radiusMd: "0rem",
      radiusLg: "0rem",
      radiusXl: "0rem",
      fontSans: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontDisplay: "var(--font-cormorant-garamond), 'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    },
  },
  {
    name: "market",
    label: "Market",
    meta: { industry: "grocery, specialty food, coffee, farm boxes", synopsis: "Bright, dense and friendly — off-white surfaces, forest-green text, a produce-green accent, and big radius rounded sans. Feels like a good neighborhood grocer's app." },
    tokens: {
      primary: "#008819",
      onPrimary: "#ffffff",
      surface: "#faf9f1",
      surfaceElevated: "#ffffff",
      foreground: "#172614",
      mutedForeground: "#576953",
      border: "#ecedd7",
      ring: "#008819",
      success: "#189a30",
      warning: "#e19100",
      danger: "#c92f33",
      info: "#008ec8",
      surfaceInverse: "#040c02",
      surfaceInverseElevated: "#0c170a",
      onInverse: "#faf9f1",
      mutedOnInverse: "#7e8a7c",
      borderInverse: "#1e271c",
      radiusSm: "0.375rem",
      radiusMd: "0.5rem",
      radiusLg: "0.75rem",
      radiusXl: "1rem",
      fontSans: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontDisplay: "var(--font-nunito), 'Nunito', system-ui, sans-serif",
    },
  },
  {
    name: "midnight",
    label: "Midnight",
    meta: { industry: "consumer electronics, audio, gaming peripherals", synopsis: "For shoppers who compare specs before they buy — indigo-black surfaces, a violet accent, a polished, cinematic feel." },
    tokens: {
      primary: "#b180fc",
      onPrimary: "#0c111f",
      surface: "#0c111f",
      surfaceElevated: "#191e30",
      foreground: "#f2f5fc",
      mutedForeground: "#9198ab",
      border: "#282d3d",
      ring: "#b180fc",
      success: "#4ed589",
      warning: "#fdc010",
      danger: "#f05653",
      info: "#00c9d3",
      surfaceInverse: "#f7f7fb",
      surfaceInverseElevated: "#e9e9f2",
      onInverse: "#0c111f",
      mutedOnInverse: "#6b7280",
      borderInverse: "#374151",
      radiusSm: "0.375rem",
      radiusMd: "0.5rem",
      radiusLg: "0.75rem",
      radiusXl: "1rem",
      fontSans: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontDisplay: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
  },
  {
    name: "retro",
    label: "Retro",
    meta: { industry: "vintage clothing, record stores, arcade & collectibles, nostalgia brands", synopsis: "Deep purple, magenta and cyan with cream text — loud on purpose but legible; the joke is in the decoration, not the contrast." },
    tokens: {
      primary: "#ff83e6",
      onPrimary: "#11071f",
      surface: "#1f1332",
      surfaceElevated: "#2e1f46",
      foreground: "#f7f2e3",
      mutedForeground: "#b1a9c4",
      border: "#463c59",
      ring: "#ff83e6",
      success: "#00ebec",
      warning: "#fdd506",
      danger: "#f94144",
      info: "#49a9ff",
      surfaceInverse: "#f9f5ea",
      surfaceInverseElevated: "#ece8dd",
      onInverse: "#1f1332",
      mutedOnInverse: "#6b7280",
      borderInverse: "#374151",
      radiusSm: "0.125rem",
      radiusMd: "0.25rem",
      radiusLg: "0.375rem",
      radiusXl: "0.5rem",
      fontSans: "var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontDisplay: "var(--font-orbitron), 'Orbitron', system-ui, sans-serif",
    },
  },
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
