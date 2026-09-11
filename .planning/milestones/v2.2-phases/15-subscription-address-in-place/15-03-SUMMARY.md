---
phase: 15-subscription-address-in-place
plan: 03
subsystem: subscriptions
tags: [ci-gates, deploy, cloudflare-workers-builds, verification]

# Dependency graph
requires:
  - phase: 15-subscription-address-in-place plan 01
    provides: "components/account/AddressForm.tsx, lib/account/address-client.ts#saveAddress"
  - phase: 15-subscription-address-in-place plan 02
    provides: "components/subscriptions/AddAddressDialog.tsx, acquisition-client.ts#nextAddressSelection, panel wiring"
provides:
  - "Phase 15 closed: gate suite green, phase-scope proven mostly by diff (one documented exception), deployed to production, requirements SUB-01/02/03 marked complete"
affects: [any future phase touching components/subscriptions/, components/account/, or lib/subscriptions/address-limits.ts]

# Actuals (#2632)
actuals:
  tokens: 9000
  tasks: 3
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-close verification pattern: full CI-mirroring gate chain plus targeted git-diff scope assertions over the phase's base commit, run once on the exact tree that gets pushed."

key-files:
  created: []
  modified: []

key-decisions:
  - "The Task 1 scope assertion for app/api is not literally an empty diff: app/api/setup-intent/route.ts changed 2 lines during the iteration-2 review-fix (CR-01), importing the shared ADDRESS_CITY_REGION_MAX constant instead of a hardcoded 128 cap. This was already committed and gated before this plan started. Verified directly (see Deviations) that the change is a validation-bound value only -- no new endpoint, no auth/authz change -- so T-15-06's actual mitigation target (elevation of privilege) is not implicated. Documented rather than reverted, since reverting would reintroduce the three-way inconsistency bug CR-01 fixed."

patterns-established: []

requirements-completed: [SUB-01, SUB-02, SUB-03]

coverage:
  - id: D1
    description: "SUB-01: shipping-address select always offers 'Add a new address...' (including on an empty list, disabled only while loading), and the navigating 'Manage addresses' link is gone."
    requirement: SUB-01
    verification:
      - kind: unit
        ref: "tests/unit/components/subscriptions/product-acquisition-source.test.ts#uses Clerk and Stripe Elements without persisting or logging provider secrets (SUB-01 assertions block)"
        status: pass
    human_judgment: true
    rationale: "Source-contract test proves the JSX/logic shape (no jsdom in this repo's vitest config to render and click through it); actual dropdown behavior on an empty address list needs a human look."
  - id: D2
    description: "SUB-02: one shared AddressForm component (no second field list), saving through the existing account addresses API via saveAddress."
    requirement: SUB-02
    verification:
      - kind: unit
        ref: "tests/unit/components/account/address-form-source.test.ts#SUB-02 source contract: one shared address form, one save path (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SUB-03: after a successful save the modal closes, the list refreshes, the new address is pre-selected, plan/quantity/terms state survive, API errors show inside the modal, and Escape/Cancel restore the previous selection."
    requirement: SUB-03
    verification:
      - kind: unit
        ref: "tests/unit/components/subscriptions/product-acquisition-source.test.ts#uses Clerk and Stripe Elements without persisting or logging provider secrets (SUB-03 address-save-region assertions)"
        status: pass
      - kind: unit
        ref: "tests/unit/components/subscriptions/acquisition-client.test.ts#nextAddressSelection (6 cases) and a saved address near the city/region bound round-trips through select and setup-intent (1 case)"
        status: pass
    human_judgment: true
    rationale: "The modal-close/pre-select/reset sequence and the real save round-trip through Stripe SetupIntent finalization can only be exercised end to end by a human in a browser; this repo's unit suite has no jsdom, so nothing renders the modal or drives a real click/save."
  - id: D4
    description: "Full CI-mirroring gate suite green on the exact tree pushed, and five of six phase-scope diff assertions are empty (package.json/package-lock.json, migrations/, wrangler.jsonc/cloudflare-env.d.ts, app/account/addresses/page.tsx, components/checkout/)."
    requirement: SUB-01
    verification:
      - kind: other
        ref: "npm audit / build:themes:check / scan:tokens / lint / typecheck / npm test / test:workers / test:observability-worker / npm run build (see Gate Evidence)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Deployed to production via git push origin main (Cloudflare Workers Builds); the subscription product page's asset fingerprint changed and it still returns 200 anonymously."
    requirement: SUB-01
    verification:
      - kind: other
        ref: "curl asset-fingerprint poll against https://voltique.russellkmoore.me/product/field-ration-resupply, see Deploy Evidence"
        status: pass
    human_judgment: false

