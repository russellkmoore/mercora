---
phase: 03-decision-lock-in-and-operator-runbooks
plan: 01
subsystem: docs
tags: [adr, checkout, trust-boundary, gsd-ingest, manifest]

# Dependency graph
requires:
  - phase: 01-security-and-deployment-hardening
    provides: verified shared checkout-pricing.ts and order-finalization.ts services used by both storefront and MCP checkout paths
provides:
  - docs/checkout-trust-boundary.md corrected to state MCP checkout is inside the paid inventory boundary, with the superseded claim removed and a dated correction recorded
  - all four ADR docs carrying a dated Accepted status marker as their own markdown block
  - gsd-ingest-manifest.yaml git-tracked with all four ADR entries locked
affects: [03-02, 03-03, future /gsd-ingest-docs runs]

# Actuals (#2632)
actuals:
  tokens: 1418
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADR status marker: **Status:** Accepted (YYYY-MM-DD) as its own markdown block, line 3 after H1 + blank line, before the doc's original first paragraph"
    - "gsd-ingest-manifest.yaml locked: true is a human-readable record only; the actual ingest lock gate is each doc's own Status line, not the manifest key"

key-files:
  created: []
  modified:
    - docs/checkout-trust-boundary.md
    - docs/webhooks-refunds-inventory.md
    - docs/database-migrations.md
    - docs/subscriptions.md
    - gsd-ingest-manifest.yaml

key-decisions:
  - "No optional **Binding:** line added — CONTEXT.md left it to discretion and the plan's own target text for the status block did not include it, so all four docs stay minimal (Status line only)."
  - "Wrapped 'MCP checkout is inside the paid inventory boundary.' onto its own line in checkout-trust-boundary.md (rather than following the plan's literal line-wrap) so the exact-phrase grep check does not fail on a mid-sentence line break; wording is unchanged, only where the line breaks."

patterns-established:
  - "Pattern 2: dated ADR Accepted markers as a standalone block are now used across all four binding-decision docs; any new ADR doc going forward should follow the same shape."

requirements-completed: [ADR-01, ADR-02]

coverage:
  - id: D1
    description: "docs/checkout-trust-boundary.md states MCP checkout is inside the paid inventory boundary, names the two shared services and two MCP tools, and records the 2026-09-02 correction; the superseded sentence is gone."
    requirement: "ADR-01"
    verification:
      - kind: other
        ref: "grep checks in Task 1 <verify> — status marker exact match, own-block check, superseded-phrase absence, six required strings present"
        status: pass
    human_judgment: false
  - id: D2
    description: "All four ADR docs carry a dated Accepted status marker as their own markdown block on line 3, and gsd-ingest-manifest.yaml is git-tracked with exactly four locked: true keys, all 26 entries intact and in original order."
    requirement: "ADR-02"
    verification:
      - kind: other
        ref: "grep + node/yaml checks in Task 1 and Task 2 <verify> — marker count, per-file date match, locked-key count, YAML entry count/order/lock-scope"
        status: pass
    human_judgment: false
  - id: D3
    description: "The doc ingest classifier (semantic read of each ADR's Status line) actually classifies all four ADRs as locked when /gsd-ingest-docs re-runs against the manifest."
    verification: []
    human_judgment: true
    rationale: "The manifest locked: key and the structural greps are a proxy, not a substitute, for the LLM classifier's semantic read of each doc's Status line. Deferred to the end-of-phase throwaway-branch human verification item described below (RESEARCH.md, 'Don't Hand-Roll')."

# Metrics
duration: 20min
completed: 2026-09-02
status: complete
---

# Phase 3 Plan 1: ADR Lock-In Summary

**Corrected the false MCP-checkout-boundary claim in `docs/checkout-trust-boundary.md` and marked all four ADR docs `Accepted`, with the lock recorded in a newly git-tracked `gsd-ingest-manifest.yaml`.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-02T22:00:18Z
- **Tasks:** 2 completed (Task 1 tracer, Task 2 expansion)
- **Files modified:** 5

