---
title: Direction-document theme properties dropped by the frozen 23-token contract
created: 2026-09-04
resolves_phase: null
source: 06-UI-SPEC.md D-03 (Phase 6 plan 03)
---

# Properties `docs/voltique-theme-direction.md` wants that the contract does not carry

`docs/voltique-theme-direction.md`'s six pre-packaged theme specs (Luxe, Midnight, Clinical,
Retro, Atelier, Market) each name several visual properties beyond the frozen 23-token contract
(`.planning/phases/05-token-contract-component-sweep/05-TOKEN-MAP.md` §1, one-way frozen per
Phase 5 D-01). Per Phase 6 D-03, none of these are added as tokens — the contract is not
extended to accommodate a preset. When authoring `themes/luxe.css` and `themes/midnight.css`
(Phase 6 plan 03), six properties were dropped outright, two of them folded into an existing
token slot instead of lost entirely.

## Dropped properties (not tokens, not expressible today)

- **`shadow`** — both Luxe (`shadow: none`) and Midnight (`0 8px 30px oklch(0% 0 0 / .45)`)
  specify a shadow treatment. Shadows stay Tailwind defaults across all presets (Phase 6 D-04);
  no shadow token exists.
- **`border-width`** — both presets specify `1px`. The contract has no width token; theme files
  cannot vary border thickness, only colour (`border`/`border-inverse`).
- **`image-aspect`** — Luxe wants `3 / 4` (portrait), Midnight wants `16 / 9`. This is a layout
  concern, not a colour/type token — Phase 7 (layout switches) territory, not this contract.
- **`accent-2`** (a second accent colour) — Luxe has none; Midnight's is `oklch(75% .15 200)`
  cyan. See "Folded into an existing token" below for where Midnight's hue went.
- **`font-mono`** — Midnight specifies Geist Mono for spec-row numerals. Not part of the
  contract's two font tokens (`font-sans`, `font-display`).
- **`letter-spacing`** — Midnight's `font-display` direction calls for `letter-spacing: -.02em`
  distinct from `font-body`. Not expressible; both font tokens in Midnight fall back to the same
  Geist stack because there is no separate face or spacing token to carry the distinction.

## Folded into an existing token rather than lost

- **Midnight's `accent-2` cyan → `--store-info`.** The direction doc pairs a violet `accent`
  with a cyan `accent-2` as a secondary status/badge colour. Since `info`'s role already
  overlaps that secondary-status intent and D-03 forbids adding a token, Midnight's `info` token
  (`#00c9d3`) carries the doc's cyan hue directly (`oklch(75% .15 200)`).
- **Luxe's `surface-sunken` → `--store-border`.** The direction doc's third surface tier
  (`oklch(93% .012 80)`, described as backing "hairline dividers instead of borders") has no
  main-set slot in the contract. Luxe's `border` token (`#ece7df`) carries that value directly,
  since the role — a hairline divider tone — is exactly what `border` is for on a light surface.

## What extending the contract would touch

Recorded here rather than attempted: adding any of the six dropped properties as a 24th+ token
would touch `scripts/build-themes.mjs`'s `REQUIRED_TOKENS` list and validator rules, every
existing `themes/*.css` file (each would need the new token added to stay valid), the Phase 5
sweep's component classes (a new Tailwind class stem per token), and `lib/themes/tokens.ts`'s
`ThemeTokens` type. This is deliberately out of scope for this milestone; if a future milestone
wants shadow/border-width/image-aspect/accent-2/font-mono/letter-spacing as real tokens, treat it
as a new contract-widening phase with its own sweep, not an incremental addition.

## Related

- `.planning/todos/pending/theme-metadata-industry-synopsis-admin.md` — resolved by this same
  phase (Phase 6 plan 03 adds the `@theme label:` header metadata mechanism this todo asked for;
  the admin card rendering itself is plan 06-04).
