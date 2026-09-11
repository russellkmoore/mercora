---
phase: "15"
slug: "subscription-address-in-place"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-11"
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run by gsd-security-auditor (read-only verdict) against HEAD `19a6693`; this file persisted by the orchestrator.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| shopper browser → subscription PDP → `/api/account/addresses` | `saveAddress` (`lib/account/address-client.ts`) posts/puts only to the existing Clerk + same-origin-guarded account route, `credentials: 'same-origin'` | Address fields; the 201/200 response including the new address id |
| shopper browser → `/api/setup-intent` | Existing route, now sharing `ADDRESS_CITY_REGION_MAX` with the panel's client filter and `acquisition-service.ts` | Selected shipping address, plan, quantity |
| Workers Builds → production | Push to `main`; no schema, API, or auth surface changed | Client bundle only |

---

## Threat Register

Declared threats come from the `<threat_model>` blocks in 15-01..15-03 PLAN.md.

| Threat ID | Category | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|----------|-------------|------------------------|--------|
| T-15-01 | Spoofing | high | mitigate | `saveAddress` sends `credentials: "same-origin"` to `/api/account/addresses` or `PUT .../[id]` only; `AddAddressDialog` has no `fetch` of its own, routes through the same helper via `AddressForm` | closed |
| T-15-02 | Information Disclosure | high | mitigate | No `localStorage`/`sessionStorage`/`console.*` across the nine scoped files (grep, zero matches) | closed |
| T-15-03 | Tampering | high | mitigate | `onChange` returns before any state write when the sentinel is selected; `nextAddressSelection` refuses `ADD_NEW_ADDRESS_VALUE` as `preferredId`; `facts.shippingAddress` derives only from an `addressId` lookup, which can never resolve to the sentinel | closed |
| T-15-04 | Elevation of Privilege | high | mitigate | Dialog renders only inside `isLoaded && isSignedIn && !setup`; `handleAddressSaved`'s `live()` guard re-checks the owner after every await before any `setState` | closed |
| T-15-05 | Tampering | medium | mitigate | Default-clearing reads `is_default` from the server's returned address, never from submitted form state | closed |
| T-15-06 | Elevation of Privilege | high | mitigate | `app/api/account/addresses/*` unchanged (Clerk `auth()` + `hasSameOrigin` on every mutating handler); the one touched API file (`setup-intent/route.ts`, CR-01) changes only a numeric bound, no auth/authz/route-shape change | closed |
| T-15-07 | Information Disclosure | medium | mitigate | Post-save refresh reuses `fetchSavedAddressesForPlan`, the same validator as initial load | closed |
| T-15-08 | Tampering | high | mitigate | Every review-fix and both review iterations land before the push commit; nine-gate CI-mirroring suite green on the exact pushed tree | closed |
| T-15-09 | Information Disclosure | medium | mitigate | Production checks are anonymous GETs only; asset fingerprint after deploy matches the SUMMARY's recorded value, confirming the audited code is what serves production | closed |
| T-15-10 | Denial of Service | low | accept | A failed Workers Build leaves the previous version serving; no manual-deploy fallback exists to be misused | closed |
| T-15-SC | Tampering (package manager) | high | mitigate | `package.json`/`package-lock.json` untouched across the whole phase | closed |

No XSS: no `dangerouslySetInnerHTML` in any scoped file; all address text renders through JSX text interpolation. Guest (signed-out) branch byte-identical to the phase base.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-01 | T-15-10 | A failed Workers Build leaves the previous version live; the deploy check polls and halts rather than forcing a manual `deploy` path the project forbids. | Claude (autonomous run, Russell's standing instruction) | 2026-09-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-11 | 11 | 11 | 0 | gsd-security-auditor (L1 config; L2 depth on sentinel/owner-guard/CR-01 diff; live production fingerprint check) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** Claude, autonomous run 2026-09-11 (Russell to confirm AR-15-01 and the four human-check items at the milestone review)
