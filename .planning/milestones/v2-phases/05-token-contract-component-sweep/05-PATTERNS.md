# Phase 5: Token Contract & Component Sweep - Pattern Map

**Mapped:** 2026-09-03
**Files analyzed:** 15 (new + modified, non-admin, representative of ~88-file sweep surface)
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tailwind.config.ts` (modify) | config | transform | itself (extend in place) | exact |
| `themes/volt-dark.css` (new) | config | transform | `app/globals.css` `.admin-*` block (CSS custom-property-driven layer) | role-match |
| `app/globals.css` (modify — add `@import` of theme file) | config | transform | itself | exact |
| `app/layout.tsx` (modify) | component (server) | request-response | itself | exact |
| `lib/store-config.ts` (modify — remove `NEXT_PUBLIC_THEME_PRIMARY`) | config | transform | itself | exact |
| `lib/themes/tokens.ts` (new) | utility | transform | `lib/store-config.ts` (`getStoreConfig()` typed-getter convention) | role-match |
| `scripts/scan-hardcoded-colors.mjs` (new) | utility | batch | `scripts/check-deploy-config.mjs` | exact |
| `scripts/screenshot-routes.mjs` (new) | utility | file-I/O | `scripts/build-with-public-env.mjs` (CLI arg parsing + exit-code convention); no Playwright/browser analog exists | role-match |
| `tests/unit/lib/themes/token-contract.test.ts` (new) | test | transform | any `tests/unit/**/*.test.ts` (Vitest, `vitest.config.mts`) | exact |
| `components/cart/CartDrawer.tsx` (modify) | component (client-adjacent) | request-response | `components/agent/AgentDrawer.tsx` (sibling inverse-panel drawer) | exact |
| `components/agent/AgentDrawer.tsx` (modify) | component | request-response | `components/cart/CartDrawer.tsx` | exact |
| `components/ui/button.tsx` (modify) | component | request-response | other `components/ui/*` cva-based primitives (`badge.tsx`, `dialog.tsx`) | exact |
| `components/checkout/StripeProvider.tsx` (modify) | provider | request-response | none in-tree (only non-CSS-cascade theming bridge); pattern borrowed from `lib/store-config.ts` getter + this file's own `elementsOptions` shape | partial |
| `app/global-error.tsx` (modify) | component | request-response | none in-tree (only standalone inline-style page); self-analog | partial |
| `lib/utils/email.ts` + `lib/fulfillment/shipping-email.ts` / `lib/payments/refund-email.ts` / `lib/utils/review-notifications.ts` (modify) | utility | transform | `lib/utils/email.ts` is the analog for the other three (same inline-HTML-string builder shape) | exact |

## Pattern Assignments

### `tailwind.config.ts` (config, transform)

**Analog:** itself — extend the existing `runtimeColor()` helper, do not replace it.

**Current full file** (`tailwind.config.ts:1-32`):
```typescript
import type { Config } from "tailwindcss";

const runtimeColor = (variable: string) =>
  `rgb(from var(${variable}) r g b / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        store: {
          primary: "var(--store-primary)",
          surface: "var(--store-surface)",
          "surface-elevated": "var(--store-surface-elevated)",
          foreground: "var(--store-foreground)",
          "muted-foreground": "var(--store-muted-foreground)",
        },
        primary: runtimeColor("--store-primary"),
        background: runtimeColor("--store-surface"),
        foreground: runtimeColor("--store-foreground"),
        border: "#2a2a2a",
        ring: "#333333",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
```

**What changes:** delete the `store: {...}` group and the `background` alias (D-07); delete `border`/`ring` hex literals (they become CSS-variable-driven); add all 17 color tokens plus `borderRadius` and `fontFamily` extend blocks per RESEARCH.md Pattern 1 (already gives the exact target shape — copy it verbatim, keep `runtimeColor()` unmodified, keep the `content` array and `plugins` array unmodified).

**Note on variable names:** the current file references `--store-primary` etc. D-07 keeps CSS custom properties on the `--store-*` prefix "under the hood" but RESEARCH.md's Pattern 1 example uses bare `--primary`. Confirm the exact variable naming convention (`--store-primary` vs `--primary`) against `themes/volt-dark.css` when writing it — the two files must agree exactly, this is a plan-time decision, not a pattern-mapping one.

---

### `themes/volt-dark.css` (new, config/transform)

**Analog (structural, not palette):** `app/globals.css`'s `.admin-*` block (`app/globals.css:33-60+`) shows how this codebase writes a bracket-scoped, CSS-custom-property-driven visual block inside the existing `@layer` system.

**Imports pattern:** none needed — this file is a pure CSS block, imported by `app/globals.css` via a plain `@import` line placed after line 2's `@config` directive.

**Core pattern — verified default radius values** (from RESEARCH.md, sourced from `node_modules/tailwindcss/theme.css:397-404`, D-04 compliant):
```css
[data-theme="volt-dark"] {
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --font-sans: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-display: var(--font-geist-sans), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

**Current source-of-truth hex values to relocate verbatim** (`lib/store-config.ts:114-121`, D-01 main set + D-05 inverse set target):
```typescript
theme: {
  mode: "dark",
  primary: "#f97316",
  surface: "#000000",
  surfaceElevated: "#171717",
  foreground: "#ffffff",
  mutedForeground: "#a3a3a3",
  logoPath: "/volt.png",
},
```
`surface-inverse` = `#fdfdfb` and `border-inverse`/`muted-on-inverse` derived from `CartDrawer.tsx`'s current classes (see below) — this is the "no-op relocation" (D-18 chunk 1): every value in this file must trace to a currently-rendered pixel, not a new choice.

---

### `app/layout.tsx` (component, request-response)

**Analog:** itself.

**Current body-styling block to delete** (`app/layout.tsx:132-144`):
```tsx
<body
  className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
  style={{
    backgroundColor: config.theme.surface,
    color: config.theme.foreground,
    "--store-primary": config.theme.primary,
    "--store-surface": config.theme.surface,
    "--store-surface-elevated": config.theme.surfaceElevated,
    "--store-foreground": config.theme.foreground,
    "--store-muted-foreground": config.theme.mutedForeground,
  } as React.CSSProperties}
  suppressHydrationWarning
>
```
**Replacement shape:** `<html lang="en" data-theme="volt-dark" suppressHydrationWarning>` (line 126) gains the `data-theme` attribute; `<body>` drops the `style` prop entirely and gains `bg-surface text-foreground` in its `className` string alongside the existing font-variable classes.

**Sonner pattern to rewrite** (`app/layout.tsx:166-173`):
```tsx
<Toaster
  position="top-center"
  toastOptions={{
    className:
      "bg-(--store-primary)/80 text-black font-semibold rounded-md mt-[60px] shadow-lg animate-in fade-in slide-in-from-top-5",
    duration: 3000,
  }}
/>
```
→ `className` becomes `"bg-primary/80 text-on-primary font-semibold rounded-md mt-[60px] shadow-lg animate-in fade-in slide-in-from-top-5"` per D-12 (resolves the `on-primary` white-vs-black discretion call for this call site — Sonner currently uses `text-black`, note this in the manifest as the source data point).

**Clerk pattern to extend** (`app/layout.tsx:121-125`):
```tsx
<ClerkProvider
  appearance={{
    theme: dark,
  }}
>
```
→ add `variables: { colorPrimary: tokens.primary, colorBackground: ..., colorText: ..., ... }` sourced from `getThemeTokens()` per D-12, keeping `theme: dark`.

**Header Suspense fallback** (`app/layout.tsx:153`): `<div className="h-16 bg-neutral-900" />` → `bg-surface-elevated` (role: elevated dark panel, matches `surfaceElevated` `#171717` ≈ `neutral-900` `#171717`).

---

### `lib/store-config.ts` (config, transform)

**Analog:** itself.

**Current theme type** (`lib/store-config.ts:54-62`):
```typescript
theme: {
  mode: "dark" | "light";
  primary: string;
  surface: string;
  surfaceElevated: string;
  foreground: string;
  mutedForeground: string;
  logoPath: string;
};
```
**Env-override line to delete** (`lib/store-config.ts:~420`):
```typescript
theme: {
  ...storeDefaults.theme,
  primary: text(env, "NEXT_PUBLIC_THEME_PRIMARY", storeDefaults.theme.primary),
  logoPath: text(env, "NEXT_PUBLIC_STORE_LOGO_PATH", storeDefaults.theme.logoPath),
},
```
→ drop the `primary:` line entirely (keep `logoPath:`); the `text(env, "NEXT_PUBLIC_THEME_PRIMARY", ...)` call is the exact string to grep for zero-residue confirmation (TOKEN-04). Planner decides (per CONTEXT.md discretion) whether `theme.primary`/`.surface`/etc. fields stay on the type as a Phase-6 compatibility shim or are dropped now — `app/layout.tsx`'s consumption of `config.theme.surface`/`.foreground` (deleted per the layout.tsx pattern above) was the only other reader found besides this file itself.

---

### `lib/themes/tokens.ts` (new, utility, transform)

**Analog:** `lib/store-config.ts`'s `getStoreConfig()` typed-getter shape — a plain function returning a typed constant/derived object, safe to import from both server and client bundles (no `process.env` read inside the getter body, no D1/edge-only import).

**Pattern to copy** (structural, from `lib/store-config.ts`'s `StoreConfig` type + `storeDefaults` constant convention, `lib/store-config.ts:26-33` export style and `:97-121` defaults-object style):
```typescript
export type ThemeTokens = {
  primary: string; onPrimary: string; surface: string; surfaceElevated: string;
  foreground: string; mutedForeground: string; border: string; ring: string;
  success: string; warning: string; danger: string; info: string;
  surfaceInverse: string; surfaceInverseElevated: string; onInverse: string;
  mutedOnInverse: string; borderInverse: string;
  radiusSm: string; radiusMd: string; radiusLg: string; radiusXl: string;
  fontSans: string; fontDisplay: string;
};

const VOLT_DARK_TOKENS: ThemeTokens = { /* ... */ };

