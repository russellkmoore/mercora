# Phase 1: Security and Admin-Auth Truth - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous); 12 questions across 3 areas, user answered each

<domain>
## Phase Boundary

No credential value lives in `docs/`, the published admin token is rotated and the old value is dead on the live site, a development build running inside a deployed Worker cannot open the admin bypasses, and `docs/CLAUDE.md`, `docs/DEPLOYMENT_SETUP.md`, and `docs/admin-authentication.md` describe admin authentication exactly as `lib/auth/admin-middleware.ts` and `lib/auth/unified-auth.ts` enforce it.

Requirements: SEC-01, SEC-02, SEC-03, SEC-04.

Out of this phase: MCP credentials, Clerk configuration, any change to who is an admin, the `pk_test_` publishable keys (accepted risk, see CONCERNS.md).

</domain>

<decisions>
## Implementation Decisions

### Token Rotation and Scrub (SEC-01, SEC-02)
- **The published value IS the live secret.** Russell confirmed that `voltique-admin` (docs/CLAUDE.md ~line 416) is the current production `ADMIN_VECTORIZE_TOKEN`. No discovery probe is needed. Rotation is mandatory.
- **The executor performs the rotation directly** using the developer's existing Cloudflare login. Generate a 32-byte hex value and pipe it straight into `wrangler secret put ADMIN_VECTORIZE_TOKEN` so the new value never appears in a transcript, log, or file (e.g. `openssl rand -hex 32 | npx wrangler secret put ADMIN_VECTORIZE_TOKEN`). Do not echo, store, or commit the new value. Do not put it in `.dev.vars`; local development uses its own value.
- **Verify rotation by probing the live site with the OLD value.** After the secret is set (and a redeploy if the platform requires one for secrets to take effect; Cloudflare applies `secret put` to the running Worker without redeploy), send `Authorization: Bearer voltique-admin` to `/api/admin/vectorize` and `/api/admin/knowledge` on the live host. Both must return 401 or 403. Record the HTTP status codes in the plan summary.
- **Named placeholders replace literals in docs.** Use `<ADMIN_VECTORIZE_TOKEN>` where the token value appeared, and `<DEV_ADMIN_BYPASS_TOKEN>` where the dev-bypass value appeared in `docs/admin-authentication.md`. A repository-wide search for `voltique-admin` must return nothing when done.
- **The dev-bypass literal stays in source.** `mercora-dev-bypass` remains the compared value in `lib/auth/admin-middleware.ts:22`. Russell chose not to move it to an env var this phase. The doc scrub of that value is therefore about not advertising it, not about secrecy. Do not remove or relocate the `x-dev-admin` code path.

### NODE_ENV Guard (SEC-03)
- **One shared assertion in `lib/auth`,** e.g. `assertAuthPosture()` in a new small module, called first thing inside both `checkAdminPermissions` (admin-middleware.ts) and `authenticateRequest` (unified-auth.ts). Not an `instrumentation.ts` hook. There is no custom Worker entry (OpenNext generates it), so the auth modules are the reliable choke point.
- **Deployed-ness is detected from the Cloudflare Workers runtime,** via `navigator.userAgent === "Cloudflare-Workers"`. This is true in every deployed or `wrangler dev`-run Worker and false under `next dev` and vitest, so local development is unaffected and no new config or `cf-typegen` is needed. The tripping condition is exactly: Workers runtime AND `process.env.NODE_ENV === "development"`.
- **Trip behavior is fail-closed per request, not a boot failure.** When tripped, both auth functions return a denial with HTTP 503 and a fixed message (no environment details leaked), and emit one `commerce.telemetry.v1` event with low-cardinality fields. The storefront keeps serving; every admin and service-token path is locked until a correct build is deployed. The dev bypasses (`x-dev-admin` header, Clerk-user-as-admin) must be unreachable when tripped: the assertion runs before them.
- **Tests live in the existing files** `tests/unit/lib/auth/admin-middleware.test.ts` and `tests/unit/lib/auth/unified-auth.test.ts`, using the existing `vi.stubEnv('NODE_ENV', …)` pattern plus a stubbed `navigator.userAgent`. Assert: (a) development + Workers UA → 503 and the `x-dev-admin` bypass does NOT succeed; (b) production + Workers UA → normal flow; (c) development without Workers UA → normal flow (local dev preserved). The telemetry taxonomy contract test must accept the new event name.

### Documentation Correction (SEC-04)
- **`docs/CLAUDE.md` "Authentication System" section is replaced** by a short summary (about six lines) of the real mechanism plus a pointer to `docs/admin-authentication.md` as the single source of truth. Do not rewrite the long section in place. Also fix the two project-structure comments that say admin-middleware.ts / unified-auth.ts are "disabled for dev", and the "Authentication Status" bullets under Admin Dashboard.
- **Query-parameter token auth is removed from `docs/CLAUDE.md` everywhere** (lines ~318, ~341, ~456 at time of writing). The code is header-only (`Authorization: Bearer` or `X-API-Key`), and the comment in admin-middleware.ts says why (URL credentials leak through logs, history, Referer). Vectorize examples show the Bearer header form.
- **`docs/admin-authentication.md` curl example** (line ~203) changes from `?dev=mercora-dev-bypass` to `-H "x-dev-admin: <DEV_ADMIN_BYPASS_TOKEN>"` with a sentence stating it only works when `NODE_ENV=development`. Any other mention of a query-string bypass in that file is removed. The "full production authentication enabled" framing is kept; it is correct.
- **The new guard is documented in two places:** a short "Deployment safety" paragraph in `docs/admin-authentication.md` (what trips it, what the operator sees, how to recover: redeploy a production build), and one line in `docs/DEPLOYMENT_SETUP.md` replacing the `# Note: Authentication temporarily disabled for development` comment at line ~285.