## Accomplishments
- `docs/checkout-trust-boundary.md` now states MCP `create_payment_intent` and `place_order` share the storefront's `lib/services/checkout-pricing.ts` and `lib/services/order-finalization.ts`, and that MCP checkout is inside the paid inventory boundary. The superseded "remains outside" sentence is gone, replaced by a one-sentence 2026-09-02 correction note that keeps the record of the earlier wrong claim visible.
- All four ADR docs (`checkout-trust-boundary.md`, `webhooks-refunds-inventory.md`, `database-migrations.md`, `subscriptions.md`) carry a dated `**Status:** Accepted (YYYY-MM-DD)` marker as their own markdown block on line 3, each using that document's own first-commit date.
- `gsd-ingest-manifest.yaml` is now git-tracked and carries `locked: true` on all four ADR entries (and only those), with all 26 manifest entries intact and in their original order.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end ADR lock-in on one document (tracer)** - `083e2dd` (docs)
2. **Task 2: Apply the proven marker and lock pattern to the other three ADR documents** - `f0f4027` (docs)

_Task 1 was a tracer: after committing, its `<verify>` block (automated-only, no human-check) was re-run end-to-end before Task 2 expanded the pattern — all six checks passed, so expansion proceeded without a checkpoint._

## Files Created/Modified
- `docs/checkout-trust-boundary.md` - added dated Status marker; replaced the false MCP-boundary sentence with a verified positive statement and a correction note
- `docs/webhooks-refunds-inventory.md` - added dated Status marker only
- `docs/database-migrations.md` - added dated Status marker only
- `docs/subscriptions.md` - added dated Status marker only
- `gsd-ingest-manifest.yaml` - newly git-tracked; added one lock-date comment and four `locked: true` keys, one per ADR entry

## Decisions Made
- No code identifier differed from the plan text: `create_payment_intent` and `place_order` are registered exactly as named in `lib/mcp/auth.ts`; `lib/mcp/checkout.ts` imports `priceCheckout` from `lib/services/checkout-pricing.ts` and `lib/mcp/tools/order.ts` imports `finalizeOrderPayment` from `lib/services/order-finalization.ts`. All grep-verified before writing prose, per Task 1 step 1.
- Optional `**Binding:** changes require a new decision.` line was NOT added to any of the four docs — left to discretion by CONTEXT.md, and the plan's own literal target text for the status block only specified the Status line.
- The `gsd-ingest-manifest.yaml` `locked: true` key is documented in the SUMMARY (per the plan's instruction) as a human-readable record only — the GSD ingest classifier does not read it; the real lock gate is each document's own `**Status:** Accepted` line (RESEARCH.md Pitfall 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrapped a phrase split across a markdown line break**
- **Found during:** Task 1, acceptance-criteria verification loop
- **Issue:** The plan's target prose put "MCP checkout is inside\nthe paid inventory boundary." across two wrapped lines (matching the plan's literal line-wrap example). The task's own `<verify>` step requires `grep -qF 'inside the paid inventory boundary'` to match, which `grep` (line-oriented, no `-z`) cannot do across a line break — the acceptance criterion failed on first run.
- **Fix:** Rewrapped the paragraph so "MCP checkout is inside the paid inventory boundary." sits entirely on one line. No wording changed, only where the line breaks.
- **Files modified:** `docs/checkout-trust-boundary.md`
- **Verification:** Re-ran the six-string grep loop; all six (including the phrase) passed.
- **Committed in:** `083e2dd`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - bug in line-wrap vs. its own verify command).
**Impact on plan:** Cosmetic only — text content and meaning unchanged, purely a markdown line-wrap fix required to satisfy the plan's own acceptance grep. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

**End-of-phase human verification item (Task 2, deferred per plan):**

Russell — confirm the doc ingest classifier reads all four ADRs as locked. Run on a throwaway branch (ingest merge mode can write into `.planning/`):

1. `git checkout -b throwaway/ingest-check`
2. `/gsd-ingest-docs --manifest gsd-ingest-manifest.yaml --mode merge`
3. Confirm all four ADR docs classify as locked, with no lock-status note for them and no warning that `docs/checkout-trust-boundary.md` contradicts a SPEC or PRD source.
4. `git checkout main`, then `git branch -D throwaway/ingest-check`, then discard anything the run wrote (`git checkout -- .` and `git clean -fd .planning/` if needed).

Why this is not automated: the in-phase gates are structural (marker text, manifest shape). The lock decision itself is an LLM classifier's semantic read of each document, which grep cannot reproduce. If any of the four still classifies as unlocked, name it and paste the line the run printed — that is a real gap, not a false alarm.

Plans 03-02 and 03-03 (operator runbooks, RUN-01/RUN-02) do not depend on this plan (`depends_on: []` in all three) and can proceed independently. Ready for `03-02`.

---
*Phase: 03-decision-lock-in-and-operator-runbooks*
*Completed: 2026-09-02*