export function getThemeTokens(): ThemeTokens {
  return VOLT_DARK_TOKENS; // Phase 6 replaces this body only
}
```
Do not read `themes/volt-dark.css` at runtime (Anti-Pattern in RESEARCH.md, D-09) — this must stay a plain object literal, same constraint `lib/store-config.ts`'s own top-of-file comment states for `process.env` reads.

---

### `scripts/scan-hardcoded-colors.mjs` (new, utility, batch)

**Analog:** `scripts/check-deploy-config.mjs` (full file read, 52 lines).

**Imports pattern** (`scripts/check-deploy-config.mjs:1-4`):
```javascript
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseWranglerConfig } from "./lib/d1-migrate-plan.mjs";
```
(scan script instead imports `readdirSync`, `readFileSync`, `statSync` from `node:fs` and `join`/`extname` from `node:path`, per RESEARCH.md's Code Examples section.)

**Core pattern — try/catch + exit-code convention** (`scripts/check-deploy-config.mjs:34-52`):
```javascript
function main() {
  try {
    const config = parseWranglerConfig(readFileSync("wrangler.jsonc", "utf8"));
    // ... validation calls, each throws Error on failure ...
    console.log("[deploy-check] configuration contains no deployment placeholders.");
  } catch (error) {
    console.error(`[deploy-check] ABORT: ${error.message}`);
    process.exit(1);
  }
}
```
Scan script mirrors this exactly: walk `ROOTS = ["app", "components", "lib", "tailwind.config.ts"]`, skip `EXCLUDE_DIRS = new Set(["admin"])` (D-14 is the only exclusion), collect hits via the four regexes RESEARCH.md's Code Examples section already specifies (`HEX`, `RGB_HSL`, `RAW_PALETTE`, `INLINE_STYLE_COLOR`), print `[scan-tokens] ABORT: N hardcoded palette reference(s) found` and `process.exit(1)` on any hit, `console.log("[scan-tokens] clean.")` + implicit exit 0 otherwise. Register as `"scan:tokens": "node scripts/scan-hardcoded-colors.mjs"` in `package.json` (not a `pre*`-prefixed name — RESEARCH.md Pitfall 5).

---

### `scripts/screenshot-routes.mjs` (new, utility, file-I/O)

**Analog:** `scripts/build-with-public-env.mjs` (full file, 33 lines) for CLI-arg-parsing and exit-code shape; no Playwright/browser-driving script exists in this repo to copy from — this is the one file in the sweep with no true in-tree behavioral analog (see "No Analog Found" below), only a structural one.

**Imports/arg-parsing pattern to copy** (`scripts/build-with-public-env.mjs:1-14`):
```javascript
#!/usr/bin/env node
/** ... */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseWranglerConfig } from "./lib/d1-migrate-plan.mjs";

