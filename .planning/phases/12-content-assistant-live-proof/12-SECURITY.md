---
phase: "12"
slug: "content-assistant-live-proof"
status: open_threats
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 1
asvs_level: 1
created: "2026-09-09"
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run by gsd-security-auditor (read-only verdict); this file persisted by the orchestrator.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| local Node harness → production D1 / R2 / Vectorize / Workers AI | `getPlatformProxy({ remoteBindings: true })` against a scratch `wrangler.jsonc` copy under Russell's OAuth login | Product rows, knowledge markdown, vectors (read); one knowledge upsert, one product upsert (write) |
| developer shell → production D1 | `wrangler d1 execute --remote --file` | Terms row content; prod_33 copy; one delivery re-queue |
| developer shell → public R2 bucket / CDN | `wrangler r2 object put` | Knowledge article (public by design) |
| scripted guest checkout → storefront APIs → Stripe (test mode) | `POST /api/payment-intent`, PaymentIntent confirm with the public key + `pm_card_visa`, `POST /api/orders` | Recipient email/name/note, billing address, client secret (memory only) |
| production cron → email sender → Cloudflare Email Sending | Delivery drain hands the worker env to `sendEmail` | Bearer code (decrypted in memory only), recipient email, buyer's note |
| `wrangler.jsonc` → Workers Builds → production Worker | Public vars deployed on push to `main` | `EMAIL_PROVIDER`, `STORE_SENDER_EMAIL` (non-secret) |

---

## Threat Register

Declared threats come from the `<threat_model>` blocks in 12-01..12-06 PLAN.md; T-12-34..T-12-42 were added at audit time for changes made after planning.

