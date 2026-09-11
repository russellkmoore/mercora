---
phase: "16"
slug: "blog-surfacing"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-11"
---

# Phase 16 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run by gsd-security-auditor (read-only verdict) against HEAD `624dd4d`; this file persisted by the orchestrator.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| anonymous browser → header/home page | `Header.tsx`/`app/page.tsx` server-resolve blog visibility and content once, pass booleans/strings/derived excerpts to client components | Nav label, show/hide boolean, article title/date/cover/excerpt (never `html`) |
| admin browser → `/api/admin/settings` | Existing generic route, admin-gated, refuses the honor-guard key; the Content tab's five `content.*` keys ride the same batch | Nav label, block toggle, heading, count, placement |
| `admin_settings` → storefront readers | `getContentSettings()` / `lib/content/normalize-client.ts` both independently clamp/default every key | Sanitized settings values only |

---

## Threat Register

Declared threats come from the `<threat_model>` blocks in 16-01..16-04 PLAN.md.

| Threat ID | Category | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|----------|-------------|------------------------|--------|
| T-16-01 | Denial of Service | medium | mitigate | `resolveContentCount` clamps unconditionally to 1-6 | closed |
| T-16-02 | Tampering | high | mitigate | `resolveBlogExcerpt` strips tags/decodes entities before any render; no `dangerouslySetInnerHTML` in `BlogHighlights.tsx` | closed |
| T-16-03 | Tampering | medium | mitigate | `resolveContentEnum` tests membership via `.includes()` | closed |
| T-16-04 | Information Disclosure | medium | mitigate | `includeHtml` opt-in on `getPublishedBlogPosts`, default false; only `app/page.tsx` passes `true`; RSS/admin-list/blog-index/detail/Header all omit it | closed |
| T-16-05 | Information Disclosure | low | mitigate | Telemetry sends `{ outcome: "invalid" }` only, no stored value | closed |
| T-16-06 | Denial of Service | medium | mitigate | `readContentSettings()` fails to `{}` on D1 error | closed |
| T-16-11 | Information Disclosure | high | mitigate | Header collapses the existence check to a boolean before it reaches `HeaderClient`; the CR-01 fix also fails safe on rejection | closed |
| T-16-12 | Tampering | low | mitigate | Nav label is a JSX text child at both desktop and mobile sites | closed |
| T-16-13 | Denial of Service | low | accept | Published-status index exists; per-request read accepted (Phase 7 precedent) | closed |
| T-16-14 | Tampering | low | mitigate | Nav label falls back to "Blog" for empty/over-60-char values | closed |
| T-16-21 | Tampering | high | mitigate | Same excerpt sanitization chain as T-16-02, consumed by the home block | closed |
| T-16-22 | Tampering | low | mitigate | Block heading rendered as JSX text | closed |
| T-16-23 | Denial of Service | medium | mitigate | Clamped count passed in, re-clamped again at the model layer independently | closed |
| T-16-24 | Information Disclosure | medium | mitigate | `BlogHighlights.tsx` is server-only; renders derived excerpt, never raw `html` | closed |
| T-16-25 | Information Disclosure | high | mitigate | Locked `status='published' AND publishedAt<=now` filter unchanged | closed |
| T-16-31 | Elevation of Privilege | high | mitigate | `checkAdminPermissions` gates the settings route before any DB access | closed |
| T-16-32 | Tampering | high | mitigate | The honor-guard key refusal rejects the whole batch, including a smuggled `content.*` + guard-key mix | closed |
| T-16-33 | Tampering | medium | mitigate | All five `content.*` keys ride the one shared save batch | closed |
| T-16-34 | Input Validation | medium | mitigate | Admin tab imports the shared bound constants, never retypes them | closed |
| T-16-35 | Elevation of Privilege | high | transfer | Transferred to the Phase 14 admin session gate (`middleware.ts` + `checkAdminSession()`) | closed |
| T-16-36 | Information Disclosure | low | accept | The five seeded settings rows carry no PII, secret, or balance | closed |

WR-01/WR-03 cross-check: `lib/content/normalize-client.ts` mirrors `lib/content/settings.ts`'s clamps exactly, confirmed by direct read plus a 22-case parity test.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-16-01 | T-16-13 | A per-request D1 read for the header's blog-existence check is accepted per the Phase 7 precedent; a status index exists and the query is `limit:1`. | Claude (autonomous run, Russell's standing instruction) | 2026-09-11 |
| AR-16-02 | T-16-36 | The five `content.*` settings rows hold only display configuration, no sensitive data. | Claude (autonomous run) | 2026-09-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-11 | 21 | 21 | 0 | gsd-security-auditor (L1; scope-boundary diff check confirmed no out-of-phase files touched) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** Claude, autonomous run 2026-09-11 (Russell to confirm AR-16-01/02 and the human-check items at the milestone review)
