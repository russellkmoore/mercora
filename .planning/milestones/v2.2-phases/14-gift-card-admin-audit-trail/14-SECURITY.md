---
phase: "14"
slug: "gift-card-admin-audit-trail"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-10"
---

# Phase 14 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run by gsd-security-auditor (read-only verdict) against HEAD `ca3d444`; this file persisted by the orchestrator after the audit's flags and advisories were fixed (commits `43fa17e`, `a805daf`, `062d2f9`, `9329634`, `994e3d8`, `5f77256`).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| admin browser → `/admin/gift-cards`, `/admin/gift-cards/[id]` | Clerk session required at the edge (`middleware.ts` sign-in redirect) and per page (`requireAdminSession()` → 404 for non-admins); client components fetch through the API | Static page shell only on the server; card data via 401-gated API |
| admin browser / service token → `/api/admin/gift-cards`, `[id]`, `[id]/events`, seven `[id]/*` mutations | `checkAdminPermissions` (Clerk admin, service token, or dev bypass; same-origin on POST); reveal additionally requires the setting, a super-admin Clerk session, and `confirm: true` | Masked queue rows, timeline, typed error codes; the plaintext code only in the reveal body (`Cache-Control: no-store`) |
| admin API → D1 (`gift_card_*`, `gift_card_events`) | Repository idempotent INSERT idiom, one `database.batch()` for reissue and admin-create, 0022/0024 triggers and indexes | Ledger entries, reservations, deliveries, audit events |
| admin API → email sender | `resendGiftCardDelivery` decrypts in memory, event written first, per-event idempotency key | Recipient address, code inside the email body only |
| generic settings route → `admin_settings` | Refuses the honor-guard key; only `gift_cards.code_reveal_enabled` allowed in that category | One boolean |
| Workers Builds → production | Push to `main`; `deploy:ci` applies migration 0024 | Schema |

---

## Threat Register

Declared threats T-14-01..T-14-62 come from the `<threat_model>` blocks in 14-01..14-09 PLAN.md; the auditor's full per-threat evidence table (file:line for every row) is in the audit transcript and is summarised here. T-14-63 was registered from the audit's unregistered flag UF-14-1.

