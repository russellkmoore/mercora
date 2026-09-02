# Phase 1: Security and Admin-Auth Truth - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 9 (1 new source, 4 modified source, 2 modified tests, 1 modified telemetry taxonomy, 3 doc files)
**Analogs found:** 9 / 9 (all matched; docs are self-referential corrections, not pattern copies)

All named analog paths verified tracked via `git ls-files` (no gitignored mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `lib/auth/deployment-guard.ts` (new) | utility (auth guard) | request-response (sync check + telemetry side-effect) | `lib/auth/same-origin.ts` + `lib/auth/crypto.ts` | role-match (small stateless lib/auth helper) |
| `lib/auth/admin-middleware.ts` (edit) | middleware/utility | request-response | itself (existing file, add one call) | exact |
| `lib/auth/unified-auth.ts` (edit) | middleware/utility | request-response | itself (existing file, add one call) | exact |
| `middleware.ts` (edit) | middleware | request-response | itself (existing file, add guard branch before the admin-route short-circuit) | exact |
| `lib/observability/telemetry.ts` (edit: add taxonomy entry) | config (closed taxonomy) | event-driven | itself, `webhook.signature_rejected` / `cron.recovery_failed` entries | exact |
| `tests/unit/lib/auth/admin-middleware.test.ts` (edit: add cases) | test | request-response | itself (existing describe block + `vi.stubEnv` pattern) | exact |
| `tests/unit/lib/auth/unified-auth.test.ts` (edit: add cases) | test | request-response | itself (existing describe block + `vi.stubEnv` pattern) | exact |
| `docs/CLAUDE.md`, `docs/admin-authentication.md`, `docs/DEPLOYMENT_SETUP.md` (edit) | doc | N/A | themselves; ground truth is the code above | exact (correction against code, not a pattern copy) |

## Pattern Assignments

### `lib/auth/deployment-guard.ts` (new file — utility, request-response + event-driven telemetry)

**Analogs:** `lib/auth/same-origin.ts` (small pure-function module shape) and `lib/auth/crypto.ts` (dependency-light Workers-compatible helper, module doc comment style), plus `lib/observability/telemetry.ts` for the `recordTelemetry` call contract.

**File shape to copy** (from `lib/auth/same-origin.ts` lines 1-25): a small typed helper module, one or two exported pure functions, no class, JSDoc one-liner above each export explaining *why*, not *what*:
```typescript
type OriginRequest = {
  headers: { get(name: string): string | null };
  nextUrl: { origin: string };
};
...
/** Compare a browser Origin header to the exact request origin after URL normalization. */
export function hasSameOrigin(request: OriginRequest): boolean { ... }
```

**Module doc-comment style to copy** (from `lib/auth/crypto.ts` lines 1-6):
```typescript
/**
 * Dependency-free crypto helpers shared by the auth layer.
 *
 * This module intentionally relies only on Web Crypto so it works in both
 * Cloudflare Workers and the Node test environment.
 */
```

**Telemetry call contract to copy** (`lib/observability/telemetry.ts` — `recordTelemetry` signature, line ~301-303, and the closed-taxonomy pattern lines 25-71):
```typescript
export function recordTelemetry(
  event: TelemetryEvent,
  fields?: unknown,
  error?: unknown,
  options: TelemetryOptions = {},
): void
```
Only call with the new event key and an empty/allow-listed `fields` object — no identifiers. `recordTelemetry` fails open (wrapped in try/catch internally) and silently no-ops if `event` isn't a taxonomy key, so the taxonomy entry (below) must land first or the call is a silent no-op, not a hard error — safe either order, but do the taxonomy edit first per Pattern 2 in RESEARCH.md.

**Composed target implementation** (already verified as buildable in RESEARCH.md Architecture Pattern 1, reproduced here as the pattern to execute against, using this codebase's actual import path and telemetry contract):
```typescript
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

**Why not inline in admin-middleware.ts/unified-auth.ts:** both files already have a bare `console.error("<label>:", error)` catch block (admin-middleware.ts line 93, unified-auth.ts line 184) where `error` is a raw caught exception. `tests/unit/observability/instrumentation-source.test.ts` (see below) scans any file containing a `recordTelemetry(...)` call for exactly this console pattern and fails it. Keeping the `recordTelemetry` call in the new file avoids tripping that contract test against pre-existing code.

---

### `lib/auth/admin-middleware.ts` (edit — add guard call as first statement)

**Analog:** itself. Current structure (full file already read, 118 lines). The dev-bypass check is the first branch inside the `try` at line 18-25:
```typescript
export async function checkAdminPermissions(request: NextRequest): Promise<AdminAuthResult> {
  try {
    // Check for development mode bypass token first
    const devToken = request.headers.get("x-dev-admin");

    if (devToken === "mercora-dev-bypass" && process.env.NODE_ENV === "development") {
```

**Insertion point:** the guard must run before this line, inside the `try`, returning immediately if tripped:
```typescript
import { assertDeploymentPosture } from "./deployment-guard";
...
export async function checkAdminPermissions(request: NextRequest): Promise<AdminAuthResult> {
  try {
    const posture = assertDeploymentPosture();
    if (posture.tripped) {
      return { success: false, error: posture.message };
    }
    // Check for development mode bypass token first
    ...
```
Note (from RESEARCH.md Pitfall 4): `AdminAuthResult` has no `status` field, so this return is proven correct at the unit-test level (function-return shape), not as an HTTP 503 on the wire for the ~36 callers that hardcode `{ status: 401 }` — this is the accepted default per RESEARCH.md unless a later plan explicitly widens scope.

**Error handling pattern already present, unchanged** (lines 92-98) — do not add `recordTelemetry` here:
```typescript
} catch (error) {
    console.error("Admin auth error:", error);
    return {
      success: false,
      error: "Authentication error. Please try again."
    };
}
```

---

### `lib/auth/unified-auth.ts` (edit — add guard call as first statement)

**Analog:** itself. `deny()` helper (lines 45-47) is the return-shape pattern to reuse for the guard's denial, since this file already threads status codes end-to-end:
```typescript
function deny(status: number, error: string): AuthResult {
  return { success: false, response: NextResponse.json({ error }, { status }) };
}
```

**Insertion point** inside `authenticateRequest`, before `extractToken` is called (line ~99), inside the existing `try` (line 98):
```typescript
export async function authenticateRequest(
  request: NextRequest,
  requiredPermissions: string[] = [],
  options: { updateLastUsed?: boolean; allowExpired?: boolean } = {}
): Promise<AuthResult> {
  const { updateLastUsed = true, allowExpired = false } = options;

  try {
    const posture = assertDeploymentPosture();
    if (posture.tripped) return deny(posture.status, posture.message);

    const presentedToken = extractToken(request);
    ...
```
This file gets a real HTTP 503 on the wire for free via `deny()` → `NextResponse.json(..., { status })`, unlike admin-middleware.ts.

**Error handling pattern already present, unchanged** (lines 183-186) — do not add `recordTelemetry` here:
```typescript
} catch (error) {
    console.error("authenticateRequest error:", error);
    return deny(401, "Authentication failed");
}
```

---

### `middleware.ts` (edit — call the guard before the admin-route short-circuit)

**Analog:** itself. Current admin bypass (lines 81-86) returns `NextResponse.next()` unconditionally for `/api/admin` and `/admin` — this is the exact point the guard must intercept, since it currently makes admin routes skip all middleware-level checks:
```typescript
// Skip maintenance check for admin routes and MCP API - always accessible
if (pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/mcp')) {
  return NextResponse.next();
}
```

**Pattern to copy for the 503 response shape:** the existing maintenance-mode `NextResponse` construction (lines 100-172) shows this codebase's convention for a full early-return `NextResponse` with an explicit `status`; the guard's response should be much shorter (fixed JSON or plain-text message per CONTEXT.md, no environment details), following the same "construct and return before Clerk runs" shape:
```typescript
return new NextResponse(<fixed message>, {
  status: 503,
  headers: { 'Content-Type': ... , 'Retry-After': '3600' }
});
```

**Insertion point:** immediately inside `clerkMiddleware(async (auth, req) => { ... })`, before the `/admin` / `/api/admin` bypass check, so the guard also gates the admin-route fast path:
```typescript
import { assertDeploymentPosture } from "@/lib/auth/deployment-guard";
...
export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/admin')) {
    const posture = assertDeploymentPosture();
    if (posture.tripped) {
      return new NextResponse(posture.message, { status: posture.status });
    }
  }
  ...
```
Scope this narrowly to `/api/admin` (CONTEXT.md: "calls the same guard and returns a real HTTP 503 for every admin route when tripped") — do not gate the whole site here, since `assertDeploymentPosture` is already called per-request inside `checkAdminPermissions`/`authenticateRequest` for every non-middleware caller.

---

### `lib/observability/telemetry.ts` (edit — add one taxonomy entry)

**Analog:** itself. `TELEMETRY_EVENTS` object (lines 25-71), a flat literal map keyed by dotted event name. Existing critical-severity, zero-identifier entries to copy the shape from:
```typescript
export const TELEMETRY_EVENTS = {
  ...
  'webhook.signature_rejected': { severity: 'warning', sampleRate: 0.01 },
  'cron.recovery_failed': { severity: 'critical', sampleRate: 1 },
} as const;
```
New entry (naming pattern `<domain>.<event>_<verb_past_tense>`, matching `webhook.signature_rejected` / `paid_effect.staging_failed`):
```typescript
'auth.deployment_guard_tripped': { severity: 'critical', sampleRate: 1 },
```
Add this key anywhere inside the object literal (order doesn't matter to the AST contract test, but keep alphabetical-ish grouping by domain prefix like the existing entries do — there is no existing `auth.*` domain, so it can go first or be appended; append after `cron.analytics_failed` to keep the diff minimal).

**Contract enforced by:** `tests/unit/observability/instrumentation-source.test.ts` (read lines 1-60): it (a) scans `app/`, `lib/`, `worker.ts` for `recordTelemetry('<literal>', ...)` call sites via `ts.createSourceFile` AST walk, and (b) for `severity: 'critical'` entries, asserts the literal event name is used in at least one `recordTelemetry(...)` call somewhere in that source tree — satisfied automatically once `lib/auth/deployment-guard.ts` contains the call. It also (c) rejects any file containing a `recordTelemetry` call that also has a `console.error(<string>, error)`/`console.warn(<string>, error)` call where the second argument is literally named `error` — this is why the call must live in the new file, not in admin-middleware.ts/unified-auth.ts (see above).

---

### `tests/unit/lib/auth/admin-middleware.test.ts` (edit — add guard test cases)

**Analog:** itself, existing describe block (`describe('checkAdminPermissions credential transport', ...)`, lines 15-131). Mock setup to reuse exactly, unchanged:
```typescript
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/models/admin', () => ({
  isUserAdmin: vi.fn(),
  isUserSuperAdmin: vi.fn(),
  updateAdminLastLogin: vi.fn(),
}));
...
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('ADMIN_VECTORIZE_TOKEN', 'service-secret');
  vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
  ...
});

afterEach(() => vi.unstubAllEnvs());
```
**New cases to add** (per CONTEXT.md's three assertions), following the existing `it(...)` + `vi.stubEnv` + `expect(result).toMatchObject(...)` idiom (e.g. lines 120-130's "does not honor the development bypass header in production" test is the closest existing shape — same file, same env-stub-then-assert pattern):
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// add to existing afterEach or a new one:
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('trips the deployment guard under development + Workers UA, bypass unreachable', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

  const result = await checkAdminPermissions(
    new NextRequest('http://localhost/api/products', {
      headers: { 'x-dev-admin': 'mercora-dev-bypass' },
    })
  );

  expect(result.success).toBe(false);
});

it('does not trip in production + Workers UA (normal flow)', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
  vi.mocked(auth).mockResolvedValue({ userId: 'user_admin', sessionClaims: null } as never);

  const result = await checkAdminPermissions(
    new NextRequest('https://store.example.test/api/products', { method: 'GET' })
  );

  expect(result).toMatchObject({ success: true });
});

it('does not trip in development without Workers UA (local dev preserved)', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  // navigator left as Node's native value, not stubbed

  const result = await checkAdminPermissions(
    new NextRequest('http://localhost/api/products', {
      headers: { 'x-dev-admin': 'mercora-dev-bypass' },
    })
  );

  expect(result).toMatchObject({ success: true, isDevMode: true });
});
```
Stubbing verified against this project's actual `vitest.config.mts` in RESEARCH.md Pattern 4 (`environment: 'node'`, `vi.stubGlobal('navigator', ...)` works because Node's `navigator` descriptor is `configurable: true`).

