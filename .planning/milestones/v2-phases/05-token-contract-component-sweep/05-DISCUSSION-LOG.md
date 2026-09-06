# Phase 5: Token Contract & Component Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 5-token-contract-component-sweep
**Areas discussed:** Inverted light panels, Sweep boundary, Color mapping rules, Screenshot & PR cadence

---

## Inverted light panels

### How should the light cart/agent drawers be tokenized?

| Option | Description | Selected |
|--------|-------------|----------|
| Add inverse tokens | surface-inverse + on-inverse (and border-inverse) in the contract; zero visual change; light preset can flip them | ✓ |
| Fold into surface-elevated | Drawers go dark like every other panel; deliberate visual change | |
| Keep as documented exception | Leave hardcoded, listed in scan exclusions; Phase 6 light preset inherits an unthemeable panel | |

**User's choice:** Add inverse tokens

### How deep does the inverse token set go?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the main set | surface-inverse, surface-inverse-elevated, on-inverse, muted-on-inverse, border-inverse | ✓ |
| Minimal pair + opacity | Two tokens; muted/raised via opacity modifiers | |
| Three tokens | surface-inverse, on-inverse, muted-on-inverse | |

**User's choice:** Mirror the main set

### Required in every theme, or optional with fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| Required, no fallback | Every theme declares all tokens; validator stays simple | ✓ |
| Optional, fallback to main set | var(--x, var(--y)) fallback; smaller theme files, validator split | |

**User's choice:** Required, no fallback

### Class naming the sweep standardizes on

| Option | Description | Selected |
|--------|-------------|----------|
| Unprefixed only | bg-surface, text-foreground, bg-primary; drop store- prefix and background alias; CSS vars stay --store-* | ✓ |
| Keep store- prefix | bg-store-surface; grep-friendly, longer | |
| Keep both | Mixed spelling; scan can't tell tokenized from stray | |

**User's choice:** Unprefixed only

---

## Sweep boundary

### Do the email templates get swept?

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope, exclude by path | Mail clients lack CSS vars; emails have their own light layout | |
| Sweep them to theme hex values | Inject active theme's token values into inline email styles | ✓ |

**User's choice:** Sweep them to theme hex values
**Notes:** Claude flagged this as slightly past "token classes in components"; user chose it anyway.

### Where do emails get token hex values in Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Typed token object, Phase 6 rewires it | lib/themes/tokens.ts getThemeTokens() returns volt-dark constants; Phase 6 points it at the manifest | ✓ |
| Parse themes/volt-dark.css at send time | Workers can't read the filesystem at runtime; needs a build step anyway | |
| You decide | Planner picks under the one-source constraint | |

**User's choice:** Typed token object, Phase 6 rewires it

### Which tokens do the light email layouts map to?

| Option | Description | Selected |
|--------|-------------|----------|
| primary + inverse set | Reuses the drawer tokens; emails stay light under volt-dark | ✓ |
| primary + main set | Black emails with white text under volt-dark | |
| primary only | Slate grays stay hardcoded; scan needs an allowlist | |

**User's choice:** primary + inverse set

### Stripe Elements appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Feed it tokens via inverse set | Appearance API gets hex from getThemeTokens(); form stays light, flips with theme later | ✓ |
| Documented exception | Leave hardcoded, list in exclusions | |
| You decide | Planner picks under the no-surviving-hex constraint | |

**User's choice:** Feed it tokens via inverse set

### Clerk and Sonner

| Option | Description | Selected |
|--------|-------------|----------|
| Sonner to token classes, Clerk gets variables | Toaster → bg-primary/80 text-on-primary; Clerk keeps baseTheme dark, variables from getThemeTokens() | ✓ |
| Sonner only, Clerk untouched | Clerk stays stock dark as an exception | |
| Both untouched | Documented exceptions for both | |

**User's choice:** Sonner to token classes, Clerk gets variables

### app/global-error.tsx inline hex

| Option | Description | Selected |
|--------|-------------|----------|
| Import token constants | Values from getThemeTokens(); passes the scan | ✓ |
| Documented exception | Leave hex, add to exclusions with a comment | |

**User's choice:** Import token constants

---

## Color mapping rules

### Governing rule for ambiguous classes