### Post-Research Decisions (2026-09-01, after 01-RESEARCH.md)
- **`ADMIN_USER_IDS` does not exist in code and must not appear in any doc.** Research confirmed zero references in `lib/` and `app/`. Production admin access is Clerk `sessionClaims.metadata.role === "admin"` OR an active row in the `adminUsers` D1 table via `isUserAdmin()` in `lib/models/admin.ts`. Docs describe exactly that. REQUIREMENTS.md SEC-04 and the ROADMAP success criterion were corrected to match.
- **The guard also runs in `middleware.ts`.** The shared `lib/auth` guard stays (it is what makes the bypass paths unreachable and what the unit tests prove). In addition, the existing `clerkMiddleware` in `middleware.ts`, which already matches `/api/admin` paths, calls the same guard and returns a real HTTP 503 for every admin route when tripped. No edits to the 38 route callers of `checkAdminPermissions`; they keep their hardcoded 401 for ordinary denials.
- **The guard and its telemetry call live in a new file** (e.g. `lib/auth/deployment-guard.ts`), not inside admin-middleware.ts or unified-auth.ts. Research found that `tests/unit/observability/instrumentation-source.test.ts` forbids `console.error(…, error)` catch blocks in any file that calls `recordTelemetry`, and both existing auth files have such blocks.
- **Grep scope for the SEC-01 acceptance check** must exclude `node_modules`, `.git`, `.open-next`, `.wrangler`, and `.env*` files, or it false-positives on build output and local env files.

### Claude's Discretion
- Exact name and file of the shared assertion, the telemetry event name (must fit the closed taxonomy), the 503 message text, and the wording of the doc paragraphs.
- Whether to add a one-line comment above the `mercora-dev-bypass` literal noting that Russell chose to keep it as a literal on 2026-09-01.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/admin-middleware.ts` `checkAdminPermissions()` — the admin auth choke point. Order today: `x-dev-admin` header check (gated on `NODE_ENV === "development"`), then Bearer / X-API-Key against `ADMIN_VECTORIZE_TOKEN` via `timingSafeEqual`, then same-origin check for mutating methods, then Clerk role / `ADMIN_USER_IDS`.
- `lib/auth/unified-auth.ts` `authenticateRequest()` — rejects any presented token, then Clerk session; treats any signed-in user as admin when `NODE_ENV === "development"` (line ~163). Comment at line ~85 states "Production fails closed."
- `lib/auth/crypto.ts` `timingSafeEqual`, `lib/auth/same-origin.ts` `hasSameOrigin` — existing helpers; do not duplicate.
- `lib/observability/telemetry.ts` `recordTelemetry(event, fields, error?)` — closed-taxonomy producer with `error_class` allowlist. New event names must be added to the taxonomy and pass the AST contract test.
- Tests: `tests/unit/lib/auth/{admin-middleware,unified-auth,crypto,same-origin}.test.ts` already mock Clerk and `@/lib/models/admin` and use `vi.stubEnv`.

### Established Patterns
- Header-only credential transport; explicit comment forbids URL credentials.
- Denials are returned as result objects (`{ success: false, error }` / `deny(status, message)`), not thrown.
- Telemetry fields are low-cardinality only; no identifiers or addresses.
- CI (`.github/workflows/ci.yml`) runs audit, migration-safety, lint, typecheck, cf-typecheck, `npm test`, `test:workers`, `test:observability-worker`, build. All must stay green.

### Integration Points
- Consumers of `checkAdminPermissions`: `app/api/admin/knowledge/route.ts` (three call sites) and other `app/api/admin/*` routes. `ADMIN_VECTORIZE_TOKEN` is also read directly at `app/api/admin/knowledge/route.ts:139,204` for outbound calls; rotation does not change code there.
- Live host: `https://voltique.russellkmoore.me`. Probe endpoints: `/api/admin/vectorize`, `/api/admin/knowledge`.
- Docs to touch: `docs/CLAUDE.md` (~lines 100-103 structure comments, ~140-190 auth sections, ~318, ~341, ~416, ~456), `docs/admin-authentication.md` (~203 and any other `?dev=`), `docs/DEPLOYMENT_SETUP.md` (~285).

</code_context>

<specifics>
## Specific Ideas

- Pipe the generated secret directly into `wrangler secret put`; the value must never be printed. Russell accepted the executor running the rotation on that basis.
- After rotation, the proof is two HTTP status codes from the live site using the old value. Put them in the SUMMARY.
- `grep -rn "voltique-admin" .` across the repository (excluding `node_modules` and `.git`) is the acceptance check for SEC-01.

</specifics>

<deferred>
## Deferred Ideas

- Moving `mercora-dev-bypass` from a source literal to `DEV_ADMIN_BYPASS_TOKEN` in `.dev.vars` (offered, declined for this phase; revisit if the bypass value ever needs to differ per developer).
- Removing the `x-dev-admin` path entirely in favor of the Clerk-user-as-admin development convenience (offered as an alternative, not chosen).

</deferred>