---

### `tests/unit/lib/auth/unified-auth.test.ts` (edit — add guard test cases)

**Analog:** itself, `describe('authenticateRequest fail-closed behavior', ...)`. Same mock/env-stub idiom as admin-middleware.test.ts:
```typescript
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(() => ({ ctx: { waitUntil: vi.fn() } })),
}));
vi.mock('@/lib/models/admin', () => ({ isUserAdmin: vi.fn() }));
vi.mock('@/lib/models/auth', () => ({
  getApiTokenByHash: vi.fn(),
  updateApiTokenLastUsed: vi.fn(),
}));
...
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ADMIN_VECTORIZE_TOKEN', 'expected-service-secret');
  vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
});

afterEach(() => { vi.unstubAllEnvs(); });
```
Add the equivalent three cases, asserting `result.response?.status).toBe(503)` for the tripped case (this file, unlike admin-middleware.ts, returns a real `NextResponse` with status via `deny()`):
```typescript
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('trips the deployment guard under development + Workers UA', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

  const result = await authenticateRequest(
    new NextRequest('http://localhost/api/orders', { method: 'GET' }),
    ['orders:read']
  );

  expect(result.success).toBe(false);
  expect(result.response?.status).toBe(503);
});

it('does not trip in production + Workers UA', async () => {
  vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
  vi.mocked(auth).mockResolvedValue({ userId: 'user_admin', sessionClaims: null } as never);

  const result = await authenticateRequest(
    new NextRequest('https://store.example.test/api/orders', { method: 'GET' }),
    []
  );

  expect(result.success).toBe(true);
});

it('does not trip in development without Workers UA', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.mocked(auth).mockResolvedValue({ userId: 'user_admin', sessionClaims: null } as never);

  const result = await authenticateRequest(
    new NextRequest('https://store.example.test/api/orders', { method: 'GET' }),
    []
  );

  expect(result.success).toBe(true);
});
```

