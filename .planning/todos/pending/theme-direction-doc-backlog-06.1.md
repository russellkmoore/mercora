---
title: Direction-document properties and layout behaviours the four new presets do not carry
created: 2026-09-05
resolves_phase: null
source: 06.1-UI-SPEC.md (Phase 6.1 plan 04), extends .planning/todos/pending/theme-contract-dropped-properties.md
---

# What `clinical`, `retro`, `atelier`, and `market` deliberately do not implement

`docs/voltique-theme-direction.md`'s four remaining preset specs each name visual properties and
per-theme layout behaviours beyond the frozen 23-token contract
(`.planning/phases/05-token-contract-component-sweep/05-TOKEN-MAP.md` §1, one-way frozen per Phase
5 D-01) and beyond this milestone's tokens-only, no-per-theme-markup architecture (PROJECT.md Key
Decision: "Per-theme component/markup overrides are rejected on principle"). This note is the
Phase 6.1 continuation of `.planning/todos/pending/theme-contract-dropped-properties.md` (Phase 6's
note for `luxe`/`midnight`) — read that note first; this one does not repeat its "what extending
the contract would touch" analysis, which applies unchanged to every property listed below.

## Clinical

- **`shadow`** — the doc specifies `0 1px 2px oklch(0% 0 0 / .05)`, a barely-there elevation cue.
  No shadow token exists; Clinical ships with Tailwind's default `shadow` utilities only, same as
  every other preset.

Clinical has no `accent-2` in its own doc section and no other named dropped property beyond the
shared list Phase 6 already recorded (border-width, image-aspect, font-mono, letter-spacing).

## Retro

- **Hard offset shadow + hover lift** — the doc specifies cards with a `2px` border and a `4px 4px
  0` hard shadow in `accent-2`, with the card shifting up-left and the shadow growing on hover.
  Retro ships with the default border and no shadow/hover-lift interaction; only `border`'s *hue*
  survives (derived independently, since the doc gives width not colour — see
  `06.1-UI-SPEC.md`'s Retro table), not its `2px` thickness or the offset-shadow treatment.
- **Second accent (`accent-2`)** — the doc's own "what it's testing" table names `accent-2` as a
  property Retro stresses (`oklch(85% .15 195)` cyan), but that exact value is also the doc's own
  literal `success` colour — the doc reuses one hue for both roles. Because `success` already
  consumes it, there is no independent second-accent role left for Retro to carry, and none was
  invented; `info` is derived from a different hue entirely (see `06.1-02-SUMMARY.md`). No visual
  property is lost here — the doc's dual-use of one hue is the reason there's nothing separate to
  carry, not a gap this phase created.
- **Decorative hero background** — a CSS `repeating-linear-gradient` perspective grid with an
  optional scanline overlay. Component markup/decorative CSS, not a token; out of scope per
  Phase 6.1's CONTEXT (`docs/voltique-theme-direction.md`'s non-contract properties are explicitly
  excluded).

## Atelier

- **`shadow` (soft shadow on hover)** — the doc specifies `0 2px 12px oklch(30% .03 60 / .12)`,
  applied only on hover. No shadow token exists; Atelier's cards use the same default shadow
  treatment as every other preset, hover or not.
- **`border-width: 0`** — the doc wants zero border width on Atelier's cards. The contract has no
  width token (colour only, via `border`/`border-inverse`); existing `border-border` component
  classes keep their default Tailwind width under every preset, including Atelier.

Atelier's `accent-2` (sage) was **not** dropped — it was folded into `info` per the rename map's
status/badge-role condition (the doc uses it for "small batch"/"ships in 2 weeks" badges), recorded
in `06.1-02-SUMMARY.md`.

## Market

- **Second accent (`accent-2`)** — the doc specifies `oklch(70% .18 45)` orange, used for a
  decorative promo-banner strip (a status/badge role does not apply, so the rename map's
  fold-into-`info` condition is not met). Genuinely dropped, unlike Atelier's — `info` is derived
  independently from a different hue (see `06.1-02-SUMMARY.md`).
- **`font-body` recommendation** — the doc recommends Nunito for body copy. CONTEXT D-05
  overrides this explicitly: `font-sans` stays the Geist stack for all four new presets: Nunito
  is used for `font-display` only. Recorded here as a deliberate override, not an oversight.
- **`shadow` (hover lift)** — the doc specifies `0 4px 16px oklch(25% .04 140 / .1)` with the card
  lifting `2px` on hover. No shadow token, no lift animation implemented.
- **Decorative promo banner strip** — component markup, not a token; out of scope.

## Per-theme layout behaviours routed to Phase 7 (enumerated variants), not this milestone's tokens

The direction doc describes several per-theme *layout* behaviours that this milestone's
architecture deliberately does not build as per-theme markup — Phase 7 (Layout Switches) covers
`category_layout`/`home_hero`/`product_gallery` as enumerated, server-chosen variants shared across
every preset, not a fourth axis of per-theme layout:

- **Atelier's masonry-style grid** with mixed image aspect ratios (4:5 default, occasional 1:1 and
  3:2), no card fill, and a "materials" line under each title.
- **Market's four-across dense grid**, quantity stepper on every card, unit pricing under the main
  price, category chips as a horizontally-scrolling pill row beneath the header.
- **Retro's decorative hero background** (see above) is also a layout/markup concern as much as a
  visual one.

These are recorded as backlog, not silently lost: if a future milestone wants per-theme layout
variance beyond the enumerated Phase 7 switches, that is a new architectural decision (reversing
the "per-theme component/markup overrides are rejected" Key Decision), not an incremental addition
to this contract.

## What extending the contract would touch

Unchanged from `.planning/todos/pending/theme-contract-dropped-properties.md`: adding any dropped
property as a 24th+ token touches `scripts/build-themes.mjs`'s `REQUIRED_TOKENS` list and validator
rules, every existing `themes/*.css` file, the Phase 5 sweep's component classes, and
`lib/themes/tokens.ts`'s `ThemeTokens` type. Treat any future want here as a new contract-widening
phase with its own sweep, not an incremental addition.

## Related

- `.planning/todos/pending/theme-contract-dropped-properties.md` — Phase 6's equivalent note for
  `luxe`/`midnight`; the two notes together cover all seven shipped presets' dropped properties.
