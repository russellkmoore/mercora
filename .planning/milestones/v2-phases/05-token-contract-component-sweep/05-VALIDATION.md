---
phase: "5"
slug: "token-contract-component-sweep"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-03"
updated: "2026-09-03"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.mts` — `include: ["tests/unit/**/*.test.ts"]`, `environment: "node"`, `@` aliases the repo root |
| **Quick run command** | `mise exec -- npm run test -- <pattern>` |
| **Full suite command** | `mise exec -- npm run test && mise exec -- npm run typecheck && mise exec -- npm run lint` |
| **Estimated runtime** | ~30s quick, ~3min full |
| **Visual regression** | `mise exec -- node scripts/screenshot-routes.mjs` (Playwright) — ❌ W0, created in plan 05-02 |
| **Completion gate** | `mise exec -- npm run scan:tokens` — ❌ W0, created in plan 05-01 |

Every project command is prefixed `mise exec --`; the project pins Node `>=24.18.1 <25` and the
system Node is a different major.

---

## Sampling Rate

- **After every task commit:** `mise exec -- npm run lint && mise exec -- npm run typecheck` plus the
  task's own scoped `scan:tokens` run.
- **After every plan (each plan is one branch, one PR per D-18):** full suite, plus the plan's
  screenshot capture compared against the `baseline` label from plan 05-02.
- **Before `/gsd-verify-work`:** full suite green, `mise exec -- npm run scan:tokens` exit 0 with a
  `0 violations` line and exactly two manual-review rows, and every route in `05-SCREENSHOTS.md`
  either compared or explicitly recorded as uncovered.
- **Max feedback latency:** ~30s for the scoped scan and lint; the screenshot compare is a
  per-plan gate, not a per-task one.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | TOKEN-03 | T-05-01-01 | Exclusions limited to the admin path; every other exception printed with a reason | CLI gate | `mise exec -- npm run scan:tokens; test $? -eq 1` | ❌ W0 (this task creates it) | ⬜ pending |
| 5-01-02 | 01 | 1 | TOKEN-03 | T-05-01-01 | Gate machine-proven fail-first against a known-bad fixture | unit | `mise exec -- npm run test -- scan-hardcoded-colors` | ❌ W0 (this task creates it) | ⬜ pending |
| 5-02-01 | 02 | 2 | TOKEN-05 | T-05-02-SC | Assumed-provenance packages verified by a human before install | checkpoint (blocking-human) | — (human gate) | n/a | ⬜ pending |
| 5-02-02 | 02 | 2 | TOKEN-05 | T-05-02-01, T-05-02-02 | Remote base URL refused without opt-in; output dir git-ignored | CLI gate | `git check-ignore -q .screenshots` | ❌ W0 (this task creates it) | ⬜ pending |
| 5-02-03 | 02 | 2 | TOKEN-05 | T-05-02-03 | Every coverage cell captured-with-hash or explicitly MISSING | CLI + human | `test "$(find .screenshots/baseline -name '*.png' \| wc -l)" -ge 12` | ❌ W0 | ⬜ pending |
| 5-03-00 | 03 | 3 | TOKEN-01 | — | One-way token values confirmed before the contract freezes | checkpoint (blocking-human) | — (human gate) | n/a | ⬜ pending |
| 5-03-01 | 03 | 3 | TOKEN-01, TOKEN-02 | T-05-03-03, T-05-03-04 | Theme properties reach the built CSS; `data-theme` present in server HTML | build + integration | `mise exec -- npm run build && grep -l 'bg-surface' .next/static/css/*.css` | ✅ | ⬜ pending |
| 5-03-02 | 03 | 3 | TOKEN-01 | T-05-03-01 | Token module free of env reads and server-only imports | unit | `mise exec -- npm run test -- token-contract` | ❌ W0 (this task creates it) | ⬜ pending |
| 5-03-03 | 03 | 3 | TOKEN-04, TOKEN-05 | T-05-03-02, T-05-03-05 | Only the theme env read removed; logo path unchanged | CLI + visual | `grep -rn 'NEXT_PUBLIC_THEME_PRIMARY' app components lib scripts tests docs \| wc -l` | ✅ | ⬜ pending |
| 5-04-01 | 04 | 4 | TOKEN-03 | T-05-04-01, T-05-04-02 | Invalid-state affordance restored on form controls | CLI gate | `mise exec -- npm run scan:tokens -- --path components/ui/button.tsx` | ✅ (after W0) | ⬜ pending |
| 5-04-02 | 04 | 4 | TOKEN-03 | T-05-04-01 | Whole primitive directory clean | CLI gate | `mise exec -- npm run scan:tokens -- --path components/ui` | ✅ | ⬜ pending |
| 5-04-03 | 04 | 4 | TOKEN-05 | T-05-04-03 | Newly-visible states attributed, not merely noted | visual + human | `node scripts/screenshot-routes.mjs --label chunk-2-ui …` | ✅ | ⬜ pending |
| 5-05-01 | 05 | 5 | TOKEN-03 | T-05-05-01 | Shell uses main-set tokens only | CLI gate | `mise exec -- npm run scan:tokens -- --path components/HeaderClient.tsx` | ✅ | ⬜ pending |
| 5-05-02 | 05 | 5 | TOKEN-03 | T-05-05-02, T-05-05-03 | Banner reaches all four status tokens; Clerk block untouched | CLI gate | `for t in success warning danger info; do grep -q -- "-$t" components/PromotionalBanner.tsx …` | ✅ | ⬜ pending |
| 5-05-03 | 05 | 5 | TOKEN-05 | T-05-05-01, T-05-05-04 | Both viewports compared; mobile header checked by hand | visual + human | `node scripts/screenshot-routes.mjs --label chunk-2-shell …` | ✅ | ⬜ pending |
| 5-06-01 | 06 | 6 | TOKEN-03 | T-05-06-01, T-05-06-03 | Badges mapped by meaning; blur placeholder left on the registry | CLI gate | `mise exec -- npm run scan:tokens -- --path app/category` | ✅ | ⬜ pending |
| 5-06-02 | 06 | 6 | TOKEN-03 | T-05-06-02 | Layout-class census unchanged | CLI gate | layout-class count diff against `git show HEAD:…ProductDisplay.tsx` | ✅ | ⬜ pending |
| 5-06-03 | 06 | 6 | TOKEN-05 | T-05-06-01 | Badge meaning, not just shade, compared | visual + human | `node scripts/screenshot-routes.mjs --label chunk-3-catalog …` | ✅ | ⬜ pending |
| 5-07-01 | 07 | 7 | TOKEN-03 | T-05-07-02, T-05-07-03 | SVG fill/stroke checked; form feedback reaches status tokens | CLI gate | `grep -cE '(fill\|stroke)="(#\|rgb\|hsl\|[a-z]+")' components/reviews/StarRating.tsx` | ✅ | ⬜ pending |
| 5-07-02 | 07 | 7 | TOKEN-03 | T-05-07-01 | Selected-plan affordance expressed with the primary token | CLI gate | `grep -cE '(border\|bg\|ring)-primary' …SubscriptionAcquisitionPanel.tsx` | ✅ | ⬜ pending |
| 5-07-03 | 07 | 7 | TOKEN-05 | T-05-07-01, T-05-07-02 | Three supplementary affordance cells captured | visual + human | `node scripts/screenshot-routes.mjs --label chunk-3-engagement …` | ✅ | ⬜ pending |
| 5-08-01 | 08 | 8 | TOKEN-03 | T-05-08-01 | Every CMS block a merchant page can compose is tokenised | CLI gate | `mise exec -- npm run scan:tokens -- --path components/pages` | ✅ | ⬜ pending |
| 5-08-02 | 08 | 8 | TOKEN-03 | T-05-08-01 | Blog surfaces share the story-body prose approach | CLI gate | `mise exec -- npm run scan:tokens -- --path app/blog` | ✅ | ⬜ pending |
| 5-08-03 | 08 | 8 | TOKEN-05 | T-05-08-02, T-05-08-03 | No cell recorded as compared without a real pre-state capture | visual + human | `node scripts/screenshot-routes.mjs --label chunk-3-content …` | ✅ | ⬜ pending |
| 5-09-01 | 09 | 9 | TOKEN-03 | T-05-09-01, T-05-09-04 | Cart panel stays light; motion classes unchanged | CLI gate | `grep -q 'bg-surface-inverse' components/cart/CartDrawer.tsx && …` | ✅ | ⬜ pending |
| 5-09-02 | 09 | 9 | TOKEN-03 | T-05-09-02, T-05-09-03 | All five inverse tokens consumed; nested dark chips stay main-set | CLI gate | five-token presence loop over `components/agent/AgentDrawer.tsx` | ✅ | ⬜ pending |
| 5-09-03 | 09 | 9 | TOKEN-05 | T-05-09-01 | Manifest states in words that polarity held | visual + human | `node scripts/screenshot-routes.mjs --label chunk-4-drawers …` | ✅ | ⬜ pending |
| 5-10-01 | 10 | 10 | TOKEN-03 | T-05-10-02, T-05-10-04 | Tokens reach Stripe via the server-computed provider; a11y rules intact | CLI gate | `grep -q 'useThemeTokens' lib/store/StoreConfigProvider.tsx && …` | ✅ | ⬜ pending |
| 5-10-02 | 10 | 10 | TOKEN-03 | T-05-10-01 | Success and danger are distinct tokens; sizing census unchanged | CLI gate | `mise exec -- npm run scan:tokens -- --path components/checkout` | ✅ | ⬜ pending |
| 5-10-03 | 10 | 10 | TOKEN-05 | T-05-10-01, T-05-10-04 | Stripe iframe checked by hand — no screenshot can introspect it | visual + human | `node scripts/screenshot-routes.mjs --label chunk-4-checkout …` | ✅ | ⬜ pending |
| 5-11-01 | 11 | 11 | TOKEN-03 | T-05-11-03 | Active-nav affordance survives; account states reach all four status tokens | CLI gate | `mise exec -- npm run scan:tokens -- --path components/account` | ✅ | ⬜ pending |
| 5-11-02 | 11 | 11 | TOKEN-03 | T-05-11-01, T-05-11-02 | Error page stays dark, imports the getter directly, loads no stylesheet | CLI gate | `grep -cE 'surfaceInverse\|onInverse\|borderInverse' app/global-error.tsx` | ✅ | ⬜ pending |
| 5-11-03 | 11 | 11 | TOKEN-05 | T-05-11-04, T-05-11-05 | Clerk keeps its dark base; captures stay on the local seed | visual + human | `node scripts/screenshot-routes.mjs --label chunk-5-account …` | ✅ | ⬜ pending |
| 5-12-01 | 12 | 12 | TOKEN-03 | T-05-12-01, T-05-12-04 | Escaping-call count unchanged across 85 substitutions | CLI gate | escaping-count diff against `git show HEAD:lib/utils/email.ts` | ✅ | ⬜ pending |
| 5-12-02 | 12 | 12 | TOKEN-03 | T-05-12-01, T-05-12-05 | Escaping intact in all five siblings; no `var(` in email HTML | CLI gate | per-file escaping-count loop | ✅ | ⬜ pending |
| 5-12-03 | 12 | 12 | TOKEN-01..05 | T-05-12-02, T-05-12-03 | Clean scan not bought with a silenced check; coverage record honest | CLI + human | `mise exec -- npm run scan:tokens` (exit 0, `0 violations`, 2 manual-review rows) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Nothing in this phase can be verified before these exist. Plans 05-01 and 05-02 build them, and
they are the reason those two plans run before the tracer.

- [ ] `scripts/scan-hardcoded-colors.mjs` + the `scan:tokens` npm script — the completion gate for TOKEN-03 (plan 05-01)
- [ ] `tests/fixtures/scan-tokens/{clean.tsx,dirty.tsx,sentinel.css,admin/hardcoded.tsx}` — known-bad and known-clean subjects (plan 05-01)
- [ ] `tests/unit/scripts/scan-hardcoded-colors.test.ts` — the fail-first proof of that gate (plan 05-01)
- [ ] `playwright` + `@playwright/test` devDependencies and the Chromium binary — no visual regression tooling exists in this repo today (plan 05-02, behind a blocking-human legitimacy checkpoint)
- [ ] `scripts/screenshot-routes.mjs` + the `screenshot:routes` npm script — covers TOKEN-02 and TOKEN-05 (plan 05-02)
- [ ] `.screenshots/` added to `.gitignore` (plan 05-02)
- [ ] `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` with the `baseline` capture — the fixed D-21 comparison target (plan 05-02)
- [ ] `tests/unit/lib/themes/token-contract.test.ts` — 23-key, CSS-parity, and no-hex-in-config assertions (plan 05-03)

`tests/unit/tailwind-config.test.ts` already exists but asserts a colour alias that plan 05-03
deletes; it is updated in the same task, not created.

---

## Manual-Only Verifications

Nine surfaces in this phase cannot be verified by a command. Under
`workflow.human_verify_mode = end-of-phase` these are `<verify><human-check>` blocks harvested
into the phase UAT rather than mid-flight checkpoints.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Baseline captures show real rendered pages | TOKEN-05 | A baseline of loading skeletons or blank viewports would make every later diff pass meaninglessly | Open two or three baseline PNGs at both viewports and confirm a fully rendered storefront |
| Chunk-1 relocation is a true visual no-op | TOKEN-02 | The whole mechanism moved; a hash comparison cannot say whether the result still looks right | Compare `chunk-1-contract` and `baseline` home captures side by side at both viewports |
| Newly-visible shadcn interaction states read as intentional | TOKEN-03 | This is the one chunk where "looks different" is correct, so it needs judgement | Click dropdowns and the nav menu, focus a field, hover a button |
| Mobile collapsed header | TOKEN-03 | A mobile-only class missed in a 491-line file will not show in a desktop screenshot | Resize a live browser through the breakpoint |
| Status badges still mean what they meant | TOKEN-03 | A shade change is fine; a meaning change is a bug, and only a human can tell them apart | Read stock badges on the product route against the baseline |
| Prose contrast in long-form copy | TOKEN-03 | Prose has the weakest automated coverage in the phase and is where a muted-foreground consolidation does the most quiet damage | Read a blog post and a CMS page at both viewports |
| Both drawers are still light panels | TOKEN-03 | Polarity is the failure this chunk exists to prevent; a hash diff does not say "still light" | Open the cart and agent drawers at both widths |
| Stripe payment form appearance | TOKEN-03 | Stripe renders in an iframe the screenshot harness cannot introspect | Walk checkout to payment, focus a field, enter a bad card, check mobile zoom |
| The standalone error page is still dark | TOKEN-03 | No screenshot in the grid renders this page; it only appears when the root layout fails | Throw in a server component and look at the fallback |
| Email dividers after the S10 darkening | TOKEN-03 | Two locked decisions collide on one token value; the consequence needs a judgement call | Compare pre- and post-sweep rendered email HTML side by side |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency — 118 `<automated>` commands across 12 plans, each with a `<fails_when>` sibling
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 5s — **not met.** The scoped scan and lint run ~30s and the per-plan screenshot compare runs minutes. This is inherent to a visual-regression phase; the fast inner loop is the scoped `scan:tokens` run, and the screenshot compare is a per-plan gate by design (D-18, one branch and one PR per chunk).
- [ ] `nyquist_compliant: true` — pending Wave 0 completion (plans 05-01 and 05-02)

**Approval:** pending
