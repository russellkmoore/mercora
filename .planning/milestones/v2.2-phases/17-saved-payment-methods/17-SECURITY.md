---
phase: "17"
slug: "saved-payment-methods"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 2
created: "2026-09-11"
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run by gsd-security-auditor (read-only verdict) at ASVS L2, elevated from the phase default given this is money/PCI-adjacent code, against HEAD `1f86d3b`; this file persisted by the orchestrator.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| shopper browser → Stripe (Elements/Customer Session) | Card entry and tokenization happen entirely in Stripe's hosted iframe; our servers never receive card data | Stripe client secrets only, never PAN/CVC |
| `app/api/payment-intent` → Stripe | `ensureStripeCustomer` binds one Stripe Customer per Clerk user; PaymentIntent created with `customer` when available, no `setup_future_usage` field; a Customer Session is created alongside with `payment_method_remove: 'disabled'` | Stripe customer id, PaymentIntent id, Customer Session client secret |
| account browser → `/api/account/payment-methods` | Clerk-gated, same-origin-guarded list/delete; DELETE retrieves-then-compares ownership before detaching, unified 404 for both "not found" and "not yours" | Brand, last4, expiry only |
| D1 `payment_customers` | One row per Mercora customer id, `ON DELETE RESTRICT`, `CHECK` on Stripe id shape | Stripe customer id binding only |

---

## Threat Register

Declared threats come from the `<threat_model>` blocks in 17-01..17-06 PLAN.md.

| Threat ID | Category | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|----------|-------------|------------------------|--------|
| T-17-01 | Tampering | high | mitigate | CHECK constraint on Stripe id shape in both migration and Drizzle schema; malformed ids rejected in integration test | closed |
| T-17-02 | Elevation of Privilege | critical | mitigate | `ensureStripeCustomer` verifies ownership on every existing-binding and conflict-winner path | closed |
| T-17-03 | Tampering | medium | mitigate | Deterministic idempotency key passed to `stripe.customers.create` | closed |
| T-17-04 | Information Disclosure | high | mitigate | No logging in the binding module | closed |
| T-17-05 | Repudiation | low | mitigate | `ON DELETE RESTRICT`; a customer with a binding cannot be deleted | closed |
| T-17-06 | Spoofing | critical | mitigate | `customerId` always from `auth()`, never the request body | closed |
| T-17-07 | Information Disclosure | high | mitigate | Telemetry payloads pass through a hard allowlist | closed |
| T-17-08 | Information Disclosure | high | mitigate | Customer Session secret omitted from the response for guests | closed |
| T-17-09 | Denial of Service | high | mitigate | Every Stripe call independently caught; failure never 503s checkout | closed |
| T-17-10 | Tampering | medium | mitigate | `setup_future_usage` never set on the PaymentIntent (D-06a) | closed |
| T-17-11 | Information Disclosure | critical | accept | Structural — no card-data field exists anywhere in the request/response types | closed |
| T-17-12..14 | Information Disclosure | high/medium | mitigate | Customer Session secret flows only into `StripeProvider`, omitted when absent | closed |
| T-17-15 | Spoofing | low | accept | `link: 'never'` literal unchanged | closed |
| T-17-16 | Information Disclosure | critical | accept | Structural — Payment Element never exposes card fields to app code | closed |
| T-17-17 | Elevation of Privilege | critical | mitigate | Retrieve-then-compare before detach | closed |
| T-17-18 | Information Disclosure | high | mitigate | Unified 404 for not-found and not-yours (WR-01 fix, re-verified iteration 2) | closed |
| T-17-19 | Spoofing | critical | mitigate | `stripeCustomerId` derived server-side from the authenticated session | closed |
| T-17-20 | Tampering (CSRF) | high | mitigate | `hasSameOrigin` on the mutating route | closed |
| T-17-21 | Information Disclosure | high | mitigate | GET projects exactly brand/last4/expiry | closed |
| T-17-22 | Information Disclosure | medium | mitigate | Fixed error strings, never a caught Stripe message | closed |
| T-17-23 | Denial of Service | low | mitigate | Id length bound before any Stripe call | closed |
| T-17-24 | Information Disclosure | high | mitigate | Dual auth gate (page + account layout) | closed |
| T-17-25 | Elevation of Privilege | critical | mitigate | Client sends only the method id; server decides ownership | closed |
| T-17-26 | Information Disclosure | high | mitigate | UI renders only the 5-field public shape | closed |
| T-17-27 | Tampering (CSRF) | high | mitigate | `credentials: "same-origin"` paired with server-side same-origin check | closed |
| T-17-28 | Information Disclosure | high | mitigate | Nav entry only renders inside the gated account layout | closed |
| T-17-29 | Tampering | critical | mitigate | Migration is additive-only; `check:migrations` passed | closed |
| T-17-30 | Elevation of Privilege | critical | mitigate | Reproduced live: anonymous GET/DELETE → 401 | closed |
| T-17-31 | Information Disclosure | high | mitigate | Live probe returned a generic error shape only | closed |
| T-17-32 | Denial of Service | high | mitigate | Live probe: `/checkout` still 200 for anonymous callers | closed |
| T-17-33 | Repudiation | medium | transfer | Transferred to Russell's own click-through (human-check list in 17-06-SUMMARY.md) | closed |
| T-17-SC (×6) | Tampering | high | mitigate | No `package.json` change in this phase; no new dependency | closed |

Non-blocking notes: a residual Stripe-round-trip timing differential on the DELETE route's 404 unification is structural to proxying Stripe's own API and impractical to exploit against unguessable ids; no rate limit on the new routes, consistent with the existing `addresses` route precedent and not new attack surface.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-11, T-17-16 | Card data never reaches our servers by construction — Stripe Elements/Customer Session own tokenization entirely; there is no code path that could leak a PAN because none exists to leak it. | Claude (autonomous run, Russell's standing instruction) | 2026-09-11 |
| AR-17-02 | T-17-15 | Stripe Link stays disabled; re-enabling it is an explicit future decision per the roadmap's own wording, not part of this phase. | Claude (autonomous run) | 2026-09-11 |
| AR-17-03 | T-17-33 | Four card-in-hand checks (save, reuse, remove, guest-sees-nothing) cannot be exercised by any automated probe and are transferred to Russell's own click-through. | Claude (autonomous run) | 2026-09-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-11 | 33 (+6 supply-chain instances) | 39/39 | 0 | gsd-security-auditor (L2, elevated for money/PCI adjacency; independent live production re-verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** Claude, autonomous run 2026-09-11 (Russell to confirm AR-17-01..03 and complete the four card-in-hand checks at the milestone review)