const args = process.argv.slice(2);
const envIndex = args.indexOf("--env");
const environment = envIndex >= 0 ? args[envIndex + 1] : undefined;
const command = envIndex < 0 ? args : args.filter((_, index) => index !== envIndex && index !== envIndex + 1);
if (!command.length || (envIndex >= 0 && !environment)) {
  console.error("Usage: node scripts/build-with-public-env.mjs [--env <name>] <command> [args...]");
  process.exit(1);
}
```
**Error handling pattern** (`scripts/build-with-public-env.mjs:16-33`):
```javascript
try {
  // ... work ...
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(`[build-with-public-env] ABORT: ${error.message}`);
  process.exit(1);
}
```
`screenshot-routes.mjs` follows the same `try/catch` + `[screenshot-routes] ABORT: ...` prefix + non-zero exit convention, with `--route <name>` and `--baseline` flags parsed the same way `--env` is parsed above. Import `chromium` from `playwright` (new devDependency, `checkpoint:human-verify` before install per RESEARCH.md's ASSUMED-package gating rule) instead of `spawnSync`.

---

### `tests/unit/lib/themes/token-contract.test.ts` (new, test, transform)

**Analog:** `vitest.config.mts` defines the target shape — `include: ["tests/unit/**/*.test.ts"]`, `environment: "node"`, path alias `"@"` → repo root. No specific existing `tests/unit/**` file was read this session, but any file matching that glob is the structural analog: standard Vitest `describe`/`it`/`expect` importing project modules via the `@/` alias, run via `mise exec -- npm run test -- <pattern>`. Assert `tailwind.config.ts` has no `#2a2a2a`/`#333333` literal and `getThemeTokens()` returns all 23 keys (RESEARCH.md's Phase Requirements → Test Map row for TOKEN-01).

---

### `components/cart/CartDrawer.tsx` / `components/agent/AgentDrawer.tsx` (inverse token set)

**Analog:** each other — both are Radix `Sheet`-based drawers using the same `@/components/ui/sheet` import and light-panel-on-dark-app convention; sweep them together as a pair per D-18 chunk 4.

**Imports pattern** (`CartDrawer.tsx:42-51`):
```tsx
import { useCartStore } from "@/lib/stores/cart-store";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import CartItemCard from "./CartItemCard";
import { Button } from "@/components/ui/button";
import { ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cartSubtotal, Money } from "@/lib/money";
import { useCartHydration } from "@/lib/hooks/useCartHydration";
import { useCartUIStore } from "@/lib/stores/cart-ui-store";
```

**Core inverse-panel pattern to rewrite** (`CartDrawer.tsx:71-75`):
```tsx
<Sheet open={isOpen} onOpenChange={setCartOpen}>
  <SheetContent 
    side="right"
    className="bg-[#fdfdfb] text-black  transition-all ease-in-out px-3 w-full sm:w-[400px] max-w-[400px]! duration-600! data-[state=closed]:duration-600! data-[state=open]:duration-600! flex flex-col h-full border-neutral-800"
  >
```
→ `bg-[#fdfdfb]` → `bg-surface-inverse`, `text-black` → `text-on-inverse`, `border-neutral-800` → `border-inverse` (D-05 exact mapping). `AgentDrawer.tsx`'s equivalent `SheetContent` className (not shown in this excerpt — grep `bg-[#fdfdfb]` in `AgentDrawer.tsx` to find its mirror instance) gets the identical token substitutions. Any `bg-gray-100`/`bg-gray-200` raised-card classes inside either drawer → `bg-surface-inverse-elevated`; any `text-gray-400..900` → `text-muted-on-inverse` (D-05).

---

### `components/ui/*` shadcn primitives (component, request-response)

**Analog:** `components/ui/button.tsx` (full `cva` variant block read, lines 56-79) stands for all 19 primitives sharing this pattern (`badge.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `table.tsx`, etc.).

**Core dead-class pattern to rewrite** (`button.tsx:56-72`):
```tsx
const buttonVariants = cva(
  "... focus-visible:ring-ring/50 ... aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      ...
    },
  }
)
```
Per D-17 + RESEARCH.md Pitfall 2's expanded mapping table: `text-primary-foreground` → `text-on-primary`; `bg-destructive`/`text-destructive`/`ring-destructive`/`border-destructive` → `bg-danger`/`text-danger`/`ring-danger`/`border-danger`; `bg-accent`/`text-accent-foreground` → `bg-surface-elevated`/`text-foreground`; `bg-secondary`/`text-secondary-foreground` → `bg-surface-elevated`/`text-foreground` (same target as accent, unless the sweep finds a distinct visual is needed); `bg-background` → `bg-surface`; `bg-card`/`text-card-foreground` → `bg-surface-elevated`/`text-foreground`; `text-popover-foreground` → `text-foreground`. `bg-primary`/`text-primary`/`border-primary` are already real (`runtimeColor`-backed) and need no remapping, only confirm they still resolve after the `store.*` group deletion in `tailwind.config.ts`. Rewrite in-place in each `components/ui/*` file's `cva()` string — do not add a Tailwind config alias layer (Anti-Pattern, D-17).

---

### `components/checkout/StripeProvider.tsx` (provider, request-response)

**No true in-tree analog** — the closest structural precedent is this file's own existing `elementsOptions` object shape plus `lib/themes/tokens.ts`'s `getThemeTokens()` as the value source (D-11).

**Current hardcoded appearance block to rewrite** (`StripeProvider.tsx:52-65`):
```tsx
const elementsOptions: StripeElementsOptions = {
  clientSecret,
  appearance: {
    theme: 'stripe',
    variables: {
      colorPrimary: '#f97316',
      colorBackground: '#ffffff',
      colorText: '#000000',
      colorDanger: '#ef4444',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
      ...(options.appearance?.variables || {}),
    },
    rules: {
      '.Input': { border: '1px solid #d1d5db', ... },
      '.Input:focus': { borderColor: '#f97316', boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.2)', ... },
      '.Input--invalid': { borderColor: '#ef4444' },
      '.Label': { ..., color: '#374151', ... },
      ...
    },
  },
};
```
→ `colorPrimary: tokens.primary`, `colorBackground: tokens.surfaceInverse`, `colorText: tokens.onInverse`, `colorDanger: tokens.danger`; `.Input` border → `tokens.borderInverse`; `.Input:focus` borderColor → `tokens.primary`; `.Input--invalid` borderColor → `tokens.danger`; `.Label` color → `tokens.mutedOnInverse` (D-11's exact mapping: `primary`, `surface-inverse`, `on-inverse`, `border-inverse`, `danger`, matching the email mapping in D-10). `tokens` reaches this `"use client"` component via `StoreConfigProvider` or a server prop per D-11 — planner's call.

---

### `app/global-error.tsx` (component, request-response)

**No true in-tree analog** — self-contained, renders without `globals.css`/theme file by design (D-13).

**Full current inline-style block** (`app/global-error.tsx:19-78`, already quoted in RESEARCH.md Pitfall 4): `background: "#171717"` → `tokens.surfaceElevated`, `color: "#ffffff"` → `tokens.foreground`, `color: "#d4d4d4"` (muted paragraph) → `tokens.mutedForeground`, `background: "#ea580c"` (button) → `tokens.primary` (flag as a close-enough snap per D-15/Pitfall 4 — current value is a hover-darkened orange, not base `#f97316`), `border: "1px solid #737373"` → `tokens.border` (post-consolidation value). **Critical:** map to the MAIN token set (`surfaceElevated`/`foreground`/`mutedForeground`/`primary`/`border`), NOT the inverse set — this file is currently dark-mode-matching, unlike emails/Stripe (RESEARCH.md Pitfall 4 — this is the single highest-risk polarity mistake in the sweep).

---

### `lib/utils/email.ts` and sibling email builders (utility, transform)

**Analog:** `lib/utils/email.ts` is the analog for `lib/fulfillment/shipping-email.ts`, `lib/payments/refund-email.ts`, `lib/utils/review-notifications.ts` — all four build inline-styled HTML strings the same way (template-literal HTML with `style="..."` attributes, `escapeHtmlText()` for user data, consumed by `lib/email/sender.ts`'s `sendEmail()`).

**Imports pattern** (`lib/utils/email.ts:1-5`):
```typescript
import { Money, type StoredMoney } from '@/lib/money';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';
import { getStoreConfig } from '@/lib/store-config';
import { postalFooterHtml, postalFooterText } from '@/lib/email/footer';
import { sendEmail, type EmailResult } from '@/lib/email/sender';
```
→ add `import { getThemeTokens } from '@/lib/themes/tokens';` alongside these.

**Core inline-hex pattern to rewrite** (`lib/utils/email.ts:148-188`, representative sample of the file's 85 hex occurrences):
```typescript
<tr style="border-bottom: 1px solid #e2e8f0;">
  <td style="padding: 12px 0; vertical-align: top; width: 60px;">
    ${absoluteImageUrl ? `<img ... style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover; display: block;">` : `<div style="width: 50px; height: 50px; background-color: #f1f5f9; border-radius: 4px; ...; color: #64748b; ...">No Image</div>`}
  <td style="padding: 12px 0 12px 16px; vertical-align: top;">
    <div style="color: #1e293b; font-size: 16px; font-weight: bold; ...">${safeName}</div>
    <div style="color: #64748b; font-size: 14px; ...">Quantity: ...</div>
...
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: ...;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0 48px; ...; max-width: 600px;">
    <div style="text-align: center; padding: 32px 0; border-bottom: 1px solid #e6ebf1;">
      <h1 style="color: #f97316; font-size: 32px; ...">${safeStoreName}</h1>
```
Per D-10's exact mapping: page background (`#f6f9fc`) → `tokens.surfaceInverse`; card/section background (`#ffffff`, `#f1f5f9`) → `tokens.surfaceInverseElevated`; body/heading text (`#1e293b`) → `tokens.onInverse`; muted text (`#64748b`) → `tokens.mutedOnInverse`; dividers/borders (`#e2e8f0`, `#e6ebf1`) → `tokens.borderInverse`; brand accent (`#f97316`) → `tokens.primary`. Since `lib/utils/email.ts` carries 85 of ~127 total hex occurrences, size this file as its own review pass within chunk 5 rather than treating the three CONTEXT.md-named files as the primary surface (RESEARCH.md Summary finding).

---

## Shared Patterns

### `getThemeTokens()` as the single non-CSS-cascade bridge
**Source:** `lib/themes/tokens.ts` (new)
**Apply to:** `components/checkout/StripeProvider.tsx`, `app/layout.tsx` (Clerk `variables`), `app/global-error.tsx`, `lib/utils/email.ts` + 3 sibling email builders.
Each of these five consumer files should import `getThemeTokens()` the same way `lib/store-config.ts`'s `getStoreConfig()` is imported elsewhere in the codebase — a single call at the top of the function/component, destructure the fields needed, never re-derive hex from a CSS variable string.

### Exit-code / `[tag] ABORT: message` convention for all new scripts
**Source:** `scripts/check-deploy-config.mjs:48-51`, `scripts/build-with-public-env.mjs:30-33`
**Apply to:** `scripts/scan-hardcoded-colors.mjs`, `scripts/screenshot-routes.mjs`
```javascript
} catch (error) {
  console.error(`[scan-tokens] ABORT: ${error.message}`);
  process.exit(1);
}
```

### D-07 unprefixed class naming
**Source:** D-01/D-07 (CONTEXT.md)
**Apply to:** every swept `.tsx` file — `bg-surface`, `text-foreground`, `bg-primary`, `text-on-primary`, `bg-surface-inverse`, `border-border`, `ring-ring`, `bg-info`, `rounded-md`. Never reintroduce a `store-` prefixed className during the sweep (only the underlying CSS custom property keeps that prefix, per plan-time confirmation needed against `themes/volt-dark.css`'s variable names — see the `tailwind.config.ts` pattern note above).

### Main-set vs inverse-set token selection
**Source:** D-05/D-10/D-11 vs Pitfall 4
**Apply to:** any file being swept — before picking a token, check whether the surface is currently light-panel-on-dark-app (→ inverse set: `CartDrawer.tsx`, `AgentDrawer.tsx`, `StripeProvider.tsx`, all four email files) or dark-panel-in-dark-app (→ main set: everything else, including `global-error.tsx` despite its grouping alongside emails in D-13's prose).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/screenshot-routes.mjs` | utility | file-I/O | No Playwright/browser-automation script exists in this repo; `scripts/build-with-public-env.mjs` supplies only the CLI-parsing/exit-code shape, not the browser-driving logic — build from RESEARCH.md's Standard Stack + Code Examples sections instead |
| `components/checkout/StripeProvider.tsx` appearance mapping | provider | request-response | No other third-party-widget theming bridge exists in-tree; use `getThemeTokens()` + this file's own existing `elementsOptions` object shape as the pattern, per D-11's explicit mapping table |

## Metadata

**Analog search scope:** `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `lib/store-config.ts`, `scripts/*.mjs`, `vitest.config.mts`, `components/cart/CartDrawer.tsx`, `components/agent/AgentDrawer.tsx`, `components/ui/button.tsx`, `components/checkout/StripeProvider.tsx`, `app/global-error.tsx`, `lib/utils/email.ts`
**Files scanned:** 13 read directly this session (full or targeted excerpts), cross-referenced against RESEARCH.md's prior whole-tree grep counts (88 files, 127 hex occurrences)
**Pattern extraction date:** 2026-09-03
