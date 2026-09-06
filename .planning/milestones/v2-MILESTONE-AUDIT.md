---
milestone: v2
audited: 2026-09-05T20:10:00Z
status: tech_debt
scores:
  requirements: 20/20
  phases: 7/7
  integration: 12/12
  flows: 7/7
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 05-token-contract-component-sweep
    items:
      - "Screenshot coverage: Stripe payment step (payment-intent 400 locally) and the two Clerk-session routes (account dashboard, review-form error state) verified by code read and scoped scan only — OPEN, environment-limited; order-status gap closed at 08.1-07"
  - phase: 06-theme-file-mechanism-presets
    items:
      - "Admin Appearance page (ThemePresetGrid) never walked through in a real browser with a Clerk admin session; mechanism proven by dev-bypass probes and render tests — OPEN, user-owned"
  - phase: 06.1-remaining-presets-clinical-retro-atelier-market
    items:
      - "Direction-doc properties outside the 23-token contract (shadow, border-width, image-aspect, accent-2, mono font, hover/decorative treatments) — DEFERRED to backlog: .planning/todos/pending/theme-direction-doc-backlog-06.1.md, theme-contract-dropped-properties.md"
      - "border-inverse serves both drawer edges and email dividers; split only if a preset's email dividers read badly — OPEN by design, no trigger observed"
  - phase: 07-layout-switches
    items:
      - "LayoutSwitches admin island never walked through with a Clerk session — OPEN, user-owned (same walkthrough as the theme grid)"
      - "Defaults-parity residual: product|390|resting differs by 2 pixels at 1/255 intensity, headless-Chromium noise — ACCEPTED residual"
  - phase: 08-documentation-visual-qa-close-out
    items:
      - "UI-SPEC a11y screen-reader row of the QA matrix not exercised — OPEN, needs a screen reader session"
  - phase: 08.2-documentation-overhaul-agent-onboarding
    items:
      - "npm run docs:lint is a local gate, not in .github/workflows/ci.yml — recorded follow-up (one workflow step)"
      - "Fresh-clone AGENTS.md dry run with a coding assistant not performed — OPEN, user-owned"
      - "npm run dev leaving AGENTS.md unchanged (Next-generated block byte-match) proven only against the generator source, not a live run — OPEN, user-owned"
      - "Themed demo deployments — DEFERRED: .planning/todos/pending/themed-demo-deployments.md"
nyquist:
  compliant_phases: ["08.1", "08.2"]
  partial_phases: []
  not_validated_phases: ["05", "06", "06.1", "07", "08"]
  missing_phases: []
  overall: partial
---

# Milestone v2 — Themeable Storefront — Audit (re-run after Phases 8.1 and 8.2)

**Status:** tech_debt — every requirement satisfied, no blockers, 12 open items all environment-limited, explicitly deferred, or user-owned.

Previous audit (2026-09-05T17:28Z) found 17/17 requirements and 14 tech-debt items. Phase 8.1 closed 7 of them in code and the operator closed 1 (Workers Build variable). Phase 8.2 added DOCS-04/DOCS-05 and DEBT-01 landed with 8.1.

## Requirements (3-source cross-reference)

| Requirement | Phase | VERIFICATION | SUMMARY frontmatter | REQUIREMENTS.md | Final |
|-------------|-------|--------------|---------------------|-----------------|-------|
| TOKEN-01..05 | 5 | passed (8/9, 1 human-accepted) | 05-03, 05-12 (+05-01/02/04..11) | [x] Complete | satisfied |
| THEME-01..04 | 6 | passed (15/17, 2 human-accepted) | 06-01..05 | [x] Complete | satisfied |
| THEME-05 | 6.1 | passed (5/5) | 06.1-01, 02, 04 | [x] Complete | satisfied |
| LAYOUT-01..04 | 7 | passed (4/4) | 07-05 | [x] Complete | satisfied |
| DOCS-01..03 | 8 | passed (9/9) | 08-03, 04, 05 (DOCS-01 via 08-VERIFICATION table) | [x] Complete | satisfied |
| DEBT-01 | 8.1 | passed (12/12) | 08.1-01..07 | [x] Complete | satisfied |
| DOCS-04 | 8.2 | passed after gap closure (ce218ac) | 08.2-01, 02, 03, 05, 06 | [x] Complete | satisfied |
| DOCS-05 | 8.2 | passed after gap closure (ce218ac) | 08.2-04, 06 | [x] Complete | satisfied |

Orphans: none. Every traceability-table ID appears in at least one VERIFICATION.md.

## Phases

| Phase | Plans | VERIFICATION | Code review | VALIDATION |
|-------|-------|--------------|-------------|------------|
| 05 token contract + component sweep | 12/12 | passed | fixed | draft (pre-#2117 file; run validate-phase to reconcile) |
| 06 theme mechanism + presets | 5/5 | passed | fixed | draft |
| 06.1 remaining presets | 4/4 | passed | fixed | draft |
| 07 layout switches | 5/5 | passed | fixed | draft |
| 08 docs + visual QA close-out | 5/5 | passed | fixed | draft |
| 08.1 tech-debt closure | 7/7 | passed | fixed | validated, nyquist_compliant |
| 08.2 docs overhaul + agent onboarding | 6/6 | passed (2 gaps closed inline) | 1 Critical + 2 Warning + 1 Info, all fixed (7cfeb3e) | validated, nyquist_compliant |

## Integration (12/12 wired, 7/7 flows)

Re-verified by the integration checker on 2026-09-05 after 8.1/8.2:

1. Theme file → `scripts/build-themes.mjs` → `lib/themes/manifest.generated.ts` → `getActiveTheme()` → `<html>` classes → components.
2. Admin preset pick → D1 appearance category → next render, via the shared `readAppearanceSettings()` reader (`lib/themes/appearance-read.ts`) used by both `getActiveTheme()` and `getLayoutSettings()`.
3. Admin layout switch → `getLayoutSettings()` → named variant in `app/page.tsx`, category and product pages.
4. Order → effect staged with `{themeName}` in `order_effects.payload` (migration 0023) → cron drain renders email with `emailThemeForStagedPayload`; request-path senders (6 files) use `resolveEmailTheme()`.
5. Crash page (`app/global-error.tsx`) → `GET /api/theme` (force-dynamic, manifest-validated) → repaint.
6. CI chain (`.github/workflows/ci.yml`) matches the gate lists in AGENTS.md and CONTRIBUTING.md; `docs:lint` intentionally local only.
7. Docs invariants: manifest path set == `docs/` tree (20 = 20); four locked ADRs `locked: true`; AGENTS.md Next block byte-matches the generator; `npm run docs:lint` 0 violations.

No regressions against the prior audit.

## Tech debt (12 open items)

See frontmatter. Grouping:

- **Needs a real Clerk admin session in a browser (user-owned):** Appearance page walkthrough, LayoutSwitches walkthrough, two Clerk-gated screenshot routes.
- **Needs local Stripe:** payment-step screenshot.
- **Needs a person:** AGENTS.md fresh-clone dry run, `npm run dev` AGENTS.md byte-match, a11y screen-reader row.
- **Explicitly deferred to backlog:** direction-doc dropped properties, themed demo deployments.
- **Accepted by design:** border-inverse dual use, 2-pixel parity residual.
- **One-line follow-up:** add `npm run docs:lint` to CI.

## Nyquist

Phases 08.1 and 08.2 are validated and compliant. Phases 05–08 have VALIDATION.md files written before the `status` field existed (`status: draft`); this is a coverage TODO (`/gsd-validate-phase N`), not a compliance failure.
