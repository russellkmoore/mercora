---
phase: "9"
slug: "gift-card-catalogue"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-08"
---

# Phase 9 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repo seed file → local / production D1 | Hand-written SQL literals executed verbatim by `wrangler d1 execute`; the production apply runs under an operator wrangler login outside the migration gate | Catalogue rows (public product data), tax code literal |
| seeded `tax_category` → checkout quote | The seeded string is what `lib/services/checkout-pricing.ts` validates and forwards to Stripe | Tax classification |
| stored variant → public projection | `toPublicVariant` drops internal fields before data reaches a browser | cost, barcode, inventory (internal) |
| paid order items → inventory ledger | `aggregateOrderDemand` decides which lines mutate stock | Order lines |
| developer machine → public R2 bucket | `wrangler r2 object put --remote` publishes to world-readable `voltique-images` | One catalogue image |
| Workers AI output → committed asset | Model output is committed only after inspection | Image bytes |
| committed seed file → applied SQL | The `sed` slice between sentinels is what executes | SQL text |
| docs → next operator | `docs/DEPLOYMENT_SETUP.md` Step 2 is the documented seed-apply path | Commands, binding name only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | `data/d1/seed.sql` positional `product_variants` VALUES list | high | mitigate | Column list copied from the existing insert; scratch-D1 read-back returned `tax_category=txcd_00000000` and `json_extract(inventory,'$.track_inventory')=0` for all four variants (09-01-SUMMARY); production read-back matched (09-04-SUMMARY, 09-VERIFICATION) | closed |
| T-09-02 | Tampering | Unescaped apostrophe in description copy | medium | mitigate | Apostrophes doubled; a missing quote and a literal `--` were caught by the scratch-D1 apply before commit and fixed (09-01 deviation); code review re-parsed every JSON column | closed |
| T-09-03 | Tampering | `tax_category` data value | high | mitigate | `txcd_00000000` on `prod_33` and `variant_33..36`; `tests/unit/data/seed-gift-card.test.ts` and `product-serializer.test.ts` re-run the checkout regex `/^txcd_\d{8}$/` against the seeded literal | closed |
| T-09-04 | Denial of Service | Broken sentinel comments producing an empty or whole-file slice | medium | mitigate | Guard test asserts the slice is non-empty, shorter than the file, holds exactly three `INSERT OR IGNORE` statements, and (after WR-01) in products → product_variants → pricing order | closed |
| T-09-05 | Information Disclosure | `toPublicVariant` stripping of cost, barcode, inventory | medium | mitigate | `product-serializer.test.ts` `giftCardFixture()` asserts the strip for the gift-card shape | closed |
| T-09-06 | Tampering | Silent widening of `isGiftCardOrderLine` | high | mitigate | `inventory-adjustments.test.ts` asserts the predicate both ways (customization present → skipped; absent → decremented) via a hand-written D1 fake | closed |
| T-09-07 | Tampering | `tax_category` regressing to a rejected or taxed value | high | mitigate | Same regex assertion as T-09-03 in the serializer test; production read-back confirms the live value | closed |
| T-09-08 | Information Disclosure | R2 upload to the public bucket | high | mitigate | Exactly one object put by explicit `--file` to `products/gift-card-33.png` (09-03-SUMMARY); candidates stayed under `/tmp` and were never uploaded or committed | closed |
| T-09-09 | Tampering | Wrong object key under a name the storefront points at | medium | mitigate | Key equals the seeded `primary_image` path; `curl -I` on the public URL returned 200 / image/jpeg / 384813 bytes (09-03, 09-VERIFICATION) | closed |
| T-09-10 | Spoofing | Invented lettering or a logo reading as a brand mark | medium | mitigate | Prompt forbade text/logos/numerals; executor and verifier both inspected the image; Russell confirmed at UAT (09-UAT.md) | closed |
| T-09-11 | Elevation of Privilege | Creating a new API token for Workers AI or R2 | high | mitigate | No token created; existing wrangler OAuth login used; `git status` on credential-bearing paths clean; no secret value in any commit | closed |
| T-09-12 | Tampering | Remote apply pointed at the whole `seed.sql` | high | mitigate | Apply used the sed slice (20 lines vs 403) with a pre-apply guard: non-empty, three statements, shorter than the file (09-04-SUMMARY) | closed |
| T-09-13 | Tampering | Remote apply targeting the wrong database | high | mitigate | Database name `mercora-db` is the `DB` binding in `wrangler.jsonc`; read-back against the same target returned `prod_33` + 4 variants + 1 pricing row | closed |
| T-09-14 | Tampering | Replay duplicating or overwriting rows | medium | mitigate | Every statement is `INSERT OR IGNORE`; replay proven on scratch D1; production read-back shows exactly four variant rows | closed |
| T-09-15 | Elevation of Privilege | Deploy or migration run as a side effect | high | mitigate | No `deploy*` or `db:migrate:*` invoked; `migrations/` untouched (`git diff ae255f5..HEAD -- migrations` empty); decision checkpoint stated only five rows land | closed |
| T-09-16 | Information Disclosure | Credential or account identifier in the runbook | high | mitigate | `docs/DEPLOYMENT_SETUP.md` names only the public binding and file path; no account id, database id, or key material; `docs:lint` green | closed |
| T-09-SC | Tampering | npm/pip/cargo installs (supply chain) | high | accept | No package-manager install task existed in this phase; `package.json` / lockfile unchanged | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-SC | No dependency was added or upgraded in Phase 9; the Package Legitimacy Audit is not applicable. Dependency review remains scheduled for 2026-12-01 (`docs/dependency-security.md`). | Planner (plan-time disposition), confirmed at secure-phase | 2026-09-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-08 | 17 | 17 | 0 | gsd-secure-phase (L1 short-circuit: register authored at plan time, evidence from SUMMARY/VERIFICATION/UAT and test files) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-08
