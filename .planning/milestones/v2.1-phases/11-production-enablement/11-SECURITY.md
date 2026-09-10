---
phase: "11"
slug: "production-enablement"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-09"
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| developer shell → Cloudflare secret store | `openssl rand` output piped straight into `wrangler secret put` under Russell's OAuth login | Key-ring values (never materialised) |
| developer shell → `.dev.vars` | Separate dev key values appended by pipeline; file is gitignored | Dev key values (names only ever inspected) |
| `wrangler.jsonc` → Workers Builds → production Worker | Public string flags deployed on push to `main` | Feature flags (public by design) |
| docs / `.env.example` → next operator | Recipe and placeholders; no value, account id, or database id | Prose, placeholders |
| production cron → key-ring parsers | Every 5-minute tick parses the delivery ring | Ring health signal (`cron.recovery_failed`) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Information Disclosure | `openssl rand` output in Task 1 | high | mitigate | Value exists only inside a `$(...)` substitution feeding `printf` into an append redirect. No shell variable, no standalone generator invoca… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-02 | Information Disclosure | `.dev.vars` vs git | high | mitigate | `git check-ignore -v .dev.vars` runs BEFORE the file is created and must resolve to `.gitignore`; `git status --porcelain -- .dev.vars` must… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-03 | Tampering | Wrong-shaped ring reaching production | high | mitigate | Task 2 pins both accept-shapes and three reject-shapes against the real frozen parsers before plan 11-04 runs a single production command. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-04 | Information Disclosure | Test fixtures | low | mitigate | Fixtures are derived with `btoa` over a repeated ASCII character, so no long opaque literal that reads like a real key enters the repository… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this phase (11-RESEARCH.md "Package Legitimacy Audit: not applicable"). No new dependency is added… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-05 | Information Disclosure | `.env.example` placeholders | high | mitigate | Placeholder payloads are hyphenated English words, enforced by an acceptance criterion that no unbroken 20-plus-character base64 run exists … — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-06 | Spoofing | A placeholder mistaken for a working secret | medium | mitigate | The delivery placeholder is rejected by the parser until replaced, proven by Task 2. The HMAC placeholder's accept-as-written behavior is st… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-07 | Tampering | Documented shape drifting from enforced shape | medium | mitigate | Task 2 reads the committed file and feeds it through the real parsers, so a parser change or an example edit breaks CI rather than a develop… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-08 | Information Disclosure | Local env file handling | medium | mitigate | This plan never reads, moves, or names the local env file; the only local file it discusses is `.dev.vars`, which `.gitignore` covers (prove… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task in this phase; no new dependency to vet. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-09 | Information Disclosure | Section 9's secret commands | high | mitigate | Section 9 documents only the substitution form, where the value exists solely inside a command substitution feeding one stdin. An acceptance… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-10 | Information Disclosure | Either document containing a real key | high | mitigate | No value, account id, database id, or worker id is written. Noted explicitly: the docs linter matches UUID and Stripe shapes only and would … — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-11 | Repudiation | A verification step that cannot detect failure | medium | mitigate | Step 3 names the signal the code actually emits — the recovery-cron drain — and states plainly that the public balance endpoint is opaque by… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-12 | Elevation of Privilege | Documented flag order encouraging the wrong sequence | medium | mitigate | Steps 2 through 4 fix the order and give the code-level reason: acquisition without reconciliation throws at capability resolution. Step 5 d… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-13 | Tampering | Machine-local deploy instruction bypassing the CI migration gate | medium | mitigate | Acceptance criterion requires zero machine-local deploy script mentions inside section 9; the documented deploy action is a push to `main`. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task in this phase; no new dependency to vet. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-14 | Information Disclosure | `openssl rand` output in Task 1 | critical | mitigate | Value lives only inside a command substitution feeding one stdin. No variable, no file, no standalone generator call, `set +x`, no read-back… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-15 | Information Disclosure | A key value reaching git and then GitHub | critical | mitigate | Task 3 scans the added lines of every pushed commit, scoped to the four config and docs paths, for a key-shaped base64 run and requires zero… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-16 | Denial of Service | A malformed ring failing the recovery cron every five minutes | high | mitigate | The shape was proven against the real parsers in 11-01 before any production command; Task 3 then watches one live cycle for the drain succe… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-17 | Information Disclosure | Secret names leaking into `cloudflare-env.d.ts` via local env files | medium | mitigate | Both `.dev.vars` and the local env file are moved out of the tree around `cf-typegen` and `cf-typecheck`, and an acceptance criterion requir… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-18 | Elevation of Privilege | Flags applied in the wrong order | high | mitigate | Only reconciliation is added in this plan, and an acceptance criterion requires zero occurrences of the acquisition flag name in `wrangler.j… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-19 | Tampering | Deploying Phase 10's unverified checkout code | high | accept | Accepted by Russell on 2026-09-08 ("Push as planned", D-08). The push carries roughly 87 commits including Phase 10's checkout work whose hu… — accepted — Russell, 2026-09-08 ('Push as planned'); the reconciliation push deployed Phase 10 (11-04-SUMMARY) | closed |
| T-11-20 | Information Disclosure | The production tail capture file | medium | mitigate | Written under the system temp directory, never inside the repository, and deleted immediately after the assertion runs. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task in this phase; no new dependency to vet. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-21 | Elevation of Privilege | Acquisition enabled without a human decision | critical | mitigate | `gate="blocking-human"` on the D-07 checkpoint, which is never auto-approved in any mode including an unattended run; Task 2 additionally ca… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-22 | Elevation of Privilege | An inconsistent flag pair reaching production | high | mitigate | Acceptance criteria require both flags present as the string `"true"` with reconciliation first; the code independently throws at capability… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-23 | Tampering | Selling through a purchase flow no human has walked | high | accept | Accepted only if Russell chooses `enable-anyway` at D-07, with the deferred verification stated plainly in the checkpoint copy. Reversible i… — accepted — Russell chose `enable-anyway` at D-07 on 2026-09-09 (11-05-SUMMARY); Phase 10 UAT remains deferred | closed |
| T-11-24 | Information Disclosure | Secret names leaking into `cloudflare-env.d.ts` | medium | mitigate | Both local env files are moved out of the tree around `cf-typegen` and `cf-typecheck`, with an acceptance criterion requiring zero gift-card… — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-25 | Information Disclosure | A key value reaching git across the whole phase | critical | mitigate | Task 3 re-runs the scoped added-line scan across the entire phase range after everything is pushed, not just per-plan. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-26 | Tampering | The phase silently editing code it was scoped out of | medium | mitigate | Task 3 asserts the phase's diff touches no path under `lib/gift-cards/`, `lib/services/`, `app/api/`, `lib/commerce/`, or `migrations/`. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task in this phase; no new dependency to vet. — closed — mitigation present; evidence in the owning plan's SUMMARY (acceptance criteria re-run) and 11-VERIFICATION.md (leak scans 0, names-only secret list, gitignore proof, fence diff empty, cron cycle clean) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-19 | The reconciliation push deployed every unpushed commit including Phase 10's checkout; demo site, reversible by revert. | Russell ("Push as planned") | 2026-09-08 |
| AR-11-02 | T-11-23 | Acquisition enabled while Phase 10's human verification is deferred; demo site, reversible by flag. | Russell (`enable-anyway` at D-07) | 2026-09-09 |
| AR-11-03 | T-11-SC | No package-manager install in this phase; dependency review stays scheduled for 2026-12-01. | Planner disposition, confirmed at secure-phase | 2026-09-09 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 31 | 31 | 0 | gsd-secure-phase (L1 short-circuit: register authored at plan time; evidence from SUMMARY/VERIFICATION/UAT) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
