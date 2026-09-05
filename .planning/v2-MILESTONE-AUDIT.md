---
milestone: v2
audited: 2026-09-05T17:28:13Z
status: tech_debt
scores:
  requirements: 17/17
  phases: 5/5
  integration: 12/12
  flows: 6/6
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 05-token-contract-component-sweep
    items:
      - "Screenshot coverage gaps carried across the milestone: order-status (no seeded local order), Stripe payment step (payment-intent 400 locally), authenticated account dashboard and review-form error state (no Clerk session) — verified by code read and scoped scan only; human-accepted at each phase close"
      - "Two image-URL resolvers coexist (components/layout/product/gallery-media-url.ts verbatim from ProductDisplay vs lib/utils/product-image.ts); consolidate when the product display is next touched"
  - phase: 06-theme-file-mechanism-presets
    items:
      - "Emails (6 builders) and app/global-error.tsx call getThemeTokens() with no argument and always render the manifest default (volt-dark), not the admin-selected theme — a documented decision (D-09/D-11), but a visible inconsistency once a light preset is active; decide whether emails should follow the active theme in a later milestone"
      - "NEXT_PUBLIC_THEME_DEFAULT must be added as a Cloudflare Workers Build variable before the next deploy (operator action)"
      - "Admin Appearance page (ThemePresetGrid) never walked through in a real browser with a Clerk admin session; mechanism proven by dev-bypass probes and render tests (WINDOWS #2)"
  - phase: 06.1-remaining-presets-clinical-retro-atelier-market
    items:
      - "Direction-doc properties outside the 23-token contract (shadow, border-width, image-aspect, accent-2, mono font, hover/decorative treatments) deferred — .planning/todos/pending/theme-direction-doc-backlog-06.1.md and theme-contract-dropped-properties.md"
      - "border-inverse serves both drawer edges and email dividers; split only if a preset's email dividers read badly"
  - phase: 07-layout-switches
    items:
      - "LayoutSwitches admin island never walked through with a Clerk session (same carry-over as the theme grid)"
      - "Defaults-parity residual: product|390|resting differs by 2 pixels at 1/255 intensity, judged headless-Chromium rendering noise (S-07-01, WINDOWS #4, human-accepted)"
      - "Pre-extraction parity tests self-write a missing baseline snapshot; snapshots are committed, but a deleted snapshot would silently regenerate"
      - "getLayoutSettings() performs a second D1 read of the appearance category per page render (accepted; no request-scoped cache by design)"
  - phase: 08-documentation-visual-qa-close-out
    items:
      - "npm run scan:tokens is not wired into CI (only build-themes --check is); documented follow-up in docs/theming.md §Known limits"
      - "QA matrix judged via a stated factorisation of the six criteria (46 judgements over 672 cells), not exhaustive per-cell inspection; the UI-SPEC a11y screen-reader row remains open"
      - "Settings GET seed fallback catch{} swallows non-conflict errors without logging (08-REVIEW IN-02)"
nyquist:
  compliant_phases: []
  partial_phases: []
  not_validated_phases: ["05", "06", "06.1", "07", "08"]
  missing_phases: []
  overall: not_validated
---

# Milestone v2 — Themeable Storefront — Audit

**Audited:** 2026-09-05T17:28:13Z · **Status:** tech_debt (no blockers; deferred items need review)

## Requirements

| REQ-ID | Phase | VERIFICATION | SUMMARY claims | REQUIREMENTS.md | Final |
|--------|-------|--------------|----------------|-----------------|-------|
| TOKEN-01 | 5 | passed | 05-03, 05-12 | [x] Complete | satisfied |
| TOKEN-02 | 5 | passed | 05-03, 05-12 | [x] Complete | satisfied |
| TOKEN-03 | 5 | passed | 05-01, 05-04…05-12 | [x] Complete | satisfied |
| TOKEN-04 | 5 | passed | 05-03, 05-12 | [x] Complete | satisfied |
| TOKEN-05 | 5 | passed (1 behavior-unverified, human-accepted) | 05-02, 05-04…05-12 | [x] Complete | satisfied — three routes never screenshotted (env-limited) |
| THEME-01 | 6 | passed | 06-01 | [x] Complete | satisfied |
| THEME-02 | 6 | passed | 06-02 | [x] Complete | satisfied — tail parity list is critical-only; accepted reading |
| THEME-03 | 6 | passed (human-accepted) | 06-04 | [x] Complete | satisfied — live walkthrough outstanding |
| THEME-04 | 6 | passed | 06-03, 06-05 | [x] Complete | satisfied |
| THEME-05 | 6.1 | passed | 06.1-01/02/04 | [x] Complete | satisfied |
| LAYOUT-01 | 7 | passed | 07-05 | [x] Complete | satisfied |
| LAYOUT-02 | 7 | passed | 07-05 | [x] Complete | satisfied |
| LAYOUT-03 | 7 | passed | 07-05 | [x] Complete | satisfied |
| LAYOUT-04 | 7 | passed | 07-05 | [x] Complete | satisfied — repo-wide contract test 49/49 |
| DOCS-01 | 8 | passed | (marked by 08-02) | [x] Complete | satisfied — verifier checked theming.md/CLAUDE.md directly |
| DOCS-02 | 8 | passed | 08-03, 08-04 | [x] Complete | satisfied |
| DOCS-03 | 8 | passed | 08-05 | [x] Complete | satisfied |

No orphaned requirements: every v2 REQ-ID appears in at least one phase VERIFICATION.md.

## Phases

| Phase | Plans | VERIFICATION | Score | Code review |
|-------|-------|--------------|-------|-------------|
| 5 Token Contract & Component Sweep | 12/12 | passed | 8/9 (human-accepted) | fixed (1 critical, 2 warnings) |
| 6 Theme File Mechanism & Presets | 5/5 | passed | 15/17 (human-accepted) | clean after fixes |
| 6.1 Remaining Presets (inserted) | 4/4 | passed | 5/5 | clean after fixes |
| 7 Layout Switches | 5/5 | passed | 4/4 criteria, 62 truths | info only after fixes |
| 8 Documentation & Visual QA Close-out | 5/5 | passed | 9/9 after gap closure | info only after fixes |

## Integration (gsd-integration-checker, live re-run)

12/12 integration points WIRED; 6/6 E2E flows COMPLETE. Gates re-run live: scan:tokens 0, build-themes --check fresh (7 themes), typecheck clean, vitest 260 files / 2139 tests. Full report in the integration checker's findings; key items reproduced under tech debt above.

## Nyquist

All five VALIDATION.md files are `status: draft` (seeded by plan-phase, never reconciled by validate-phase) — a coverage TODO, not a compliance failure. Every plan carried its own automated `<verify>`/`<fails_when>` pairs and every phase closed on a green gate suite. Run `/gsd-validate-phase <N>` per phase to promote.

## Tech Debt Summary

14 items across 5 phases (see frontmatter). None blocks the milestone. The one worth a conscious product call: emails and the crash page always use the default theme, not the admin-selected one.