| Threat ID | Category | Component | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|----------|-------------|-----------------------|--------|
| T-12-01 | Tampering | committed `wrangler.jsonc` | high | mitigate | `git status --porcelain wrangler.jsonc` empty after the tracer; comment-filtered `"remote"` count 0 (12-01-SUMMARY) | closed |
| T-12-02 | Tampering | scratch config pointing at the wrong resources | critical | mitigate | Resource-name assertions (`mercora-db`, database id, `voltique-images`, `voltique-index`) before any binding opens | closed |
| T-12-03 | Tampering | tracer writing to production | high | mitigate | Write-call grep over the harness = 0 | closed |
| T-12-04 | Information Disclosure | env files / embeddings in output | high | mitigate | No `.dev.vars`/`.env*` read; embeddings reported by length only | closed |
| T-12-05 | Spoofing | wrong Cloudflare account | medium | mitigate | `wrangler whoami` precondition | closed |
| T-12-06 | Denial of Service | tracer load | low | accept | Four reads | closed |
| T-12-07 | Information Disclosure | wrong R2 key overwritten | high | mitigate | Exactly one put: `knowledge_md/gift-cards.md` | closed |
| T-12-08 | Tampering | other knowledge files touched | medium | mitigate | `git status --porcelain data/r2/knowledge_md/` = one path | closed |
| T-12-09 | Repudiation | live object ≠ committed file | medium | mitigate | ETag == MD5 before and after every upload (12-02, review fixes) | closed |
| T-12-10 | Tampering | article promising what the code does not do | medium | mitigate | Source-contract test. **Held only after three review iterations:** CR-01/CR-02/CR-03 (scheduled delivery, note not emailed, product copy) and a dead regex (WR-12) were found by code review, not by this mitigation; all fixed (5045b58, 48b2e42, 5353af9, 84bd958) | closed |
| T-12-11 | Tampering | Terms UPDATE clobbering content | high | mitigate | Generated from the row's own read-back, `--file`, scratch-sqlite round-trip before the production write (12-03) | closed |
| T-12-12 | Tampering | UPDATE hitting other rows | high | mitigate | `WHERE slug='terms-of-service' AND status='published'`; all five `pages` rows diffed | closed |
| T-12-13 | Elevation of Privilege | admin UI bypassed | medium | accept | One-time D-02 exception, single row, Russell's own credentials | closed |
| T-12-14 | Tampering | unsafe HTML in the CMS row | medium | mitigate | Only `h2`/`p` written, on the sanitizer allow-list; re-sanitized at render | closed |
| T-12-15 | Repudiation | double apply | low | mitigate | Idempotence guard proven (`ALREADY_PRESENT` on re-run) | closed |
| T-12-16 | Tampering | full index clear | critical | mitigate | No `deleteByIds`/`deleteVectors`/product clear in the knowledge script; count 48 → 48; `prod_33` intact | closed |
| T-12-17 | Tampering | wrong vector id | high | mitigate | Count equality + `knowledge-shipping` spot check | closed |
| T-12-18 | Tampering | stale article indexed | medium | mitigate | R2 body ETag-verified before re-index; stored vector text carries the new wording | closed |
| T-12-19 | Elevation of Privilege | admin token | medium | accept | `ADMIN_VECTORIZE_TOKEN` never read; admin route never called | closed |
| T-12-20 | Information Disclosure | vector dumps | low | mitigate | Lengths only | closed |
| T-12-21 | Denial of Service | Vectorize/AI rate limits | low | accept | No 429s | closed |
| T-12-22 | Information Disclosure | bearer code columns | critical | mitigate | Every SELECT names columns; grep for `code_hash\|code_ciphertext\|code_nonce` over all artifacts = 0 | closed |
| T-12-23 | Information Disclosure | Stripe secret key | critical | mitigate | Only `pk_test_` used; `sk_` abort; client secret memory-only, never written | closed |
| T-12-24 | Tampering / Repudiation | purchase run twice | high | mitigate | Proof-file + zero-accounts guards; attempt 1 preserved via `git mv`; exactly one account row | closed |
| T-12-25 | Spoofing | client-side "paid" | high | mitigate | `POST /api/orders` re-verifies the PaymentIntent server-side | closed |
| T-12-26 | Information Disclosure | Russell's email | medium | mitigate | Used only as the recipient inside his own store | closed |
| T-12-27 | Information Disclosure | tail capture | medium | mitigate | Bounded to cron ticks, deleted after assertion | closed |
| T-12-28 | Denial of Service | delivery never sends | low | accept | Missed window recorded as a finding, then root-caused and fixed (f813499) rather than retried blindly | closed |
| T-12-29 | Information Disclosure | secret in the pushed range | critical | mitigate | Added-line secret scan over the phase range = 0 (12-06, 12-VERIFICATION) | closed |
| T-12-30 | Tampering | pushing unintended application changes | high | mitigate | 12-06's scope gate (`SCOPE_HELD`) **did not hold**: `lib/services/checkout-pricing.ts`, `lib/services/gift-card-fulfillment.ts`, `wrangler.jsonc` changed by the four unattended commits (3b821f7, 32b9df1, f813499, d8b4d11) and the review-fix range 5045b58…eb07108. The push proceeded on the orchestrator's judgment under Russell's standing instruction, with the stronger true statement recorded (no `app/`, `components/`, `migrations/` changes; no secret). Not yet ratified by Russell — see AR-12-03 | **open** |
| T-12-31 | Tampering | migration slipped in | high | mitigate | `git diff --diff-filter=A -- migrations` over the range = empty | closed |
| T-12-32 | Repudiation | placeholder validation | medium | mitigate | Placeholder scan over 12-VALIDATION.md = 0 | closed |
| T-12-33 | Denial of Service | broken deploy | low | accept | Post-deploy 200s on storefront, PDP, Terms | closed |
| T-12-SC | Tampering | npm installs | low | accept | No package installed in any plan; lockfile unchanged | closed |
| T-12-34 | Information Disclosure / Tampering | buyer's note rendered into the delivery email | medium | mitigate | Every line HTML-escaped (`escapeHtmlText`), attributed, placed below the code and the "keep private" line; URL-like content rejected in `lib/gift-cards/customization.ts` (three patterns, zero false positives on 20 realistic notes) | closed |
| T-12-35 | Information Disclosure / Repudiation | delivery failure logging | medium | mitigate | `recordTelemetry` with closed enums only (`gift_card.delivery_failed` critical + tail-paging; `gift_card.delivery_note_dropped` warning); no free text, no recipient, no code | closed |
| T-12-36 | Information Disclosure | env handed to the sender from the cron | medium | mitigate | `emailEnvironmentFrom` passes `EMAIL`/`DB`/`EMAIL_PROVIDER`, `RESEND_API_KEY` only when the provider is not cloudflare; returns undefined when nothing usable is present | closed |
| T-12-37 | Information Disclosure / Deployability | public vars in committed `wrangler.jsonc` | medium | accept | `EMAIL_PROVIDER=cloudflare`, `STORE_SENDER_EMAIL="Voltique <orders@russellkmoore.me>"` — non-secret, documented; sender is Russell's personal domain in a reference-storefront repo (WR-06 skipped) — see AR-12-01 | open (non-blocking) |
| T-12-39 | Tampering | unattended D1 write to `prod_33` copy | high | mitigate | Generated from the committed seed via `json_set`, single row, before/after md5 recorded, `meta_title` unchanged | closed |
| T-12-40 | Tampering | unattended D1 re-queue of the parked delivery | high | mitigate | `WHERE order_id=… AND status='needs_review'`, changes 1, SQL recorded in STATE.md and 12-PROOF-ORDER §7 | closed |
| T-12-41 | Tampering | product-vector upsert outside 12-04's scope | critical | mitigate | Single-id upsert, no clear; fidelity gate diffs the regenerated markdown and aborts unless only `## Description` changed; count 48 → 48 | closed |
| T-12-42 | Information Disclosure (data loss) | pre-deploy carts with a URL in the note dropped on load | low | accept | WINDOWS.md entry 10; paid orders unaffected — see AR-12-02 | open (non-blocking) |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-37 | The sender address is Russell's live deployed configuration; a placeholder would stop real email on this demo site. Public config, documented in `docs/runtime-configuration.md`. | **pending Russell** — accept the var as-is, or replace with a placeholder plus a Cloudflare Build variable | — |
| AR-12-02 | T-12-42 | Pre-deploy carts whose gift note contains a URL lose that line silently on rehydrate; blast radius is stale browser carts, self-resolving. | **pending Russell** — accept the debt recorded in WINDOWS.md entry 10 | — |
| AR-12-03 | T-12-30 | Four unattended production changes plus the review-fix range were pushed although 12-06's literal scope gate failed; each is tested, deployed, documented in STATE.md / 12-05-SUMMARY / 12-VALIDATION / 12-PROOF-ORDER §7. Demo site, reversible by revert. | **pending Russell** — accept or revert 3b821f7, 32b9df1, f813499, d8b4d11 and 5045b58…eb07108 | — |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 42 | 40 | 2 (1 blocking) | gsd-security-auditor (L1; evidence from SUMMARYs, VERIFICATION, REVIEW/REVIEW-FIX and the code at HEAD) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` — blocked on AR-12-03 (Russell's accept/revert decision)
- [ ] `status: verified` — set once AR-12-01..03 carry a named approver

**Approval:** pending Russell's sign-off (see 12-UAT.md item 4)
