# Phase 1: Security and Admin-Auth Truth - Research

**Researched:** 2026-09-01
**Domain:** Cloudflare Workers runtime detection, Wrangler secrets, closed-taxonomy telemetry, documentation truth
**Confidence:** HIGH (all six research questions verified against source code, workerd source, or official docs — no new packages, no unverifiable claims)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Token Rotation and Scrub (SEC-01, SEC-02)**
- The published value IS the live secret. Russell confirmed that `voltique-admin` (docs/CLAUDE.md ~line 416) is the current production `ADMIN_VECTORIZE_TOKEN`. No discovery probe is needed. Rotation is mandatory.
- The executor performs the rotation directly using the developer's existing Cloudflare login. Generate a 32-byte hex value and pipe it straight into `wrangler secret put ADMIN_VECTORIZE_TOKEN` so the new value never appears in a transcript, log, or file (e.g. `openssl rand -hex 32 | npx wrangler secret put ADMIN_VECTORIZE_TOKEN`). Do not echo, store, or commit the new value. Do not put it in `.dev.vars`; local development uses its own value.
- Verify rotation by probing the live site with the OLD value. After the secret is set (and a redeploy if the platform requires one for secrets to take effect; Cloudflare applies `secret put` to the running Worker without redeploy), send `Authorization: Bearer voltique-admin` to `/api/admin/vectorize` and `/api/admin/knowledge` on the live host. Both must return 401 or 403. Record the HTTP status codes in the plan summary.
- Named placeholders replace literals in docs. Use `<ADMIN_VECTORIZE_TOKEN>` where the token value appeared, and `<DEV_ADMIN_BYPASS_TOKEN>` where the dev-bypass value appeared in `docs/admin-authentication.md`. A repository-wide search for `voltique-admin` must return nothing when done.
- The dev-bypass literal stays in source. `mercora-dev-bypass` remains the compared value in `lib/auth/admin-middleware.ts:22`. Russell chose not to move it to an env var this phase. The doc scrub of that value is therefore about not advertising it, not about secrecy. Do not remove or relocate the `x-dev-admin` code path.

**NODE_ENV Guard (SEC-03)**
- One shared assertion in `lib/auth`, e.g. `assertAuthPosture()` in a new small module, called first thing inside both `checkAdminPermissions` (admin-middleware.ts) and `authenticateRequest` (unified-auth.ts). Not an `instrumentation.ts` hook. There is no custom Worker entry (OpenNext generates it), so the auth modules are the reliable choke point.
- Deployed-ness is detected from the Cloudflare Workers runtime, via `navigator.userAgent === "Cloudflare-Workers"`. This is true in every deployed or `wrangler dev`-run Worker and false under `next dev` and vitest, so local development is unaffected and no new config or `cf-typegen` is needed. The tripping condition is exactly: Workers runtime AND `process.env.NODE_ENV === "development"`.
- Trip behavior is fail-closed per request, not a boot failure. When tripped, both auth functions return a denial with HTTP 503 and a fixed message (no environment details leaked), and emit one `commerce.telemetry.v1` event with low-cardinality fields. The storefront keeps serving; every admin and service-token path is locked until a correct build is deployed. The dev bypasses (`x-dev-admin` header, Clerk-user-as-admin) must be unreachable when tripped: the assertion runs before them.
- Tests live in the existing files `tests/unit/lib/auth/admin-middleware.test.ts` and `tests/unit/lib/auth/unified-auth.test.ts`, using the existing `vi.stubEnv('NODE_ENV', …)` pattern plus a stubbed `navigator.userAgent`. Assert: (a) development + Workers UA → 503 and the `x-dev-admin` bypass does NOT succeed; (b) production + Workers UA → normal flow; (c) development without Workers UA → normal flow (local dev preserved). The telemetry taxonomy contract test must accept the new event name.

**Documentation Correction (SEC-04)**
- `docs/CLAUDE.md` "Authentication System" section is replaced by a short summary (about six lines) of the real mechanism plus a pointer to `docs/admin-authentication.md` as the single source of truth. Do not rewrite the long section in place. Also fix the two project-structure comments that say admin-middleware.ts / unified-auth.ts are "disabled for dev", and the "Authentication Status" bullets under Admin Dashboard.
- Query-parameter token auth is removed from `docs/CLAUDE.md` everywhere (lines ~318, ~341, ~456 at time of writing). The code is header-only (`Authorization: Bearer` or `X-API-Key`), and the comment in admin-middleware.ts says why (URL credentials leak through logs, history, Referer). Vectorize examples show the Bearer header form.
- `docs/admin-authentication.md` curl example (line ~203) changes from `?dev=mercora-dev-bypass` to `-H "x-dev-admin: <DEV_ADMIN_BYPASS_TOKEN>"` with a sentence stating it only works when `NODE_ENV=development`. Any other mention of a query-string bypass in that file is removed. The "full production authentication enabled" framing is kept; it is correct.
- The new guard is documented in two places: a short "Deployment safety" paragraph in `docs/admin-authentication.md` (what trips it, what the operator sees, how to recover: redeploy a production build), and one line in `docs/DEPLOYMENT_SETUP.md` replacing the `# Note: Authentication temporarily disabled for development` comment at line ~285.

### Claude's Discretion
- Exact name and file of the shared assertion, the telemetry event name (must fit the closed taxonomy), the 503 message text, and the wording of the doc paragraphs.
- Whether to add a one-line comment above the `mercora-dev-bypass` literal noting that Russell chose to keep it as a literal on 2026-09-01.