---

### Doc files (`docs/CLAUDE.md`, `docs/admin-authentication.md`, `docs/DEPLOYMENT_SETUP.md`)

Not pattern-copy targets — corrections against the code above. Use RESEARCH.md's "Doc Location Map" (exact line numbers already verified: CLAUDE.md 106-107, 159-162, 190-204, 318, 341, 416, 456; admin-authentication.md 100/124/134, 203; DEPLOYMENT_SETUP.md 285-289) as the line-by-line worklist. Key substitution patterns:
- Token literal → `<ADMIN_VECTORIZE_TOKEN>`; dev-bypass literal → `<DEV_ADMIN_BYPASS_TOKEN>` (CONTEXT.md decision).
- `?token=<...>` / `?dev=mercora-dev-bypass` query forms → header forms: `-H "Authorization: Bearer <ADMIN_VECTORIZE_TOKEN>"` and `-H "x-dev-admin: <DEV_ADMIN_BYPASS_TOKEN>"`.
- `ADMIN_USER_IDS` mentions (admin-authentication.md lines 100, 124, 134) → replace with the real mechanism: "Clerk `sessionClaims.metadata.role === 'admin'`, or an active row in the `adminUsers` database table (`lib/models/admin.ts` `isUserAdmin`)" — do not reintroduce `ADMIN_USER_IDS` anywhere (RESEARCH.md Pitfall 1).
- New "Deployment safety" paragraph in `docs/admin-authentication.md` should describe, in plain terms tied to the actual code: what trips it (`assertDeploymentPosture()` in `lib/auth/deployment-guard.ts`), what the operator sees (503, fixed message, `auth.deployment_guard_tripped` telemetry event), how to recover (redeploy a production build).

