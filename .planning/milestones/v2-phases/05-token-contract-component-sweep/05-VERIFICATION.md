---
phase: 05-token-contract-component-sweep
verified: 2026-09-04T18:18:32Z
status: passed
score: 8/9 must-haves verified
behavior_unverified: 1
overrides_applied: 0
human_verification:
  - test: "Seed a local order and run `mise exec -- npm run screenshot:routes` against `/order-status/[id]`, then diff against a pre-sweep capture of the same route (or visually confirm it looks unchanged)."
    expected: "Order-status renders identically to pre-sweep, uses volt-dark tokens (status quartet colours, especially the `info`-token 'processing' state), and shows no raw palette value."
    why_human: "No screenshot of `/order-status` exists anywhere in the phase (baseline through phase-close) because the local D1 seed has no orders. The route is scan-clean (`scan:tokens --path app/order-status` → 0 violations) and was verified by code read (05-11), but the ROADMAP's explicit 'before/after screenshots per route' criterion is unmet for this one route — visual regression there has never actually been observed."
  - test: "Complete a real checkout with a seeded cart through the Stripe test payment form, and visually confirm the mounted Elements iframe renders as a light inverse-token panel matching D-11/D-09's intent."
    expected: "Stripe's rendered payment form matches the `appearance` config derived from `getThemeTokens()` — light surface, correct field colours, no raw hex leaking through the iframe boundary."
    why_human: "`POST /api/payment-intent` returned 400 in every session this phase ran, so the Elements iframe never mounted in any capture. Verified only by a direct code read of `StripeProvider.tsx`'s `appearance` config, not by an actual rendered payment form."
  - test: "Sign in as a real (or seeded) authenticated user and visually confirm `/account` renders correctly — nav, address manager, profile settings, gift cards, subscriptions — under volt-dark."
    expected: "Authenticated account dashboard renders identically to pre-sweep with no untokenised surface."
    why_human: "The unauthenticated `/account` route 404s onto `app/not-found.tsx` in every capture across the whole phase; the tracked screenshot grid never once reached the actual authenticated dashboard. Verified only by `scan:tokens --path app/account` (0 violations) and a code read against TOKEN-MAP §2/§2b."
  - test: "Trigger a real unhandled exception (e.g. throw inside a route) in a production-like build and visually confirm `app/global-error.tsx` renders as a DARK page using the main token set, with no stylesheet dependency."
    expected: "The standalone error boundary renders dark (not light/inverse), matching the elevated-surface value, with correct colours even with no CSS loaded."
    why_human: "This page only renders on an unhandled exception and isn't reachable via the screenshot grid or a scripted walkthrough. Verified only by code read (`app/global-error.tsx` imports `getThemeTokens()` main-set fields directly) — never observed live."
  - test: "Open the six rendered transactional emails (order confirmation, shipping, refund, subscription lifecycle, review notification, and the shared footer) in an actual mail client or browser and visually confirm the new token colours read correctly, especially the darkened divider (S10)."
    expected: "Emails render as light panels with correct token colours; the divider-darkening change reads as intentional, not as a visual defect."
    why_human: "Pre/post HTML was hashed and diffed programmatically (`05-SCREENSHOTS.md` Part 1) but never opened in a browser or mail client. A colour that is bytewise-correct can still look wrong rendered."
  - test: "Tab to a default-state (non-danger) focusable control anywhere in the storefront and visually confirm the focus ring renders at `#404040` (S3); trigger the `app/global-error.tsx` primary action button and confirm it renders on the base `primary` token (S11)."
    expected: "Both snaps render as specified with no regression."
    why_human: "Neither snap has any capture evidence anywhere in the phase (05-12's own honest summary states this explicitly) — S3's only ring capture used the danger-coloured invalid ring, not the default one; S11's surface is unreachable outside a real crash."
---

# Phase 5: Token Contract & Component Sweep Verification Report

