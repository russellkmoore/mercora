---
phase: 11-production-enablement
plan: 03
subsystem: docs
tags: [docs, secrets, deploy-runbook]
requires:
  - phase: 11-production-enablement
    plan: "01"
    provides: Proven local key-ring pipeline shape and phase_base for downstream leak scans
  - phase: 11-production-enablement
    plan: "02"
    provides: Committed .env.example delivery-ring placeholder shape docs can reference
provides:
  - Delivery key ring documented beside the HMAC ring in docs/runtime-configuration.md, with its own shape rules and the operational consequence of a malformed value
  - Five-step gift card enablement recipe (docs/DEPLOYMENT_SETUP.md ## 9) using the non-materializing secret pipeline throughout
affects: [phase-11-plan-04, phase-11-plan-05]
actuals:
  tokens: 1810
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Operator-facing runbook commands use plain `npx wrangler` (matching sections 6/8's existing style), not the `mise exec --` prefix this repository's agents use for their own execution — a documented, intentional divergence per the plan's own instruction"
key-files:
  created: []
  modified:
    - docs/runtime-configuration.md
    - docs/DEPLOYMENT_SETUP.md
key-decisions:
  - "phase_base carried forward from 11-01 (3f287e3); this plan's own PLAN_HEAD_BEFORE was 3d53ecd — used only for this plan's own commit-count measurement (git rev-list --count), not as a new phase-wide leak-scan anchor."
  - "Section 9's Step 3 (verify reconciliation) keeps the plan's own hedged wording — a 503 from GET /api/gift-cards 'means the ring or the database is unhealthy' — rather than narrowing it to a database-only claim, even though this route's code path (listCustomerGiftCardPresentations) does not itself invoke either key-ring parser. The plan's must_haves.truths locked this exact framing at planning time (D-06/RESEARCH.md), and the hedge ('ring or the database') does not assert a false narrow claim; the sharper, code-verified signal (the cron drain parsing the ring unconditionally before checking for pending work) is stated first and marked as the check that can actually fail."
patterns-established: []
requirements-completed: [OPS-03]
coverage:
  - id: D1
    description: "docs/runtime-configuration.md carries a delivery-ring table row immediately after the HMAC-ring row and a delivery-ring paragraph immediately after the HMAC-ring paragraph, stating the versioned-JSON/base64:-prefix/32-byte/server-only/never-wrangler.jsonc shape (D-10)."
    requirement: "OPS-03"
    verification:
      - kind: shell
        ref: "grep -c 'GIFT_CARD_DELIVERY_KEYS_JSON' docs/runtime-configuration.md -> 3; grep -c 'GIFT_CARD_DELIVERY_CURRENT_VERSION' -> 1; grep -c 'GIFT_CARD_DELIVERY_KEY_BYTES' -> 1; grep -c '^| Gift-card delivery encryption secrets' -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/DEPLOYMENT_SETUP.md carries a ## 9. Gift Card Enablement section, placed immediately before the file's closing tagline so the tagline remains the last line, with five ordered steps (D-09)."
    requirement: "OPS-03"
    verification:
      - kind: shell
        ref: "grep -c '^## 9\\. Gift Card Enablement' docs/DEPLOYMENT_SETUP.md -> 1; tail -1 docs/DEPLOYMENT_SETUP.md -> '**Your Mercora platform is now ready for production.**'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every secret command in section 9 uses the non-materializing pipeline form; none uses the value-in-command-text form section 8 still shows for Stripe. No value, account id, or database id appears in either document."
    requirement: "OPS-03"
    verification:
      - kind: shell
        ref: "awk '/^## 9\\./,0' docs/DEPLOYMENT_SETUP.md | grep -cE 'echo \"[a-z]+_(live|test)_' -> 0; git log -p -1 <each commit> -- docs/ | grep -cE '(sk|pk|rk)_(test|live)_[A-Za-z0-9]{20,}' -> 0 for both commits; added-lines-only base64: leak scan -> 0 for both commits"
        status: pass
      - kind: manual
        ref: "Executor review — every command in section 9 pipes a $(openssl ...) substitution directly into a wrangler secret put stdin; no value assigned to a variable, echoed, or written to a file"
        status: pass
    human_judgment: true
    rationale: "This is a negative claim (absence of a leaked value or a copied-forward unsafe pattern) that cannot be fully proven by a single command; reviewed line by line against the written section before this summary."
  - id: D4
    description: "Section 9 states the rollout order and the reason: enabling acquisition without reconciliation throws at capability resolution, so the order is enforced by code, not convention."
    requirement: "OPS-03"
    verification:
      - kind: shell
        ref: "grep -n 'throws at capability resolution' docs/DEPLOYMENT_SETUP.md -> Step 4 present"
        status: pass
    human_judgment: false
  - id: D5
    description: "Section 9 tells an operator how to verify honestly: the signed-in gift-card listing distinguishes healthy from broken, the public balance endpoint cannot, and a malformed delivery ring surfaces on the five-minute recovery cron even with nothing pending."
    requirement: "OPS-03"
    verification:
      - kind: shell
        ref: "grep -n 'cron.recovery_failed\\|proves availability and nothing about ring health\\|zero deliveries queued' docs/DEPLOYMENT_SETUP.md -> Step 3 present"
        status: pass
    human_judgment: false
  - id: D6
    description: "mise exec -- npm run docs:lint exits 0 after both edits."
    requirement: "OPS-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run docs:lint"
        status: pass
    human_judgment: false
duration: 2min
completed: 2026-09-09
status: complete
---

# Phase 11 Plan 03: Document Delivery Ring and Write Enablement Recipe Summary

**Wrote the delivery key ring's variable contract next to the HMAC ring's, and a five-step gift-card enablement recipe into the deploy runbook, using the safe secret pipeline throughout.**

## Performance

- 2 tasks, 2 commits, 2 files changed (114 insertions, 1 deletion), ~2 minutes.
- `actuals.tokens` (chars/4 over the realized diff) came in far under the 35000-token estimate — both edits were targeted insertions into existing, well-understood files; no new file, no code change, no test.

## Accomplishments

- **Task 1:** Inserted a `Gift-card delivery encryption secrets` row immediately after the existing `Gift-card bearer lookup secrets` row in `docs/runtime-configuration.md`'s variable table, and a mirrored paragraph immediately after the existing HMAC-ring paragraph. The new paragraph states the delivery ring's shape (canonical positive-integer versions, `base64:`-prefixed values decoding to exactly `GIFT_CARD_DELIVERY_KEY_BYTES` = 32 bytes, current-version-required, four-key bound, `.dev.vars`/Cloudflare-secrets-only, never `wrangler.jsonc`) and the one operational fact the HMAC paragraph has no equivalent of: the delivery ring is parsed on every scheduled delivery drain once reconciliation is enabled, before the drain checks whether anything is pending, so a malformed value fails the recovery cron every five minutes. Left the existing gift-card flag paragraph (reconciliation-before-acquisition) untouched. Bumped the `**Status:**` line to `Current (2026-09-09)`.
- **Task 2:** Inserted `## 9. Gift Card Enablement` into `docs/DEPLOYMENT_SETUP.md` immediately before the closing tagline, preceded by the same `---` separator the other sections use. Five steps: (1) generate and store the four secrets via the non-materializing `printf ... | npx wrangler secret put ...` pipeline (HMAC ring unprefixed, delivery ring `base64:`-prefixed), proven with `wrangler secret list` (names only), with the "Worker not currently deployed" failure mode noted; (2) enable reconciliation — add the `wrangler.jsonc` `vars` entry, regenerate `cloudflare-env.d.ts` with `.dev.vars`/`.env.local` moved aside, commit and push to `main` (no `npm run deploy`/`deploy:ci` named); (3) verify reconciliation via three checks — `wrangler deployments list`, a clean five-minute `cron.recovery_failed`-free cron cycle (the sharp check, since the ring is parsed before the drain checks for pending work), and the authenticated `GET /api/gift-cards` listing, with the honest caveat that the public balance endpoint answers identically regardless of ring health; (4) enable acquisition only after step 3, same cycle, with the capability-resolution throw as the stated reason the order is enforced by code; (5) roll back by disabling acquisition while keeping reconciliation on, and rotate (never delete) key versions.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Document the delivery key ring beside the HMAC ring in the runtime contract | `e829d86` | `docs/runtime-configuration.md` |
| 2 | Write the five-step gift card enablement recipe into the deploy runbook | `9c9c860` | `docs/DEPLOYMENT_SETUP.md` |

## Files Created/Modified

- Modified: `docs/runtime-configuration.md` — 1 table row, 1 paragraph, 1 `**Status:**` date bump (18 lines added, 1 removed).
- Modified: `docs/DEPLOYMENT_SETUP.md` — new `## 9. Gift Card Enablement` section, 97 lines, inserted before the closing tagline.

## Decisions Made

- Used plain `npx wrangler` (no `mise exec --` prefix) throughout section 9's operator-facing commands, per the plan's explicit instruction to match the style already used in sections 6 and 8 of the same file — the `mise exec --` prefix is this repository's agent-execution convention, not part of the runbook an operator follows.
- Kept the plan's hedged Step 3 wording ("a 503 there means the ring or the database is unhealthy") rather than narrowing it — `GET /api/gift-cards`'s code path does not itself call either key-ring parser, so a stricter claim ("the ring") would overstate what that specific route proves; the hedge is accurate and the sharper, code-verified signal (the cron drain) is given first and marked as the check that can actually fail.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria and the plan-level `<verification>` block passed on the first attempt.

## Issues Encountered

None.

## User Setup Required

None. This plan is entirely local documentation — no production command was run, no secret value was generated, printed, or written anywhere.

## Next Phase Readiness

- Plan 11-04 (production secret provisioning) can link to a committed, docs-lint-passing variable contract and enablement recipe when it runs the actual `wrangler secret put` / flag-flip sequence.
- Plan 11-05 has both docs artifacts in place to reference for the acquisition-flag rollout.
- No blockers. No secret value, account id, or database id appeared in any transcript, commit, or file produced by this plan.

---
*Phase: 11-production-enablement*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `docs/runtime-configuration.md`
- FOUND: `docs/DEPLOYMENT_SETUP.md`
- FOUND: `.planning/phases/11-production-enablement/11-03-SUMMARY.md`
- FOUND: commit `e829d86` and `9c9c860` via `git log --oneline --all --grep="11-03"`
- Task 1 acceptance criteria re-verified: exit 0
- Task 2 acceptance criteria re-verified: exit 0
- Plan-level `<verification>`: `mise exec -- npm run docs:lint` exit 0, `mise exec -- npm run lint` exit 0, tagline is last line, `git diff --stat -- docs/` confined to the two `files_modified` entries, added-lines-only secret-shape leak scan returns 0 for both commits