## Shared Patterns

### Header-only credential transport
**Source:** `lib/auth/admin-middleware.ts` line 27 comment, `lib/auth/unified-auth.ts` `extractToken()` lines 74-81.
**Apply to:** doc rewrites (SEC-04) — every example must show `Authorization: Bearer` or `X-API-Key`/`x-dev-admin` headers, never a query string.
```typescript
function extractToken(request: NextRequest): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-api-key")?.trim();
}
```

### Denial-as-return-value, not throw
**Source:** `AdminAuthResult` (`{ success: false, error }`) in admin-middleware.ts; `deny()` helper in unified-auth.ts.
**Apply to:** `lib/auth/deployment-guard.ts` — return a discriminated union (`{ tripped: true, status, message } | { tripped: false }`), never throw.

### `vi.stubEnv` / `vi.stubGlobal` test idiom
**Source:** both existing test files, `beforeEach`/`afterEach` blocks shown above.
**Apply to:** all three new guard test cases in both test files — always pair `vi.stubGlobal('navigator', ...)` with `vi.unstubAllGlobals()` in `afterEach` to avoid cross-test leakage (existing `afterEach` only calls `vi.unstubAllEnvs()` today; must be extended).

### Closed-taxonomy telemetry registration before first call site
**Source:** `lib/observability/telemetry.ts` `TELEMETRY_EVENTS`, enforced by `tests/unit/observability/instrumentation-source.test.ts`.
**Apply to:** `lib/auth/deployment-guard.ts` — the event key must be added to `TELEMETRY_EVENTS` in the same change, or `recordTelemetry` silently no-ops and the AST contract test's critical-event-wiring assertion fails.

### Never add `recordTelemetry` to a file with a raw `console.error(label, error)` catch block
**Source:** `tests/unit/observability/instrumentation-source.test.ts` `rawExceptionConsoleCalls()` (lines ~39-53).
**Apply to:** `lib/auth/admin-middleware.ts` (line 93) and `lib/auth/unified-auth.ts` (line 184) — both already violate this if they were to gain a `recordTelemetry` call; keep the call confined to `lib/auth/deployment-guard.ts`.

## No Analog Found

None. Every file in scope has a same-file (edit) or closely-related-role (new file) analog inside `lib/auth`, `tests/unit/lib/auth`, or `lib/observability`.

## Metadata

**Analog search scope:** `lib/auth/`, `lib/observability/`, `tests/unit/lib/auth/`, `tests/unit/observability/`, `middleware.ts`, `docs/`.
**Files scanned:** 12 (9 in-scope files fully read, all tracked and verified via `git ls-files`).
**Pattern extraction date:** 2026-09-01