**Phase Goal:** The storefront's visual design is fully token-driven — the ~18-token contract (frozen at 23 tokens) is frozen and wired through Tailwind, the current look is preserved as `themes/volt-dark.css` with zero visual regression, and no storefront component or template holds a hardcoded palette value (admin explicitly excluded).
**Verified:** 2026-09-04T18:18:32Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Site renders identically to before the sweep, verified with before/after screenshots per D-20 route (home, category, product, cart, checkout, account, order-status), with `themes/volt-dark.css` live as the `[data-theme="volt-dark"]` block and `data-theme` stamped on `<html>` server-side | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Mechanism confirmed: `app/layout.tsx:140` stamps `data-theme="volt-dark"` on `<html>`; built CSS bundle contains the live `[data-theme=volt-dark]` block (`.next/static/css/*.css`). 6 of 7 D-20 routes have full resting/nav-open coverage at both viewports (`05-SCREENSHOTS.md` roll-up). `order-status` has **zero** captures across the entire phase (local D1 has no seeded orders); `checkout`'s payment step and `account`'s authenticated dashboard also have no live capture. See human verification items 1–3. |
| 2 | `tailwind.config.ts` maps all tokens through `runtimeColor()`, hardcoded `border`/`ring` hex values deleted | ✓ VERIFIED | Read `tailwind.config.ts`: 17 colour keys via `runtimeColor("--store-*")`, 4 radii via `borderRadius`, 2 faces via `fontFamily` = 23 tokens, zero hex literals (`grep -cE '#[0-9a-fA-F]{3,8}' tailwind.config.ts` → 0). |
| 3 | A whole-tree scan (Tailwind config, inline `style={}`, SVG fill/stroke, dead shadcn classes) finds zero hardcoded palette values in storefront code | ✓ VERIFIED | Ran `mise exec -- npm run scan:tokens` directly: `[scan-tokens] 0 violations`, with exactly the two documented manual-review rows printed (`lib/utils/image-placeholders.ts`, `lib/types/mach/Promotion.ts`). Scanner (`scripts/scan-hardcoded-colors.mjs`, 331 lines) matches hex literals, functional colours, and a full Tailwind-prefix list including `fill`/`stroke` (SVG) — not just classNames. |
| 4 | `NEXT_PUBLIC_THEME_PRIMARY` no longer exists in the codebase; `logoPath` still resolves via store-config unchanged | ✓ VERIFIED | `grep -rn NEXT_PUBLIC_THEME_PRIMARY` across `.ts/.tsx/.mjs/.json` finds zero matches in source (only a stale `.open-next` build artifact and `MILESTONE-SEED.md` planning doc, neither of which is source or a build input read at runtime). `lib/store-config.ts`'s `StoreConfig.theme` type now declares only `{ logoPath: string }`; `getStoreConfig().theme.logoPath` resolves to `/volt.png`, unchanged. |
| 5 | The built CSS bundle contains both the theme custom properties and a generated utility class that consumes them — the token path resolves end to end | ✓ VERIFIED | `mise exec -- npm run build` succeeds; inspected `.next/static/css/*.css` directly: contains `[data-theme=volt-dark]{--store-primary:#f97316;...}` (all 23 properties) and `.bg-surface{background-color:rgb(from var(--store-surface) r g b/1)}`. |
| 6 | The five inverse tokens (`surface-inverse`, `surface-inverse-elevated`, `on-inverse`, `muted-on-inverse`, `border-inverse`) each have a real consumer, applied only to the two light drawer panels | ✓ VERIFIED | All five classes found in `components/cart/CartDrawer.tsx`, `CartItemCard.tsx`, `components/agent/AgentDrawer.tsx`, `ProductCard.tsx`. Confirmed the earlier `border-inverse` typo bug (05-09 deviation) is fixed everywhere — only `border-border-inverse` (the correct Tailwind class name) appears, no bare `border-inverse`. |
| 7 | All six transactional email builders source colours from `getThemeTokens()`, with HTML-escaping calls intact | ✓ VERIFIED | `getThemeTokens` imported/called in `lib/utils/email.ts`, `lib/fulfillment/shipping-email.ts`, `lib/payments/refund-email.ts`, `lib/subscriptions/lifecycle-email.ts`, `lib/utils/review-notifications.ts`, `lib/email/footer.ts`. `git show b19f8a8 -- lib/utils/email.ts` shows no diff touching any `escapeHtmlText` call; the calls are still present and used on all interpolated customer data. |
| 8 | Admin retains its hardcoded palette; no admin file was modified by the sweep | ✓ VERIFIED | `app/globals.css`'s admin rule block is wrapped in `gsd:scan-ignore-start/-end` sentinels, unchanged raw `rgb()` values (`rgb(234 88 12)` etc.), not converted to tokens. Scanner hard-excludes any path segment named `admin` (`scripts/scan-hardcoded-colors.mjs:24,132`). |
| 9 | Full test suite, typecheck, lint, and build are all green at phase close | ✓ VERIFIED | Ran independently: `npx vitest run` → 244 files / 1882 tests passed. `npm run typecheck` → clean. `npm run lint` → 0 errors, 52 pre-existing warnings unrelated to this phase (React hook purity rules in unrelated files). `npm run build` → exit 0, all routes compiled. |

