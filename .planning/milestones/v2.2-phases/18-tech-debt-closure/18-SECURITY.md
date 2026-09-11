---
phase: "18"
slug: "tech-debt-closure"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 2
created: "2026-09-11"
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run by gsd-security-auditor (read-only verdict), ASVS L2 given money/PII adjacency (Phase 17 precedent), against HEAD `d9b7024`; this file persisted by the orchestrator. The audit found that T-18-21/T-18-23's initial mitigation did not actually hold until the code review's own iteration-2 caught it (CR-01: the tail worker's independent sanitizer silently dropped `delivery_id` before it reached the paging alert) — re-verified fixed directly in code, not trusted from the fix report.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| account browser → order detail / confirmation email | Address always scoped to the requesting shopper's own order (`WHERE orders.id=? AND orders.customer_id=?`); no cross-order lookup anywhere in the new billing-address fallback | Order's own shipping/billing address only |
| cart hydration → checkout projection | An invalid gift note is preserved with a flag, never trusted as valid data; `projectCartLineForCheckout` throws on it | Cart line data, never bare/priced gift-card lines with no recipient |
| gift-card delivery → telemetry → tail worker alert | `delivery_id` bounded (128 chars, restricted charset) in both the producer (`lib/observability/telemetry.ts`) and the independent consumer sanitizer (`workers/observability-tail/src/core.ts`) | Internal delivery id only, no PII, no code material |
| CI → migration-safety check | Reads filenames via `readdirSync`/`readFileSync` and calls `git` via array-form `spawnSync` (no shell) — no injection surface | Migration filenames only |

---

## Threat Register

Declared threats T-18-01..36 come from the `<threat_model>` blocks in 18-01..18-07 PLAN.md.

| Threat ID | Category | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|----------|-------------|------------------------|--------|
| T-18-01 | Info Disclosure | high | mitigate | Order detail scoped to `customer_id` match | closed |
| T-18-02 | Info Disclosure | high | mitigate | Confirmation-email builder operates on one `Order` param, no cross-order lookup | closed |
| T-18-03 | Tampering | medium | mitigate | Address fields HTML-escaped in the email template | closed |
| T-18-04 | Denial of Service | medium | mitigate | Existing image/idempotency bounds unchanged | closed |
| T-18-05 | Repudiation | medium | accept | Renewal regression test present and passing | closed |
| T-18-06 | Spoofing | low | accept | `payment-intent/route.ts` untouched by this phase | closed |
| T-18-07 | Tampering | low | accept | Server re-derives digital-only independently of any client signal | closed |
| T-18-08 | Tampering | medium | mitigate | Cross-reference doc comments pin the two predicates to each other | closed |
| T-18-09 | Repudiation | medium | mitigate | Fixture-floor test enforced | closed |
| T-18-10 | Denial of Service | high | mitigate | `/api/tax` deleted, zero references, confirmed live 404 | closed |
| T-18-11 | Info Disclosure | low | mitigate | Route directory confirmed absent | closed |
| T-18-12 | Tampering | high | mitigate | No `{ DB }`-only fallback remains in `order-effects.ts` | closed |
| T-18-13 | Repudiation | medium | accept | Missing key ring throws loudly, tested | closed |
| T-18-14 | Elevation of Privilege | low | accept | Other effect branches unaffected by the fallback removal | closed |
| T-18-15 | Tampering | critical | mitigate | Checkout projection throws on a flagged gift-note line | closed |
| T-18-16 | Elevation of Privilege | high | mitigate | Invalid customization never set as if valid; UI gates on presence | closed |
| T-18-17 | Tampering | high | accept | Server independently re-parses and rejects, regardless of client | closed |
| T-18-18 | Info Disclosure | medium | mitigate | Fixed warning copy, rejected note text never rendered | closed |
| T-18-19 | Denial of Service | medium | mitigate | Existing cart bounds unchanged | closed |
| T-18-20 | Spoofing | medium | accept | Link-rejection rule untouched | closed |
| T-18-21 | Repudiation | high | mitigate | `delivery_id` present in telemetry field set; consumer-side drop (CR-01) fixed and re-verified | closed |
| T-18-22 | Denial of Service | high | mitigate | `gift_card.delivery_retry` excluded from `TAIL_CRITICAL_EVENTS` | closed |
| T-18-23 | Info Disclosure | high | mitigate | `delivery_id` bounded/sanitized in both sanitizers; parity test added | closed |
| T-18-24 | Tampering | medium | mitigate | Parity test extended beyond the closed-enum fields | closed |
| T-18-25 | Spoofing | low | accept | Event name is a closed 2-member union | closed |
| T-18-26 | Denial of Service | high | mitigate | Collision check fires only on newly-added-vs-existing; 0023 pair produces zero reports | closed |
| T-18-27 | Tampering | high | mitigate | Never-rename rule documented | closed |
| T-18-28 | Tampering | medium | mitigate | Check runs PR-only as defense-in-depth | closed |
| T-18-29 | Elevation of Privilege | low | accept | Array-form `spawnSync`, no shell, no injection surface | closed |
| T-18-30 | Info Disclosure | low | mitigate | No secrets in the new doc content | closed |
| T-18-31 | Info Disclosure | high | mitigate | Production checks read-only, independently re-verified | closed |
| T-18-32 | Tampering | high | mitigate | Full gate suite re-run clean at HEAD | closed |
| T-18-33 | Elevation of Privilege | high | mitigate | Deploy by push only, no local `deploy:ci` | closed |
| T-18-34 | Repudiation | medium | mitigate | WINDOWS.md entries closed with cited evidence | closed |
| T-18-35 | Repudiation | medium | accept | D-10 ratification recorded; no suppression logic added | closed |
| T-18-36 | Denial of Service | low | accept | Three total unauthenticated read-only probes | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-18-01 | T-18-05, T-18-13, T-18-14, T-18-17, T-18-20, T-18-25, T-18-29, T-18-35, T-18-36 | Each independently verified against code, not just plan prose (see audit evidence column); low-severity or already covered by an existing regression test, server-side re-derivation, or established safe pattern. | Claude (autonomous run, Russell's standing instruction) | 2026-09-11 |
| AR-18-02 | T-18-06, T-18-07 | `payment-intent/route.ts` was not touched by this phase; the server's digital-only determination is independent of any client-supplied signal. | Claude (autonomous run) | 2026-09-11 |
| AR-18-03 | T-18-10 (D-10 ratification) | The retroactive gift-note question was explicitly deferred by Phase 12's review; this phase ratifies sending the note (matching the buyer's original intent) as the default rather than building suppression logic. Flagged for Russell to override if he disagrees. | Claude (autonomous run) | 2026-09-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-11 | 36 | 36 | 0 | gsd-security-auditor (L2; independently re-verified the code-review's own iteration-2 fix rather than trusting the fix report; live production re-verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** Claude, autonomous run 2026-09-11 (Russell to confirm AR-18-01..03, especially the D-10 retroactive gift-note default, at the milestone review)