### Deferred Ideas (OUT OF SCOPE)
- Moving `mercora-dev-bypass` from a source literal to `DEV_ADMIN_BYPASS_TOKEN` in `.dev.vars` (offered, declined for this phase; revisit if the bypass value ever needs to differ per developer).
- Removing the `x-dev-admin` path entirely in favor of the Clerk-user-as-admin development convenience (offered as an alternative, not chosen).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | No literal credential value remains in `docs/`; repo-wide search for previous values returns nothing | Exact line numbers for every occurrence located below (Doc Location Map). Grep-scoping pitfall documented — `.env.local` and `.open-next/` will false-positive a naive repo grep. |
| SEC-02 | Production `ADMIN_VECTORIZE_TOKEN` rotated; old value rejected (401/403) on live probe endpoints | `wrangler secret put` stdin-piping and immediate-effect behavior verified against Cloudflare docs and wrangler `--help`. Verified wrangler version 4.123.0 resolves from the `^4.120.0` package.json range. |
| SEC-03 | Deployed Worker fails closed when `NODE_ENV=development`; unit test proves it; production unaffected; CI green | `navigator.userAgent === "Cloudflare-Workers"` default-on date verified against workerd source. Vitest stubbing approach verified by running a real test. AST taxonomy contract test read in full — determines where the new telemetry call site can safely live. Existing `AdminAuthResult`/route-handler status-code wiring gap documented as a pitfall. |
| SEC-04 | Docs agree on the real admin-auth mechanism; no query-string bypass documented anywhere | Full read of `docs/admin-authentication.md`, and the relevant slices of `docs/CLAUDE.md` and `docs/DEPLOYMENT_SETUP.md`, with line numbers. **Critical finding:** `ADMIN_USER_IDS`, named in REQUIREMENTS.md's own SEC-04 text as part of "the real mechanism," does not exist anywhere in `lib/` or `app/` — see Common Pitfalls #1. |
</phase_requirements>

## Summary

This phase touches no new dependencies — it is a rotation, a runtime guard, and a documentation correction, all inside an existing, well-tested `lib/auth` module. The two structural risks are not about the technology being unfamiliar; they are about two locked decisions in CONTEXT.md running into constraints the codebase already has in place:

1. **The 503 status code is not free.** `unified-auth.ts`'s `authenticateRequest()` already returns a `NextResponse` with a dynamic status inside its `AuthResult`, so wiring 503 there is self-contained. `admin-middleware.ts`'s `checkAdminPermissions()` returns a plain `{ success, error }` object with **no status field**, and all ~36 of its callers hardcode `{ status: 401 }` on failure regardless of the reason. Getting an actual `503` onto the wire for admin-middleware-guarded routes means either touching those ~36 call sites, or accepting that the guard is proven at the unit-test level (which is what CONTEXT.md's own test list actually asserts) while the HTTP wire status stays 401. This needs a planner decision, documented below.

2. **`ADMIN_USER_IDS` does not exist in code.** REQUIREMENTS.md's own SEC-04 text, and CONTEXT.md's decisions, both describe production admin auth as "Clerk role, `ADMIN_USER_IDS`, or the bearer token." A full grep of `lib/` and `app/` (not just `docs/`) found zero references to `process.env.ADMIN_USER_IDS`. The actual production check in both `admin-middleware.ts` and `unified-auth.ts` is Clerk `sessionClaims.metadata.role === "admin"` OR a database-backed lookup (`isUserAdmin()` against the `adminUsers` table). Writing "`ADMIN_USER_IDS`" into `docs/admin-authentication.md` as instructed would re-introduce the exact class of error (documenting something the code does not do) that SEC-04 exists to eliminate. This is flagged prominently below and needs a decision before the doc-truth task is written.

Everything else — the Workers-runtime detection mechanism, `wrangler secret put` semantics, the telemetry taxonomy contract, and the exact doc line numbers — is verified and ready to plan directly.

**Primary recommendation:** Build the shared assertion as a new, small module (e.g. `lib/auth/deployment-guard.ts`) that owns both the `navigator.userAgent` check and the `recordTelemetry` call internally, and have `admin-middleware.ts`/`unified-auth.ts` call only a boolean-returning function from it — this avoids tripping the AST contract test's "no raw exception console logging" rule against the pre-existing `console.error("...", error)` catch-blocks in those two files (see Common Pitfall #3). Resolve the ADMIN_USER_IDS and 503-wiring questions before writing doc/status-code tasks.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin credential rotation | Cloudflare platform (Wrangler secrets) | — | Secrets never enter the app tier; `wrangler secret put` writes directly to the Workers control plane. |
| Deployed-build detection (`navigator.userAgent`) | API/Backend (Workers runtime) | — | Only meaningful inside the deployed Worker; must run before any auth branch, in the same request-handling tier as `checkAdminPermissions`/`authenticateRequest`. |
| Fail-closed denial response | API/Backend | — | `AdminAuthResult`/`AuthResult` are backend-tier contracts; the guard must live where those functions already run, not in a client component or middleware.ts (there is none — OpenNext generates the Worker entry). |
| Telemetry emission | API/Backend (`lib/observability/telemetry.ts`) | Database/Storage (Workers Analytics Engine, optional binding) | `recordTelemetry` already fails open and writes to console + an optional Analytics Engine binding; no new tier needed. |
| Documentation truth | N/A (docs, not runtime) | — | Pure content correction; must be verified against the backend tier's actual code, not the other way around. |

## Standard Stack

No new runtime dependencies are introduced by this phase.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wrangler | `4.123.0` (resolves from `^4.120.0` in package.json) [VERIFIED: `npx wrangler --version`] | Secret rotation, deploy | Already the project's only deploy tool. |
| vitest | `4.1.10` [VERIFIED: package.json devDependencies] | Guard unit tests | Existing test runner; `tests/unit/lib/auth/*.test.ts` already use it. |
| typescript (`ts` package, via `tests/unit/observability/instrumentation-source.test.ts`) | pinned by `typescript@^6.0.3` [VERIFIED: package.json] | AST-based taxonomy contract test | Already used to parse `app/`, `lib/`, `worker.ts` for `recordTelemetry(...)` call sites. |

### Supporting (system tools, not npm packages)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `openssl rand -hex 32` | Generate the new `ADMIN_VECTORIZE_TOKEN` value | Piped directly into `wrangler secret put`; never written to a file or echoed. |
| `curl` | Post-rotation live probe with the old token value | Two calls: `/api/admin/vectorize`, `/api/admin/knowledge`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `navigator.userAgent === "Cloudflare-Workers"` | `process.env` inspection of a Workers-only binding (e.g. presence of `CF-*` binding) | Rejected by CONTEXT.md: navigator check requires no new config, no `cf-typegen`, and is already false under `next dev`/vitest by default. |
| Shared assertion in `lib/auth` | `instrumentation.ts` hook | Explicitly rejected in CONTEXT.md — no custom Worker entry exists; OpenNext generates it, so the auth modules are the only reliable choke point. |

**Installation:** None — no `npm install` needed for this phase.

## Package Legitimacy Audit

Not applicable. This phase installs no new npm packages. `openssl` and `curl` are system tools invoked via shell, not project dependencies.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────┐
                     │   Incoming admin request     │
                     └───────────────┬──────────────┘
                                     │
                     ┌───────────────▼──────────────┐
                     │  checkAdminPermissions() /    │
                     │  authenticateRequest()        │
                     │  (lib/auth/admin-middleware,   │
                     │   lib/auth/unified-auth)       │
                     └───────────────┬──────────────┘
                                     │  FIRST — before any bypass
                     ┌───────────────▼──────────────┐
                     │ assertDeploymentPosture()      │
                     │ (new: lib/auth/deployment-     │
                     │  guard.ts)                     │
                     │                                 │
                     │  navigator.userAgent ===        │
                     │   "Cloudflare-Workers"          │
                     │     AND                         │
                     │  process.env.NODE_ENV ===        │
                     │   "development"                 │
                     └───────┬────────────────┬───────┘
                       tripped│                │not tripped
                             ▼                ▼
                ┌────────────────────┐   ┌─────────────────────────┐
                │ recordTelemetry(     │   │ existing flow continues: │
                │  'auth.deployment_   │   │ x-dev-admin bypass check,│
                │   guard_tripped', …) │   │ Bearer/X-API-Key token,  │
                │ return 503 / deny    │   │ same-origin check, Clerk │
                │  (fixed message)     │   │ session, isUserAdmin DB  │
                └────────────────────┘   └─────────────────────────┘
```

### Recommended Project Structure
```
lib/auth/
├── admin-middleware.ts     # calls assertDeploymentPosture() first, unchanged otherwise
├── unified-auth.ts         # calls assertDeploymentPosture() first, unchanged otherwise
├── deployment-guard.ts     # NEW: owns navigator check + recordTelemetry call
├── crypto.ts               # unchanged, reused
├── same-origin.ts          # unchanged, reused
└── index.ts                # barrel; add deployment-guard export only if planner wants it public
```

### Pattern 1: Isolate the telemetry-emitting call site in its own file
**What:** The new guard's `recordTelemetry(...)` call lives inside `lib/auth/deployment-guard.ts`, a brand-new file, rather than being inlined into `admin-middleware.ts` or `unified-auth.ts`.
**When to use:** Any time a file that already contains a bare `console.error("...", error)` catch-block needs to start calling `recordTelemetry`.
**Why:** `tests/unit/observability/instrumentation-source.test.ts` scans every file in `app/`, `lib/`, and `worker.ts` for `recordTelemetry(...)` calls, and for any file where it finds at least one, it also asserts that file contains **no** `console.error(..., error)` / `console.warn(..., error)` call where the argument is literally named `error` [VERIFIED: tests/unit/observability/instrumentation-source.test.ts:40-54,77-82]. Both `admin-middleware.ts:93` (`console.error("Admin auth error:", error);`) and `unified-auth.ts:184` (`console.error("authenticateRequest error:", error);`) already contain exactly this pattern [VERIFIED: lib/auth/admin-middleware.ts:92-97, lib/auth/unified-auth.ts:183-186]. Adding a `recordTelemetry` call directly inside either file would make the AST contract test start checking that file — and it would immediately fail on the pre-existing catch-block. Keeping the call in a new file sidesteps this without touching either catch-block.
**Example:**
```typescript
// Source: verified pattern from tests/unit/observability/instrumentation-source.test.ts
// lib/auth/deployment-guard.ts (new file)
import { recordTelemetry } from '@/lib/observability/telemetry';

export function isDeployedDevelopmentBuild(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.userAgent === 'Cloudflare-Workers' &&
    process.env.NODE_ENV === 'development'
  );
}

export function assertDeploymentPosture(): { tripped: true; status: 503; message: string } | { tripped: false } {
  if (!isDeployedDevelopmentBuild()) return { tripped: false };
  recordTelemetry('auth.deployment_guard_tripped', {});
  return { tripped: true, status: 503, message: 'Service temporarily unavailable.' };
}
```

### Pattern 2: Register the new event in the closed taxonomy before calling it
**What:** `TELEMETRY_EVENTS` in `lib/observability/telemetry.ts` is a literal object keyed by event name; `recordTelemetry` looks up `TELEMETRY_EVENTS[event]` and silently returns `null` (no-op) if the key is missing [VERIFIED: lib/observability/telemetry.ts:236-238, quote: `const definition = TELEMETRY_EVENTS[event]; if (!definition) return null;`].
**When to use:** Always, before the first call site is written — otherwise `recordTelemetry` silently does nothing (fails open by design) and the AST contract test's "keeps every executable producer event in the closed taxonomy" check fails because the literal string used at the call site is not a key of `TELEMETRY_EVENTS` [VERIFIED: tests/unit/observability/instrumentation-source.test.ts:70-75].
**Example:**
```typescript
// Source: lib/observability/telemetry.ts:25-71 (existing pattern, new entry added)
export const TELEMETRY_EVENTS = {
  // ...existing entries...
  'auth.deployment_guard_tripped': { severity: 'critical', sampleRate: 1 },
} as const;
```
If severity is `'critical'`, the AST contract test's first assertion — "wires every critical taxonomy event into executable producer code" [VERIFIED: tests/unit/observability/instrumentation-source.test.ts:61-68] — additionally requires the literal string `'auth.deployment_guard_tripped'` to appear inside an actual `recordTelemetry(...)` call somewhere under `app/`, `lib/`, or `worker.ts`. The Pattern 1 call site satisfies this automatically since `lib/auth/deployment-guard.ts` is scanned by `sourceFiles('lib')`.

### Pattern 3: `navigator.userAgent` default-on since a compatibility date this project is far past
**What:** `navigator.userAgent === 'Cloudflare-Workers'` requires the `global_navigator` compatibility flag. This flag does **not** need to be listed explicitly in `wrangler.jsonc`'s `compatibility_flags` array.
**When to use:** Confirming the guard works without a `wrangler.jsonc` change.
**Verification:** workerd's own compatibility-date source lists this flag with an automatic enable date: `globalNavigator @11 :Bool $compatEnableFlag("global_navigator") $compatEnableDate("2022-03-21") $compatDisableFlag("no_global_navigator");` [VERIFIED: raw.githubusercontent.com/cloudflare/workerd/main/src/workerd/io/compatibility-date.capnp]. This project's `wrangler.jsonc` sets `"compatibility_date": "2026-08-01"` [VERIFIED: wrangler.jsonc:13], which is more than four years past the auto-enable date, so `navigator.userAgent` is available with no flag change required. `next dev` and vitest (Node.js) do not run inside workerd, so this check is `false` there by construction — Node 24 does have a global `navigator` object, but its `userAgent` reads `"Node.js/24"` [VERIFIED: `node -e "console.log(navigator.userAgent)"` → `Node.js/24`], never `"Cloudflare-Workers"`. No conflict with `nodejs_compat`/`nodejs_compat_populate_process_env` was found in Cloudflare's public issue tracker or docs; this specific interaction (does `nodejs_compat` override the global `navigator`) was not directly falsifiable from documentation alone — flagged as a residual open item below (recommend a one-line `console.log(navigator.userAgent)` smoke check on first live deploy).

### Pattern 4: Stubbing `navigator.userAgent` in Vitest (`environment: 'node'`)
**What:** `vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' })` followed by `vi.unstubAllGlobals()` in `afterEach`.
**Verification:** Ran a real test file (removed after confirming) using the project's actual `vitest.config.mts` (`environment: 'node'`): the stub-then-assert-then-unstub sequence passed with `1 passed (1)` [VERIFIED: executed `npx vitest run` against a scratch test file in this session]. Node 24's own `globalThis.navigator` property descriptor is `{ get: [Function], set: undefined, enumerable: true, configurable: true }` [VERIFIED: `Object.getOwnPropertyDescriptor(globalThis, 'navigator')` output in this session] — `configurable: true` is what makes `vi.stubGlobal` (which redefines the whole property) work even though the original has no setter.
**Example:**
```typescript
// Source: verified in this session against vitest.config.mts (environment: 'node')
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('deployment guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('trips under development + Workers UA', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
    // assert against checkAdminPermissions()/authenticateRequest() here
  });

  it('does not trip under development without Workers UA (local dev)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    // navigator left as Node's default ("Node.js/24"), not stubbed
  });
});
```

### Pattern 5: `wrangler secret put` — stdin piping and immediate effect
**What:** `openssl rand -hex 32 | npx wrangler secret put ADMIN_VECTORIZE_TOKEN` is a supported, documented non-interactive pattern; wrangler trims trailing whitespace/newlines from piped stdin before upload.
**Verification:** Cloudflare's own secrets documentation states `wrangler secret put` "creates a new version of the Worker and deploys it immediately" [CITED: developers.cloudflare.com/workers/configuration/secrets/] — this confirms CONTEXT.md's premise that no separate `npm run deploy` step is needed for the rotated secret to take effect; the command itself performs the deploy of a new Worker version carrying the updated secret binding (the currently-live code is not rebuilt, only the secret is updated). Non-interactive stdin piping (`echo "value" | wrangler secret put NAME`) is Cloudflare's own documented example pattern [CITED: Cloudflare workers-sdk secrets documentation, cross-referenced via WebSearch].
**Example:**
```bash
# Executor runs this directly; new value never appears in a transcript/log/file.
openssl rand -hex 32 | npx wrangler secret put ADMIN_VECTORIZE_TOKEN

# Verify rotation (must return 401 or 403 on BOTH):
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer voltique-admin" \
  https://voltique.russellkmoore.me/api/admin/vectorize
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer voltique-admin" \
  https://voltique.russellkmoore.me/api/admin/knowledge
```

### Anti-Patterns to Avoid
- **Running the SEC-01 acceptance grep unscoped:** `grep -rn "voltique-admin" .` from the repo root, as CONTEXT.md's own "Specifics" section suggests, will match two gitignored, non-doc files that are NOT part of what SEC-01 is scrubbing. See Common Pitfall #2.
- **Writing `ADMIN_USER_IDS` into `docs/admin-authentication.md` as "the real mechanism":** it isn't. See Common Pitfall #1.
- **Assuming the 503 status code reaches the HTTP client for every admin route automatically:** it does not, for the ~36 routes that call `checkAdminPermissions` and hardcode `{ status: 401 }`. See Common Pitfall #4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time secret comparison | A new comparator | `lib/auth/crypto.ts` `timingSafeEqual` (already imported by both admin-middleware.ts and unified-auth.ts) | Already hashes both sides with SHA-256 before comparing; reinventing this in the new guard module is unnecessary since the guard doesn't compare secrets at all — it compares a runtime UA string and an env var, both non-secret. |
| Origin validation | A new same-origin check | `lib/auth/same-origin.ts` `hasSameOrigin` | Already handles null/attacker-controlled Origin headers safely. Not touched by this phase. |
| Telemetry envelope construction | A hand-rolled `console.error(JSON.stringify(...))` | `lib/observability/telemetry.ts` `recordTelemetry` | Already enforces size bounds, closed error-class taxonomy, sampling, and safe serialization; a hand-rolled log line would bypass the AST contract test entirely and risk leaking fields. |

**Key insight:** Every primitive this phase needs (constant-time compare, origin check, telemetry envelope, admin-DB lookup) already exists and is already unit-tested. The only genuinely new code is a ~15-line guard function and its test cases.

## Common Pitfalls

### Pitfall 1: `ADMIN_USER_IDS` does not exist in the codebase — writing it into docs recreates the bug this phase fixes
**What goes wrong:** REQUIREMENTS.md's SEC-04 text and CONTEXT.md's decisions both describe production admin auth as enforced through "Clerk role, `ADMIN_USER_IDS`, or the bearer token." A repository-wide search of `lib/` and `app/` for `ADMIN_USER_IDS` returns **zero** matches outside of comments and planning docs [VERIFIED: `grep -rln "ADMIN_USER_IDS" lib/ app/` → no output].
**Why it happens:** `docs/admin-authentication.md` (lines 100, 124, 134) and a comment in `components/admin/AdminGuard.tsx:30` both describe `ADMIN_USER_IDS` as real, but the actual production check in both auth functions is:
- `lib/auth/admin-middleware.ts:64-77`: `isUserAdmin(userId)` (a DB query against the `adminUsers` table) with a Clerk-metadata-role fallback — no env var read anywhere in the function.
- `lib/auth/unified-auth.ts:161-165`: `const isAdmin = process.env.NODE_ENV === "development" || role === "admin" || await isUserAdmin(userId);` — again, no `ADMIN_USER_IDS` read.
- `lib/models/admin.ts:12-29` — `isUserAdmin` is a Drizzle query: `db.select().from(adminUsers).where(and(eq(adminUsers.userId, userId), eq(adminUsers.isActive, true)))`. This is a **database-backed** admin list, not an environment variable.
- Git history shows the likely explanation: a commit titled "feat: implement database-based admin user management with CRUD operations" [VERIFIED: `git log --all --oneline -S "ADMIN_USER_IDS" -- lib/ app/`] suggests `ADMIN_USER_IDS` was superseded by the `adminUsers` table and the docs were never updated — exactly the class of drift SEC-04 exists to close.
**How to avoid:** Do not carry the `ADMIN_USER_IDS` phrase into the rewritten `docs/admin-authentication.md`. Describe the real mechanism instead: "Clerk `sessionClaims.metadata.role === 'admin'`, or an active row in the `adminUsers` database table (`lib/models/admin.ts` `isUserAdmin`)." This is a deviation from the literal wording in REQUIREMENTS.md/CONTEXT.md and should be confirmed with Russell before the doc-truth task is written (or raised as a `checkpoint:human-verify` in the plan) — it directly affects what "truth" SEC-04 is asking the docs to state.
**Warning signs:** If the executed plan's doc diff contains the string `ADMIN_USER_IDS`, the phase has reintroduced a code/doc mismatch.

### Pitfall 2: The SEC-01 acceptance grep needs scoping, or it will false-positive on unrelated files
**What goes wrong:** CONTEXT.md's own "Specifics" section names the acceptance check as `grep -rn "voltique-admin" .` (excluding `node_modules` and `.git`). Run literally from the repo root, this also matches:
- `.env.local:13`: `ADMIN_VECTORIZE_TOKEN=voltique-admin-secure-token-1756375065` [VERIFIED: read in this session] — a **different**, local-only secret value that merely shares the `voltique-admin` substring as a prefix. This file is gitignored (`.gitignore:30` — `.env*.local`) [VERIFIED: .gitignore:30].
- `.open-next/cloudflare/next-env.mjs:1-2`: embeds the same local value twice (`production` and `development` blocks), generated fresh on every `opennextjs-cloudflare build` from `.env.local`. This directory is gitignored (`.gitignore:40` — `/.open-next`) [VERIFIED: .gitignore:40].
**Why it happens:** A plain recursive `grep` does not respect `.gitignore`; only `git grep` (or an explicit `--exclude-dir`) does.
**How to avoid:** Scope the acceptance check to tracked files only — `git grep -n "voltique-admin"` (respects `.gitignore` automatically), or restrict the plain grep to `docs/` since that is the only directory SEC-01 requires to be clean: `grep -rn "voltique-admin" docs/`. Do not treat a match inside `.env.local` or `.open-next/` as a SEC-01 failure — it is a pre-existing local artifact, unrelated to the published doc literal, and out of this phase's scope (CONTEXT.md explicitly says local development keeps its own value).
**Warning signs:** The rotation task reports a grep "failure" that lists `.env.local` or `.open-next/...` as matches after the docs have already been correctly scrubbed.

### Pitfall 3: Adding `recordTelemetry` directly inside `admin-middleware.ts` or `unified-auth.ts` trips the AST contract test
**What goes wrong:** See Architecture Pattern 1 above for the mechanism. Concretely: `admin-middleware.ts:92-97`'s catch block —
```typescript
} catch (error) {
    console.error("Admin auth error:", error);
    return {
      success: false,
      error: "Authentication error. Please try again."
    };
}
```
— and `unified-auth.ts:183-186`'s catch block —
```typescript
} catch (error) {
    console.error("authenticateRequest error:", error);
    return deny(401, "Authentication failed");
}
```
— both call `console.error(<string literal>, error)` where `error` is an `Identifier` node. If either file also contains a `recordTelemetry(...)` call anywhere (even in an unrelated function), `tests/unit/observability/instrumentation-source.test.ts`'s third assertion (`'does not retain raw exception console logging in instrumented boundaries'`) will scan that whole file and fail on this exact line [VERIFIED: tests/unit/observability/instrumentation-source.test.ts:77-82, quote: `if (calls.size === 0) continue; expect(rawExceptionConsoleCalls(parseSource(path)), path).toEqual([]);`].
**How to avoid:** Keep the `recordTelemetry` call inside a new file (`lib/auth/deployment-guard.ts` or similar) that `admin-middleware.ts`/`unified-auth.ts` merely call into. Do not inline the telemetry call at the point where the guard trips inside either existing file.
**Warning signs:** `npm test` fails with a message referencing `lib/auth/admin-middleware.ts: error` or `lib/auth/unified-auth.ts: error` from `tests/unit/observability/instrumentation-source.test.ts`.

### Pitfall 4: `AdminAuthResult` has no status field — 36 callers hardcode 401 regardless of the denial reason
**What goes wrong:** `checkAdminPermissions()` returns `AdminAuthResult` (`{ success, error?, userId?, isDevMode?, isServiceToken? }`) with no HTTP status field [VERIFIED: lib/auth/admin-middleware.ts:9-15]. Every one of its ~36 callers under `app/api/**` converts a failure the same hardcoded way, e.g. `app/api/admin/vectorize/route.ts:44-49`: `return NextResponse.json({ error: authResult.error || "Admin access required" }, { status: 401 });` and `app/api/admin/knowledge/route.ts:11-13`: `return NextResponse.json({ error: authResult.error }, { status: 401 });` [VERIFIED: both files read in full, plus `grep -rln "checkAdminPermissions" app` → 36 files]. CONTEXT.md's locked decision states "both auth functions return a denial with HTTP 503," but for `admin-middleware.ts`'s callers, achieving that on the wire requires either (a) adding a `status?: number` field to `AdminAuthResult` and mechanically updating all ~36 call sites' `{ status: 401 }` literal to `{ status: authResult.status ?? 401 }`, or (b) accepting that the guard's fail-closed contract is proven at the function-return level (which is what CONTEXT.md's own listed unit-test assertions check: `checkAdminPermissions()` returning a 503-shaped result directly, not an HTTP round-trip through a route handler) while routes continue to surface 401 to the wire.
**Why it happens:** `unified-auth.ts` does not have this problem — its `deny(status, error)` helper (line 45-47) already builds a `NextResponse` with the caller-specified status, and its consumers (`requireAuth`) just forward `authResult.response` [VERIFIED: lib/auth/unified-auth.ts:45-47, 190-199], so wiring 503 there needs zero caller changes.
**How to avoid:** Decide explicitly in the plan which of (a)/(b) applies, rather than discovering mid-execution that "return HTTP 503" silently only half-happened. Given the Developer Profile's regression-risk-aversion, (b) — proving fail-closed at the unit-test level for `checkAdminPermissions`, matching CONTEXT.md's actual test list verbatim — is the lower-risk default; (a) is a valid but much larger mechanical diff (~36 one-line edits) that should be called out as its own task if chosen, not folded silently into the guard task.
**Warning signs:** A UAT step that curls a `/api/admin/*` route while the guard is tripped and expects `503` gets `401` instead, even though the underlying `checkAdminPermissions()` unit tests pass.

### Pitfall 5: Query-string bypass documentation is not fully covered by CONTEXT.md's line list
**What goes wrong:** CONTEXT.md's decisions call out `docs/CLAUDE.md` lines ~318, ~341, ~456 for `?token=` removal and `docs/admin-authentication.md` line ~203 for the `?dev=` removal, plus one line in `docs/DEPLOYMENT_SETUP.md` (~285) for the "temporarily disabled" comment. A direct read of `docs/DEPLOYMENT_SETUP.md` around that area shows **two additional** lines needing the same fix that are not in CONTEXT.md's list: line 286 (`curl -X GET ".../api/admin/vectorize"` — no auth at all, under the stale "temporarily disabled" comment) and line 289 (`curl -X GET ".../api/admin/vectorize?token=your-admin-token"` — the same query-string pattern SEC-04 requires removed everywhere) [VERIFIED: docs/DEPLOYMENT_SETUP.md:279-290, read in full in this session].
**How to avoid:** When writing the SEC-04 doc task for `docs/DEPLOYMENT_SETUP.md`, fix lines 285-289 as a block (the comment plus both curl examples), not just line 285 in isolation.
**Warning signs:** `grep -n "?token=" docs/` still returns a hit in `DEPLOYMENT_SETUP.md` after the phase is marked complete.

## Code Examples

### Doc Location Map (verified, exact lines as of this research session)

`docs/CLAUDE.md`:
| Line(s) | Current text | Fix |
|---------|---------------|-----|
| 106-107 | `admin-middleware.ts  # Admin auth (currently disabled for dev)` / `unified-auth.ts   # Unified auth system (disabled for dev)` | Remove "disabled for dev" framing — code is production-enforced |
| 159-162 | "Authentication Status" bullets: "Authentication is **temporarily DISABLED** for development" / "Implementation: ... exists but bypassed" / "Production Ready: Full authentication system ready to be re-enabled" | Rewrite to state auth is enforced now, per SEC-04 |
| 190-204 | Full "Authentication System" section including "Status: Disabled - returns `{ success: true, userId: \"dev-admin\" }`" | Replace with ~6-line summary + pointer to `docs/admin-authentication.md` |
| 318 | `` Use `GET /api/admin/vectorize?token=<ADMIN_VECTORIZE_TOKEN>` for complete atomic rebuild `` | Change to Bearer-header form |
| 341 | `` - Query parameter: `?token=<ADMIN_VECTORIZE_TOKEN>`  `` | Remove this bullet entirely |
| 416 | `` - **Admin Token**: `voltique-admin` (for vectorize endpoints) `` | Replace with `<ADMIN_VECTORIZE_TOKEN>` placeholder |
| 456 | `` Run `GET /api/admin/vectorize?token=<ADMIN_VECTORIZE_TOKEN>` to index `` | Change to Bearer-header form |

`docs/admin-authentication.md`:
| Line(s) | Current text | Fix |
|---------|---------------|-----|
| 203 | `` curl "https://localhost:3000/api/admin/analytics?dev=mercora-dev-bypass" `` | `curl -H "x-dev-admin: <DEV_ADMIN_BYPASS_TOKEN>" https://localhost:3000/api/admin/analytics` + sentence noting `NODE_ENV=development` only |
| 100, 124, 134 | `ADMIN_USER_IDS` mentioned as real production check | See Common Pitfall #1 — needs a decision before rewriting |
| (new) | — | Add "Deployment safety" paragraph per CONTEXT.md |

`docs/DEPLOYMENT_SETUP.md`:
| Line(s) | Current text | Fix |
|---------|---------------|-----|
| 285 | `# Note: Authentication temporarily disabled for development` | Replace per CONTEXT.md with one line pointing to the new guard |
| 286 | `curl -X GET "https://yourdomain.com/api/admin/vectorize"` (no auth shown) | Not called out in CONTEXT.md but same block — see Pitfall 5 |
| 289 | `curl -X GET "https://yourdomain.com/api/admin/vectorize?token=your-admin-token"` | Change to Bearer-header form — see Pitfall 5 |

### Repository-wide credential scrub check (scoped correctly — see Pitfall 2)
```bash
# Source: verified against .gitignore:30,40 in this session
git grep -n "voltique-admin"        # respects .gitignore automatically
# or, if plain grep is preferred:
grep -rn "voltique-admin" docs/     # scoped to the directory SEC-01 actually governs
```

## State of the Art

Not applicable in the conventional sense (no library version churn). The one relevant "old vs. current" fact:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `ADMIN_USER_IDS` env-var admin allowlist (documented, matches an older architecture) | Database-backed `adminUsers` table via `lib/models/admin.ts` `isUserAdmin`/`isUserSuperAdmin` | Evidenced by git history (`feat: implement database-based admin user management...`) [VERIFIED: `git log --all --oneline -S "ADMIN_USER_IDS"`] | Docs describing `ADMIN_USER_IDS` as live are stale; see Common Pitfall #1. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `nodejs_compat`/`nodejs_compat_populate_process_env` does not override or shadow the workerd-native `navigator` global inside an OpenNext-bundled Worker | Architecture Pattern 3 | If wrong, `navigator.userAgent` might not read `"Cloudflare-Workers"` in the actual deployed Worker even though it is available in isolated workerd behavior, silently disabling the SEC-03 guard in production. Recommend a one-line smoke check (`console.log(navigator.userAgent)` in a temporary log line, or asserting it in the live rotation-verification probe) on first deploy after this phase ships. |
| A2 | The recommended doc replacement for `ADMIN_USER_IDS` ("Clerk role or an active row in the `adminUsers` table") is what Russell wants documented, rather than `ADMIN_USER_IDS` being reintroduced as actual code in this phase | Common Pitfall #1 | If wrong, the plan either documents a fiction (defeating SEC-04) or scope-creeps into implementing an env-var admin allowlist that was never asked for. Needs explicit confirmation before the doc task is written. |
| A3 | Option (b) in Common Pitfall #4 (prove fail-closed at the `checkAdminPermissions()`/`authenticateRequest()` return-value level; accept that most admin routes still surface HTTP 401, not 503, to the wire) satisfies the spirit of CONTEXT.md's "HTTP 503" decision without a ~36-file mechanical diff | Common Pitfall #4 | If wrong, a UAT check curling a live admin route while the guard is tripped will observe 401 instead of the promised 503, and the phase may be judged incomplete against its own locked decision. |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Does `docs/admin-authentication.md` get rewritten to remove `ADMIN_USER_IDS`, or does the plan add a note deferring that fix?**
   - What we know: `ADMIN_USER_IDS` is not implemented anywhere in `lib/` or `app/`; the real production check is Clerk role or the `adminUsers` DB table.
   - What's unclear: Whether Russell wants this corrected as part of SEC-04 (likely, since SEC-04's whole purpose is doc truth) or flagged separately, since REQUIREMENTS.md itself names `ADMIN_USER_IDS` as part of "the real mechanism."
   - Recommendation: Surface this to Russell via a `checkpoint:human-verify` or a direct question at plan time, before the doc-truth task is written; do not silently pick one wording.

2. **Does the plan touch all ~36 `checkAdminPermissions` callers to wire a dynamic status code, or only prove fail-closed at the function-return level?**
   - What we know: `unified-auth.ts` already supports a dynamic status end-to-end for free. `admin-middleware.ts` does not, and its callers are numerous.
   - What's unclear: Whether "HTTP 503" in CONTEXT.md was meant literally end-to-end for every admin route, or just as the shape of the guard's own return value (matching the unit-test list CONTEXT.md itself specifies).
   - Recommendation: Default to unit-test-level proof (matches CONTEXT.md's literal test list); note the wire-level gap explicitly in the plan's summary so it's a visible, deliberate scope decision rather than a silent gap.

3. **Should `console.log("⚠️ DEV MODE: Admin authentication bypassed with dev token")` (admin-middleware.ts:23) and the equivalent in unified-auth.ts's dev path be left as-is?**
   - What we know: These are unrelated pre-existing dev-mode log lines, not touched by CONTEXT.md's decisions.
   - What's unclear: Nothing — out of scope, listed only to prevent scope creep during planning.
   - Recommendation: Leave untouched.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `wrangler` (via `npx`) | SEC-02 rotation | ✓ | 4.123.0 [VERIFIED: `npx wrangler --version`] | — |
| `openssl` | SEC-02 token generation | ✓ (standard on macOS/Linux dev machines) | — | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` if `openssl` is unavailable |
| `curl` | SEC-02 live probe | ✓ (standard) | — | Any HTTP client |
| Cloudflare account login (`wrangler` auth) | SEC-02 rotation | Assumed ✓ per CONTEXT.md ("using the developer's existing Cloudflare login") | — | — |
| Live host `https://voltique.russellkmoore.me` | SEC-02 probe | Assumed reachable (external network call, not verified in this research session — this session made no live requests against the production site) | — | — |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** `openssl` → Node `crypto.randomBytes` (extremely unlikely to be needed; `openssl` ships with macOS/most Linux distros).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: package.json] |
| Config file | `vitest.config.mts` (unit suite; `environment: 'node'`, `include: ["tests/unit/**/*.test.ts"]`) [VERIFIED: vitest.config.mts, read in full] |
| Quick run command | `npx vitest run tests/unit/lib/auth/admin-middleware.test.ts tests/unit/lib/auth/unified-auth.test.ts` |
| Full suite command | `npm test` (runs `vitest run`, includes `tests/unit/observability/instrumentation-source.test.ts` and `tests/unit/lib/observability/telemetry.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | No literal credential value in `docs/` | scripted grep | `git grep -n "voltique-admin"` and `git grep -n "mercora-dev-bypass" docs/` (expect zero doc matches; source literal in admin-middleware.ts:22 is intentionally kept) | ✅ shell command, no new file |
| SEC-02 | Old token rejected live | manual/scripted HTTP probe | `curl` against `/api/admin/vectorize` and `/api/admin/knowledge` with the old Bearer value (see Code Examples) | ✅ shell command, no new file |
| SEC-03 | Guard trips under dev+Workers-UA, silent under prod, silent under dev+non-Workers-UA | unit | `npx vitest run tests/unit/lib/auth/admin-middleware.test.ts` / `.../unified-auth.test.ts` | ❌ new `it()` blocks needed in both existing files (Wave 0) |
| SEC-03 | New telemetry event fits closed taxonomy | unit (AST contract, pre-existing) | `npx vitest run tests/unit/observability/instrumentation-source.test.ts` | ✅ exists — will run automatically once the new event/call site are added |
| SEC-04 | Docs agree, no query-string bypass | scripted grep | `git grep -n "?dev=\|?token=" docs/` (expect zero) | ✅ shell command, no new file |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/lib/auth/admin-middleware.test.ts tests/unit/lib/auth/unified-auth.test.ts tests/unit/observability/instrumentation-source.test.ts`
- **Per wave merge:** `npm test && npm run lint && npm run typecheck && npm run cf-typecheck`
- **Phase gate:** Full CI parity before `/gsd-verify-work` — `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npm run build` (mirrors `.github/workflows/ci.yml` exactly) [VERIFIED: .github/workflows/ci.yml, read in full]

### Wave 0 Gaps
- [ ] `tests/unit/lib/auth/admin-middleware.test.ts` — add cases for guard-tripped (dev + Workers UA → denial, bypass unreachable), guard-silent-in-prod, guard-silent-in-dev-without-Workers-UA
- [ ] `tests/unit/lib/auth/unified-auth.test.ts` — same three cases for `authenticateRequest`
- [ ] `lib/observability/telemetry.ts` — add the new event key to `TELEMETRY_EVENTS` (required before any test referencing it can pass the AST contract test)
- [ ] New file `lib/auth/deployment-guard.ts` (or planner's chosen name) — no test file gap once the above two test files cover it directly; a dedicated `tests/unit/lib/auth/deployment-guard.test.ts` is optional but would isolate the guard's own logic from the two call sites

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Clerk session + DB-backed `adminUsers`/`isUserAdmin` (existing, unchanged) |
| V3 Session Management | no | Not touched this phase (Clerk-managed) |
| V4 Access Control | yes | The new guard is itself an access-control control: fail-closed on ambiguous deploy state, before any bypass is evaluated |
| V5 Input Validation | no | No new user input is parsed by this phase's code changes |
| V6 Cryptography | no | `timingSafeEqual`/`sha256Hex` already exist and are unchanged; the rotation task changes a secret's value, not its handling |
| V14 Configuration | yes | This phase is precisely a V14-style "verify the deployed configuration matches intent" control — the guard exists because `NODE_ENV` can silently diverge between build and intended deploy target |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Leaked/published credential reused against production | Spoofing | Rotate the secret (SEC-02); scrub docs (SEC-01) so it can't be re-published |
| Dev-mode auth bypass reachable in a misconfigured production deploy | Elevation of Privilege | The new `assertDeploymentPosture()` guard, running before any bypass check, fail-closed |
| Credential-in-URL (query string) leaking via logs/history/Referer | Information Disclosure | Already mitigated in code (header-only transport, `lib/auth/admin-middleware.ts:27` comment) — this phase closes the remaining doc drift describing query-string auth as valid |
| Telemetry field leaking user/order identifiers on the new event | Information Disclosure | Closed-taxonomy `sanitizeTelemetryFields`/`ALLOWED_FIELD_ENUMS` already strips anything not explicitly allow-listed — pass no fields, or only allow-listed enum fields, to `recordTelemetry` for the new event |

## Sources

### Primary (HIGH confidence)
- `lib/auth/admin-middleware.ts`, `lib/auth/unified-auth.ts`, `lib/auth/crypto.ts`, `lib/auth/same-origin.ts`, `lib/observability/telemetry.ts`, `lib/models/admin.ts` — read in full this session
- `tests/unit/lib/auth/admin-middleware.test.ts`, `tests/unit/lib/auth/unified-auth.test.ts`, `tests/unit/lib/observability/telemetry.test.ts`, `tests/unit/observability/instrumentation-source.test.ts` — read in full this session
- `vitest.config.mts`, `vitest.workers.config.mts`, `vitest.observability.config.mts`, `wrangler.jsonc`, `package.json`, `.github/workflows/ci.yml`, `.gitignore`, `scripts/build-with-public-env.mjs` — read in full this session
- `docs/CLAUDE.md`, `docs/admin-authentication.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/runtime-configuration.md` — relevant sections read in full this session
- `raw.githubusercontent.com/cloudflare/workerd/main/src/workerd/io/compatibility-date.capnp` — `globalNavigator` flag definition
- A real vitest run in this session confirming `vi.stubGlobal('navigator', ...)` works under the project's actual `vitest.config.mts`
- `node -e "..."` output in this session confirming Node 24's native `navigator.userAgent` value and property descriptor

### Secondary (MEDIUM confidence)
- developers.cloudflare.com/workers/configuration/secrets/ — `wrangler secret put` immediate-deploy behavior
- developers.cloudflare.com/workers/runtime-apis/web-standards/ — `navigator.userAgent` / `global_navigator` flag description
- WebSearch cross-references for `wrangler secret put` stdin-piping conventions (Cloudflare docs + workers-sdk issue history)

### Tertiary (LOW confidence)
- Whether `nodejs_compat` interacts with/overrides the global `navigator` object inside an actual deployed OpenNext Worker — not directly falsifiable from documentation in this session; flagged as Assumption A1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing tool versions verified directly
- Architecture: HIGH — guard placement and telemetry wiring verified against actual test/source files, including two must-avoid pitfalls found by reading (not assuming) the AST contract test
- Pitfalls: HIGH — all five pitfalls are backed by direct file reads with line numbers and quotes, not inference
- Documentation truth (SEC-04 target state): MEDIUM — the `ADMIN_USER_IDS` finding is verified as "not in code," but the correct replacement wording is a judgment call flagged for confirmation, not itself locked

**Research date:** 2026-09-01
**Valid until:** 30 days (stable internal codebase; the workerd/`global_navigator` and wrangler-secrets facts are effectively permanent, not time-sensitive)