**Score:** 8/9 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/scan-hardcoded-colors.mjs` | Whole-tree hardcoded-palette scan, exit-code gated (min 90 lines) | ✓ VERIFIED | 331 lines. Runs, exits 0 on clean tree, matches hex/functional-color/Tailwind-palette/dead-shadcn classes. |
| `tests/unit/scripts/scan-hardcoded-colors.test.ts` | Fail-first proof of the scan gate (min 30 lines) | ✓ VERIFIED | 81 lines. Passes (`vitest run` — 14/14 across both token-related test files). |
| `themes/volt-dark.css` | Single `[data-theme="volt-dark"]` block, all 23 tokens, no fallback chains | ✓ VERIFIED | Confirmed single selector (`grep -c '^\[data-theme'` → 1), 23 `--store-*` declarations, zero `var(--store-` fallback references. |
| `lib/themes/tokens.ts` | `getThemeTokens()`, typed non-cascade bridge | ✓ VERIFIED | 80 lines, exports `ThemeTokens` type and `getThemeTokens()`, values match `themes/volt-dark.css` byte-for-byte (spot-checked all fields). |
| `tests/unit/lib/themes/token-contract.test.ts` | Contract test: 23 keys, config↔theme parity, no hex in config | ✓ VERIFIED | 139 lines, passes. |
| `scripts/screenshot-routes.mjs` | Playwright multi-viewport/state capture (min 110 lines) | ✓ VERIFIED | 271 lines, exists and referenced by `05-SCREENSHOTS.md`'s capture log. |
| `.planning/phases/.../05-SCREENSHOTS.md` | Per-chunk manifest, phase-close coverage record | ✓ VERIFIED (with documented gaps) | 91.5K, extremely thorough — includes its own honest gap analysis (order-status 0% coverage, S3/S11 uncaptured, checkout payment step uncaptured). |
| `components/ui/button.tsx` | cva variants driven by contract tokens | ✓ VERIFIED | Confirmed via 05-04 SUMMARY + scan-clean status of `components/ui/`. |
| `components/cart/CartDrawer.tsx`, `components/agent/AgentDrawer.tsx` | Inverse-token light panels, no hardcoded hex | ✓ VERIFIED | `bg-surface-inverse` present in both; scan-clean. |
| `lib/store/StoreConfigProvider.tsx` | Server-to-client theme token channel | ✓ VERIFIED | Exports `useThemeTokens` per 05-10 SUMMARY; `StripeProvider.tsx` consumes it. |
| `app/global-error.tsx` | Standalone dark error page via `getThemeTokens()` | ✓ VERIFIED | Contains `getThemeTokens` import per 05-11 SUMMARY; not live-exercised (see human verification #4). |
| `lib/utils/email.ts` (+ 5 sibling builders) | Email HTML sourced from `getThemeTokens()` | ✓ VERIFIED | Confirmed all six files import/call `getThemeTokens`; escaping calls intact. |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `package.json` | `scripts/scan-hardcoded-colors.mjs` | `scan:tokens` npm script | ✓ WIRED — ran it directly, works. |
| `app/globals.css` | `themes/volt-dark.css` | `@import` ahead of `@config` | ✓ WIRED — built CSS bundle contains the theme block, confirming the import resolved. |
| `tailwind.config.ts` | `themes/volt-dark.css` | `runtimeColor("--store-...")` | ✓ WIRED — generated `.bg-surface` utility resolves `rgb(from var(--store-surface)...)` in the built CSS. |
| `app/layout.tsx` | `themes/volt-dark.css` | `data-theme` attribute on `<html>` | ✓ WIRED — confirmed in source and matches built CSS selector. |
| `components/checkout/StripeProvider.tsx` | `lib/store/StoreConfigProvider.tsx` | `useThemeTokens()` hook | ✓ WIRED per 05-10 SUMMARY (not independently re-verified live — Stripe iframe never mounted; see human verification #2). |
| `lib/utils/email.ts` | `lib/themes/tokens.ts` | direct `getThemeTokens()` import | ✓ WIRED — confirmed by grep. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| TOKEN-01 | 05-03, 05-12 | 23-token contract defined and mapped through `runtimeColor()` in `tailwind.config.ts`, hardcoded `border`/`ring` hex deleted | ✓ SATISFIED | Truth #2 above. |
| TOKEN-02 | 05-03, 05-12 | Current look lives verbatim in `themes/volt-dark.css` as `[data-theme="volt-dark"]`; `app/layout.tsx` stamps `data-theme` server-side | ✓ SATISFIED | Truth #2, #5 above. |
| TOKEN-03 | 05-01, 05-04–05-12 | All storefront components/templates use token classes; whole-tree scan finds zero hardcoded palette values; admin excluded | ✓ SATISFIED | Truth #3, #8 above. |
| TOKEN-04 | 05-03, 05-12 | `NEXT_PUBLIC_THEME_PRIMARY` deprecated; `logoPath` stays in store-config | ✓ SATISFIED | Truth #4 above. |
| TOKEN-05 | 05-02, 05-04–05-12 | Before/after screenshots per route accompany each sweep PR | ⚠️ PARTIALLY SATISFIED | 6/7 D-20 routes fully captured; order-status has zero captures phase-wide (environment-limited, not code-limited). See Truth #1 / human verification. |

No orphaned requirements — all five TOKEN-* IDs mapped to Phase 5 in REQUIREMENTS.md are claimed by at least one plan in this phase.

### Anti-Patterns Found

Scanned all files referenced in plan `must_haves.artifacts` plus the union of files named across all 12 plans' `<files>` blocks (55 files) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented" patterns.

**None found.** No debt markers, no stub returns, no hardcoded empty data patterns in phase-touched files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Whole-tree scan reports 0 violations | `mise exec -- npm run scan:tokens` | `[scan-tokens] 0 violations`, 2 manual-review rows printed | ✓ PASS |
| Scan/contract unit tests pass | `npx vitest run tests/unit/scripts/scan-hardcoded-colors.test.ts tests/unit/lib/themes/token-contract.test.ts` | 2 files / 14 tests passed | ✓ PASS |
| Full test suite green | `npx vitest run` (run once) | 244 files / 1882 tests passed | ✓ PASS |
| Typecheck clean | `npm run typecheck` | clean | ✓ PASS |
| Lint clean (0 errors) | `npm run lint` | 0 errors, 52 pre-existing warnings unrelated to phase | ✓ PASS |
| Production build succeeds | `npm run build` | exit 0, all routes compiled | ✓ PASS |
| Built CSS contains theme block + consuming utility | inspected `.next/static/css/*.css` | `[data-theme=volt-dark]{...23 props...}` and `.bg-surface{...var(--store-surface)...}` both present | ✓ PASS |
| `NEXT_PUBLIC_THEME_PRIMARY` absent from source | `grep -rn NEXT_PUBLIC_THEME_PRIMARY` (ts/tsx/mjs/json) | 0 matches outside `.open-next` build artifact and a planning doc | ✓ PASS |

### Human Verification Required

6 items need human testing — all environment-limited visual-regression proofs the executors already flagged as unreachable in local dev, not code defects. Code-level evidence (scoped `scan:tokens` passes, code reads, token-contract tests) supports each surface; only the live visual confirmation is outstanding.

1. **Order-status route visual regression**
   **Test:** Seed a local order, run the screenshot harness against `/order-status/[id]`, compare to pre-sweep.
   **Expected:** Renders identically; status colours (especially `info` for "processing") read correctly.
   **Why human:** Zero captures exist for this route anywhere in the phase — local D1 has no seeded orders in any session.

2. **Checkout payment step (Stripe Elements) visual confirmation**
   **Test:** Complete a real test checkout through Stripe Elements, observe the rendered form.
   **Expected:** Light inverse-token panel, correct field colours, matches `StripeProvider.tsx`'s `appearance` config.
   **Why human:** The Elements iframe never mounted in any session (`/api/payment-intent` returned 400 every time); only code-reviewed.

3. **Authenticated account dashboard visual confirmation**
   **Test:** Sign in and view `/account` (nav, address manager, profile, gift cards, subscriptions).
   **Expected:** Renders identically to pre-sweep, no untokenised surface.
   **Why human:** Every capture attempt 404s to the unauthenticated fallback; the actual dashboard was never screenshotted, only scan-verified and code-read.

4. **`app/global-error.tsx` live dark-page rendering**
   **Test:** Trigger a real unhandled exception in a production-like build.
   **Expected:** Dark page (main token set), correct even with no stylesheet loaded.
   **Why human:** Only reachable via an actual crash; verified only by code read.

5. **Transactional email visual confirmation**
   **Test:** Open all six rendered emails in a mail client or browser.
   **Expected:** Correct token colours, including the intentionally-darkened divider (S10).
   **Why human:** Only hash-diffed programmatically, never visually opened.

6. **Snaps S3 (default focus ring) and S11 (global-error primary button)**
   **Test:** Tab to a non-danger focusable element; trigger the error page's primary action.
   **Expected:** Both render per the frozen token contract with no regression.
   **Why human:** Neither has any capture evidence anywhere in the phase — explicitly acknowledged as a gap in `05-SCREENSHOTS.md`'s own honest summary.

### Gaps Summary

No blocking gaps. All four ROADMAP mechanism/contract criteria (token mapping, theme file, whole-tree scan, env-var removal) are independently verified against the codebase, not just claimed. The one incomplete area — full before/after screenshot coverage for every D-20 route — is honestly documented by the phase's own `05-SCREENSHOTS.md`, which is unusually candid about exactly which cells are missing and why (local dev environment limitations: no seeded orders, Stripe payment-intent 400s, no authenticated session reachable). These are visual-appearance confirmations that inherently require a human (or a better-seeded environment) rather than code defects — hence `human_needed` rather than `gaps_found`.

---

_Verified: 2026-09-04T18:18:32Z_
_Verifier: Claude (gsd-verifier)_

---

**Human verification outcome (2026-09-04T18:34:02Z):** Russell accepted the six human-verification items as passed on the strength of the code-level evidence above, via /gsd-autonomous. See 05-UAT.md.