# Metrics
duration: 21min
completed: 2026-09-11
status: complete
---

# Phase 15 Plan 3: Gate, Deploy, and Close Summary

**Full CI-mirroring gate suite green (2783+249+3 tests, lint/typecheck/build clean), pushed to `main`, deployed to production via Cloudflare Workers Builds (asset fingerprint `bcdc6e960bbd` to `b95c9d190804`), SUB-01/02/03 marked complete, and one documented scope-assertion exception in `app/api/setup-intent/route.ts` (a review-time bugfix, not new work by this plan).**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-11T07:35:00Z (approx.)
- **Completed:** 2026-09-11T07:57:06Z
- **Tasks:** 3
- **Files modified:** 0 source files (this plan modifies no source file, per its own scope); `.planning/REQUIREMENTS.md` updated to mark SUB-01/02/03 complete.

## Accomplishments
- Ran the full CI-mirroring gate chain (audit, theme-build check, token scan, lint, typecheck, unit tests, Worker tests, observability-Worker tests, `next build`) on the phase's final tree — all green.
- Proved five of the six phase-scope claims by empty diff over `635cb28..HEAD`; the sixth (`app/api`) is not empty and is fully accounted for below rather than patched over.
- Pushed `main` (`9de5e5a..dc2a6ff`, fast-forward), triggering Cloudflare Workers Builds; confirmed the new build went live by a changed static-asset fingerprint and a continued anonymous 200 on the subscription product page.
- Mapped SUB-01, SUB-02, SUB-03 each to a named test and marked them complete in `.planning/REQUIREMENTS.md`.

## Task Commits

This plan modifies no source file (per its own `<artifacts>` contract) and produces no per-task code commit. `.planning/REQUIREMENTS.md` was updated via `gsd-tools query requirements.mark-complete` as part of Task 3's phase-close record, folded into the plan-metadata commit below rather than a separate task commit (there is no task-scoped source change to isolate it from).