| Option | Description | Selected |
|--------|-------------|----------|
| Pixel-identical first, semantic by context | Rendered color must not change; snap only when no exact match, record in manifest | |
| Strict pixel-identical, no snapping | Unmatched shades stay raw in an exceptions list | |
| Semantic first, accept drift | Choose token by role even if the shade shifts a step | ✓ |

**User's choice:** Semantic first, accept drift

### Where does blue go?

| Option | Description | Selected |
|--------|-------------|----------|
| Add an info token | success/warning/danger/info quartet; blue-600 → bg-info | ✓ |
| Map to primary | Brand accent for processing status and chat bubbles | |
| Map to muted-foreground | Blue becomes neutral gray | |

**User's choice:** Add an info token

### shadcn dead classes in components/ui

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite to the contract | bg-accent → bg-surface-elevated, bg-destructive → bg-danger, etc.; visible change where they appear, screenshot them | ✓ |
| Alias in Tailwind config | Define accent/muted/destructive as aliases; two vocabularies forever | |
| Delete the dead classes | Nothing changes visually; hover states stay invisible | |

**User's choice:** Rewrite to the contract

### Radius mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Three tokens; xl and full stay raw | sm/md/lg only | |
| Add radius-xl | Four tokens; rounded-full stays raw | ✓ |
| Single radius token with a scale | One --store-radius with calc() derivations | |

**User's choice:** Add radius-xl

### Acceptable drift vs regression

| Option | Description | Selected |
|--------|-------------|----------|
| Shade drift only, documented | Shade may snap to token neighbor; layout/spacing/opacity/shadow/polarity must not change; snaps listed per PR | |
| Anything the reviewer approves | Screenshots as review aid only | |
| Palette-only, zero shade change | Back off to pixel-identical | |

**User's choice:** Free text — "let's consolidate to the least viable number of shades - as long as it is pretty close I don't mind standardizing"
**Notes:** Interpreted as: aggressive palette reduction is the goal; close snaps are not regressions. Non-color properties (layout, spacing, shadows, opacity, surface polarity) remain regression-gated (recorded as D-16 in CONTEXT.md).

---

## Screenshot & PR cadence

### How are before/after screenshots captured?

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright devDep + script | scripts/screenshot-routes.mjs against localhost; reusable in Phase 8 | |
| Manual via Chrome DevTools | chrome-cdp skill; not repeatable | |
| You decide | Planner picks; must be repeatable for Phase 8 and add nothing to the Worker bundle | ✓ |

**User's choice:** You decide

### Where do screenshot images live?

| Option | Description | Selected |
|--------|-------------|----------|
| Git-ignored folder + manifest in phase dir | .screenshots/ ignored; SCREENSHOTS.md with route, viewport, hash, intentional snaps | ✓ |
| Commit under .planning/phases/05-*/screenshots/ | Full images in git | |
| Attach to PRs only | Images on GitHub only | |

**User's choice:** Git-ignored folder + manifest in phase dir

### What does "each sweep PR" mean given branching_strategy is none?

| Option | Description | Selected |
|--------|-------------|----------|
| One branch per sweep chunk, PR to main | Five chunks: contract/no-op; shell + ui/; home/category/product; cart/checkout/drawers/Stripe; account/order-status/emails/error/Clerk | ✓ |
| Single phase branch, one PR | One 85+-file review | |
| Direct to main, no PRs | Keep branching none; "PR" becomes "plan" | |

**User's choice:** One branch per sweep chunk, PR to main

### Screenshot coverage per route

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop + mobile, resting + one open state | 1280 and 390; resting page plus the route's main interactive surface | ✓ |
| Desktop only, resting pages | 7 shots per chunk | |
| Desktop + mobile, resting only | 14 shots per chunk | |

**User's choice:** Desktop + mobile, resting + one open state

---

## Claude's Discretion

- Screenshot capture tooling (constraints: repeatable for Phase 8, nothing on the deploy path)
- `on-primary` value under volt-dark (white vs black on orange)
- `font-display` face under volt-dark
- Which of amber/yellow becomes the `warning` shade
- Consolidated `border`/`ring` values
- Whether `StoreConfig.theme` keeps fields other than `logoPath` as a shim through Phase 6
- Header Suspense fallback color, globals.css focus outline, SVG placeholder fill

## Deferred Ideas

None — discussion stayed within phase scope.