| Threat ID | Category | Component | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|----------|-------------|-----------------------|--------|
| T-14-01..04 | Tampering / Repudiation | migration 0024 | high/medium | mitigate | Expand-only DDL; populated-baseline ordering test; `actor_type` CHECK; `details` JSON-object CHECK (`tests/integration/gift-cards-migration.test.ts`) | closed |
| T-14-05 | Information Disclosure | `code_suffix` column | low | accept | AR-14-01 | closed |
| T-14-06 | Denial of Service | `ON DELETE RESTRICT` on events | low | accept | AR-14-02 | closed |
| T-14-07..08 | Tampering / EoP | settings route, reveal default | high | mitigate | Guard key refused, one-entry `gift_cards` allowlist; reveal ships `false` and requires strict `true` (`admin-settings-honor-guard.test.ts`) | closed |
| T-14-09..11 | DoS / Spoofing / Repudiation | `admin-http.ts` body limit, same-origin, actor | high/medium | mitigate | `readBoundedJsonBody` checks declared and real length; `checkAdminPermissions` is the first statement of every handler; `actorFrom` is the only actor builder | closed |
| T-14-12..18 | Tampering / EoP | repository writes | high/medium | mitigate | Deterministic reissue id + partial UNIQUE + business key; pre-checks for status and reservations; balance guard trigger; release only uncommitted; requeue only `needs_review`; suffix validated on both issuance paths; no re-enable path | closed |
| T-14-19..24 | Information Disclosure / Tampering / DoS | projections, events, timeline, search | high/medium | mitigate | Column-named projections; forbidden-key guard on event details (now incl. `code` and camelCase scan, UF-14-2/3); parameterised `q`; bounded limits | closed |
| T-14-25..29 | Information Disclosure / Tampering / DoS / Spoofing | resend | high/medium | mitigate | Address validated twice and audited **before** send (A-2 fix `062d2f9`); no delivery-row UPDATE; per-event idempotency key; AAD from the row's own ids | closed |
| T-14-30 | EoP | admin-create amount | high | mitigate | Catalogue-derived ceiling, currency from store config, CHECK in 0022 | closed |
| T-14-31..37 | EoP / Spoofing / Info Disclosure / DoS / Tampering / Repudiation | list, detail, events, create routes | high/medium | mitigate | 401 before flags; column-named responses; bounded body; deterministic create id; `resolveHonorEffective` owner; `admin_created` event now in the issuance batch (A-3 fix `9329634`) | closed |
| T-14-38..50 | EoP / Repudiation / Info Disclosure / Tampering / DoS / Spoofing | seven mutation routes | high/medium | mitigate | Gate first (401 cases for all seven after A-1 `a805daf`); reveal: setting → super admin → confirm → event-first → `no-store`; hand-built details; reissue 409 on double/blocked/race; release/requeue guards; bounded bodies | closed |
| T-14-51 | Tampering | `admin_settings` writers | high | mitigate | No new writer; Phase 13 write contract green | closed |
| T-14-52..57 | Information Disclosure / EoP / Tampering / Repudiation | admin pages and components | high/medium | mitigate | Pages server-render no card data; `resolveHonorEffective` gate; reveal code dialog-local and cleared; masked suffix only; per-open request id; refetch after actions | closed |
| T-14-58..62 | EoP / Info Disclosure / Tampering / DoS | deploy and docs | high/medium | mitigate | Anonymous production GETs → 401 / 405; reveal documented off-by-default; expand-only + `deploy:ci`; read-only production checks; 11 gates green | closed |
| T-14-63 | Information Disclosure | `/admin/*` page segments streamed to anonymous callers despite the layout gate (audit UF-14-1) | medium | mitigate | `middleware.ts` redirects anonymous `/admin` page requests to `/sign-in` before any segment renders; `lib/auth/admin-session.ts` `requireAdminSession()` is the first await of every async `app/admin/**/page.tsx` and 404s for a non-admin session; `tests/unit/app/admin-pages-server-gate-source.test.ts`, `admin-guard-middleware.test.ts` (`43fa17e`). 13-SECURITY.md T-13-42 amended accordingly | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-14-01 | T-14-05 | `code_suffix` is the last four characters of a 28-symbol alphabet (about 20 of 140 bits), write-restricted, and the same group `maskGiftCardCode` already prints in customer email and checkout. Not bearer material. | Claude (autonomous run, Russell's standing instruction) | 2026-09-10 |
| AR-14-02 | T-14-06 | `ON DELETE RESTRICT` is intentional: an audited card is never deletable while its history exists; no code path deletes `gift_card_accounts`. | Claude (autonomous run) | 2026-09-10 |
| AR-14-03 | audit advisory A-4 | A `restoreRedemption` racing a reissue on a disabled card could leave a residual balance on a card that cannot be reissued twice; the balance trigger prevents overdraw and the once-only guard prevents double-mint. Operator remedy: admin-create a card for the residual with a note. Low likelihood; revisit if refunds to disabled cards become common. | Claude (autonomous run) | 2026-09-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-10 | 62 | 62 | 0 (UF-14-1 warning, A-1..A-4 advisories, UF-14-2/3 info) | gsd-security-auditor (L1 config; L2 checks, L3 traces on reveal/reissue/release/resend; anonymous production GETs) |
| 2026-09-10 | 63 | 63 | 0 | Orchestrator registered and closed T-14-63; fixer closed A-1..A-3, UF-14-2, UF-14-3; A-4 accepted as AR-14-03 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** Claude, autonomous run 2026-09-10 (Russell to confirm AR-14-01..03 at the milestone review)
