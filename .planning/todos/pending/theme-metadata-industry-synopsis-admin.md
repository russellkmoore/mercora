---
title: Theme metadata (industry + synopsis) surfaced in admin Appearance
created: 2026-09-03
resolves_phase: 6
source: user note during Phase 5 execution
audit_acknowledged:
  milestone: v2
  at: 2026-09-06
---

# Theme metadata: target industry + synopsis, shown in admin

Russell wrote the retired theme-direction spec (removed 2026-09-05; its per-theme values live in each `themes/*.css` header) — six go-live preset themes (Luxe, …),
each with a target industry, a short synopsis, design direction, and a full oklch
color/token spec. He wants the industry and synopsis visible in the admin Appearance
section next to each theme's swatch card.

## Proposed shape (for Phase 6 planning)

- Each `themes/<name>.css` carries a metadata header comment block, e.g.
  `/* @theme name: Luxe | industry: fashion, jewelry, watches | synopsis: ... */`
  (or a small `@theme-meta { }` custom block), parsed by the Phase 6 prebuild
  theme scanner into the theme manifest.
- Admin Appearance swatch cards (THEME-03) render `industry` and `synopsis` from
  the manifest — no second source of truth.
- Validator should require `name`; `industry`/`synopsis` optional but recommended.

## Notes

- The doc's token names (`surface`, `ink`, `accent`, `font-display`, `radius`, …)
  do NOT match the frozen Phase 5 contract (23 tokens, see 05-TOKEN-MAP.md). Phase 6
  needs a rename mapping when turning these specs into theme files. Fonts, radius,
  shadow, and image-aspect are not part of the Phase 5 colour contract — decide in
  Phase 6 whether they extend the contract or stay out of scope.
- the retired theme-direction spec (removed 2026-09-05; its per-theme values live in each `themes/*.css` header) is currently untracked; commit it when Phase 6 planning starts.