**Plan metadata:** committed together with this SUMMARY (see hash in the orchestrator's completion report) — `.planning/phases/15-subscription-address-in-place/15-03-SUMMARY.md`, `.planning/REQUIREMENTS.md`.

_Note: `.planning/STATE.md` and `.planning/ROADMAP.md` are intentionally NOT included — the orchestrator owns those writes for this run._

## Gate Evidence (Task 1)

All commands run under the pinned Node version (`mise exec --`, resolved to `v24.18.1`) on the exact tree that was pushed in Task 2, from the repo root.

| Gate | Command | Result |
|---|---|---|
| Dependency audit | `npm audit --omit=dev --audit-level=high` | `found 0 vulnerabilities` — pass |
| Theme build check | `npm run build:themes:check` | pass |
| Token scan | `npm run scan:tokens` | 0 violations — pass |
| Lint | `npm run lint` | `0 errors, 52 warnings` — all pre-existing, none in a phase-15 file — pass |
| Typecheck | `npm run typecheck` | clean — pass |
| Unit tests | `mise exec -- npm test` | `Test Files 308 passed (308)`, `Tests 2783 passed (2783)` — pass |
| Worker tests | `npm run test:workers` | `Test Files 31 passed (31)`, `Tests 249 passed (249)` — pass |
| Observability-Worker tests | `npm run test:observability-worker` | `Test Files 1 passed (1)`, `Tests 3 passed (3)` — pass |
| Build | `npm run build` | Next.js production build completed, all routes listed, no errors — pass |

`check:migrations` was correctly skipped: it is pull-request-only per `AGENTS.md`, and this phase adds no migration file (confirmed by the `migrations/` scope assertion below). `cf-typecheck` was not re-run as a separate command; the binding/env-surface diff assertion below (`wrangler.jsonc`, `cloudflare-env.d.ts` both empty-diff) is the stronger statement the plan calls for, and the orchestrator had already run `cf-typecheck` and `npm run build` successfully at this HEAD before dispatching this plan.

### Phase-scope diff assertions (`635cb28..HEAD`)

| Path | Diff | Result |
|---|---|---|
| `package.json` | empty | pass — no dependency installed this phase (T-15-SC) |
| `package-lock.json` | empty | pass — confirms the above |
| `app/api/**` | **2 lines changed in `app/api/setup-intent/route.ts`** | **exception — see below** |
| `migrations/` | empty | pass — expand-only policy not engaged |
| `wrangler.jsonc` | empty | pass — no binding/var/secret surface moved |
| `cloudflare-env.d.ts` | empty | pass — confirms the above |
| `app/account/addresses/page.tsx` | empty | pass (D-01) |
| `components/checkout/` | empty | pass — guest checkout shipping form untouched |

**The `app/api` exception, in full.** `app/api/setup-intent/route.ts`'s `parseAddress` function changed two lines: `boundedText(value.city, 128)` to `boundedText(value.city, ADDRESS_CITY_REGION_MAX)`, and `optional("region", 128)` to `optional("region", ADDRESS_CITY_REGION_MAX)`, plus the new import. This landed in commit `84b21af` (`fix(15): CR-01 raise setup-intent route's city/region cap to 200 to match the other two layers`), part of the iteration-2 code-review-fix pass that ran *before* this plan was dispatched — it is not new work produced by this plan. `git diff 635cb28..HEAD -- app/api/setup-intent/route.ts | grep -E '^\+|^-'` (excluding the import line and the two `+++`/`---` header lines) shows exactly those two value substitutions and nothing else — no route added, no auth/authz/same-origin check touched, no request shape changed. T-15-06's actual mitigation target ("no authorisation or same-origin guard changed") is verifiably still true. The plan's Task 1 wording assumed no `app/api` diff at all when it was written, before wave 2's own code review discovered CR-01 (a real three-way inconsistency bug: the client filter and the acquisition service had already been raised to 200 in iteration 1's WR-05, but this route's own copy of the same bound was missed, so a 129-200 char city/region was selectable and pre-selected in the UI but rejected at "Continue to payment method"). Reverting this line to restore an empty diff would reintroduce that bug. This is reported, not patched over, per the plan's own instruction.

## Deploy Evidence (Task 2)

- **Pushed commit:** `dc2a6ff4d5b1498a4bd0e8fca56ff2503e305b4e` (`docs(15): review-fix report iteration 2`)
- **Push result:** `git push origin main` — fast-forward `9de5e5a..dc2a6ff` (accepted, not rejected)
- **Pre-deploy fingerprint:** `bcdc6e960bbd` (asset-path hash), page returned `200` before the push
- **Post-deploy fingerprint:** `b95c9d190804` — changed, confirming the new build went live
- **Elapsed:** 185 seconds from push to observed fingerprint change (well under the 20-minute budget)
- **Final status check:** `200` on `https://voltique.russellkmoore.me/product/field-ration-resupply`, anonymous `GET`, no cookie/auth header
- **Deployment record (`npx wrangler deployments list --name mercora`):** newest entry created `2026-09-11T07:55:54.448Z`, immediately following the push, confirming Cloudflare Workers Builds picked it up.
- No write of any kind was made against production. Every request in this task was a `GET`.

Per the plan's own note: the shipping-address select is client-rendered inside a signed-in branch, so this anonymous check proves reachability and a successful deploy only — it does not and cannot prove the select's new option exists. That is what the human-check list below is for.

## Requirement Proof Table

| Requirement | Proof | Test file / assertion |
|---|---|---|
| SUB-01 | Select always offers "Add a new address…" (`ADD_NEW_ADDRESS_VALUE`), disabled only while loading (`disabled={loadingAddresses}`, not on empty list), "Manage addresses" link and `/account/addresses` removed | `tests/unit/components/subscriptions/product-acquisition-source.test.ts` — `uses Clerk and Stripe Elements without persisting or logging provider secrets` (SUB-01 block, lines ~40-53) |
| SUB-02 | One shared `AddressForm` component, no second field list, `saveAddress` is the only save path to the existing account addresses API | `tests/unit/components/account/address-form-source.test.ts` — `describe("SUB-02 source contract: one shared address form, one save path")` (5 `it`s: field rendering, no duplicate field list, single save path, same-origin save, ARIA roles) |
| SUB-03 | Post-save: `setSetup(null)`, `setCheckoutError("")`, `setCompletedOwner(null)` before the refresh awaits; `nextAddressSelection(next, saved.id)` pre-selects; a saved-but-filtered address is reported not silently dropped; abortable refresh; owner-change resets the dialog; keyboard-traversal guard never writes the sentinel to `addressId` | `tests/unit/components/subscriptions/product-acquisition-source.test.ts` — SUB-03 `address-save-region` assertions (same `it` block as SUB-01, lines ~54-90); `tests/unit/components/subscriptions/acquisition-client.test.ts` — `describe("nextAddressSelection")` (6 cases) and `describe("a saved address near the city/region bound round-trips through select and setup-intent")` |

## Files Created/Modified
- `.planning/REQUIREMENTS.md` — SUB-01/02/03 checkboxes and traceability table rows marked Complete via `gsd-tools query requirements.mark-complete`.
- `.planning/phases/15-subscription-address-in-place/15-03-SUMMARY.md` — this file.

No component, library, or test source file was modified by this plan.

## Decisions Made

Wave-2 discretion choices, settled under Claude's judgment per `15-CONTEXT.md`'s "Claude's Discretion" note, recorded here per Task 3's instruction so a later reader does not have to re-derive them from source:

- **Placeholder option text:** `"Select an address"` when the shopper has saved addresses; `"Add an address to continue"` when the list is empty. Kept as two literal strings rather than one conditional sentence so the SUB-01 source contract can pin both.
- **Add-option label:** `"Add a new address…"` (with the ellipsis character, matching the convention of an option that opens a further UI, not a direct action).
- **Modal title:** `"Add a shipping address"`.
- **Modal description:** `"This address is saved to your account and selected for this subscription."`
- **`type` select visibility when `lockType` is set:** hidden, value forced (the recommended option in `15-CONTEXT.md`) — `AddressForm` never renders the address-type select when `lockType='shipping'` is passed, matching `AddAddressDialog`'s use.

## D-07 Scoping Note (restated per Task 3)

Plan 15-01's D-07 "no second copy of the field list" source contract was narrowed, on the plan's own correction, from "across `components/`" to "across `components/account/` and `components/subscriptions/` only." `components/checkout/ShippingForm.tsx` — the guest checkout shipping form — is a separate, props-driven component outside this phase's boundary and was never meant to be consolidated into `AddressForm`. Task 1's scope assertion (`components/checkout/` empty diff over `635cb28..HEAD`) confirms it was not touched anywhere in the phase.

## Deviations from Plan

### Auto-fixed Issues

None — this plan makes no code change; there was nothing for it to auto-fix.

### Reported, Not Patched

**1. [Scope assertion exception] `app/api/setup-intent/route.ts` is not an empty diff over the phase range**
- **Found during:** Task 1 (phase-scope diff assertions)
- **Issue:** The plan's Task 1 verify command asserts `git diff --quiet 635cb28..HEAD -- ... app/api ...`, expecting an empty diff. It is not empty: `app/api/setup-intent/route.ts` changed 2 value substitutions (`128` to `ADDRESS_CITY_REGION_MAX`) plus an import line.
- **Root cause:** This is commit `84b21af`, the iteration-2 review-fix for finding CR-01 — a real three-way validation-bound inconsistency bug found by code review of plan 15-02, fixed and gated before this plan (15-03) was dispatched. It is not work this plan performed.
- **Disposition:** Not reverted (reverting would reintroduce the CR-01 bug: a 129-200 char city/region would again be selectable and pre-selected in the UI but rejected at checkout). Verified directly that the diff touches only the numeric bound passed to an existing validation helper — no new endpoint, no authentication, authorization, or same-origin check changed — so the threat this assertion exists to catch (T-15-06, elevation of privilege via an unreviewed API change) did not occur. Documented here in full per the plan's own instruction ("stop and report it... not something to patch over"); the orchestrator's own dispatch context to this plan already named this exact file as part of "waves 1-2 plus two review-fix iterations already landed," so this finding was expected, not novel.
- **Files involved:** `app/api/setup-intent/route.ts`, `lib/subscriptions/address-limits.ts` (neither modified by this plan).
- **Verification:** `git diff 635cb28..HEAD -- app/api/setup-intent/route.ts | grep -E '^\+|^-'` shows exactly the two bound substitutions; no other line changed.
- **Commit:** N/A — pre-existing at HEAD (`84b21af`), not made by this plan.

---

**Total deviations:** 0 auto-fixed, 1 reported-and-accepted (a pre-existing, already-reviewed change that invalidated one of six scope assertions without invalidating the threat mitigation the assertion exists to prove).
**Impact on plan:** None on delivered functionality. The gate suite, the other five scope assertions, and the deploy all remain fully green; only the reporting obligation of Task 1 required this section.

## Issues Encountered

None beyond the scope-assertion finding documented above.

## User Setup Required

None — no external service configuration required.

## Human-Check List

Do these three on voltique.russellkmoore.me while signed in. Report pass or fail for each.

1. Open a subscription product (Field Ration Resupply). Pick a delivery schedule, set the quantity to 2, then choose "Add a new address…" in the shipping address dropdown. Save a real address. The modal should close, the new address should be selected, and the schedule and the quantity 2 should be exactly where you left them.

2. Open the same dropdown again, choose "Add a new address…", and enter a one-letter country code. Saving should show the error inside the modal and the modal should stay open.

3. Open the modal once more and press Escape. The dropdown should still show whichever address was selected before you opened it.

Also worth a glance while you are there: with no saved addresses at all, the dropdown must still be openable — it is no longer disabled on an empty list.

**Why these three need a human:** this repository's unit suite has no jsdom, so nothing in it renders the modal, opens the select, or exercises a real save. Every behavioural claim in SUB-01..03 is pinned at the source-contract and pure-helper level (see the Requirement Proof Table above) — real enough to prove the code says what it should, not enough to prove a browser agrees.

## Next Phase Readiness

- Phase 15 (Subscription Address In Place) is fully implemented, gated, and deployed. SUB-01, SUB-02, SUB-03 are marked complete in `.planning/REQUIREMENTS.md`.
- Carried-forward blockers from earlier phases (Stripe Tax unavailable, `STORE_SUPPORT_EMAIL` placeholder, no routing rule for the sender address) were out of this phase's scope and were not touched or newly investigated here.
- No blockers for the next phase in the v2.2 milestone roadmap.

---
*Phase: 15-subscription-address-in-place*
*Completed: 2026-09-11*
