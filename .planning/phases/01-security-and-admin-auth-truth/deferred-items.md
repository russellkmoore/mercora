# Deferred Items — Phase 01

Out-of-scope discoveries logged during execution, not fixed by the introducing task.

## `cf-typecheck` reports stale generated types (pre-existing, unrelated to 01-01)

- **Found during:** Plan 01-01, Task 3 (`npm run cf-typecheck` in the plan-level verification block)
- **Symptom:** `wrangler types --check` fails with "Types at ./cloudflare-env.d.ts are out of date. Run `wrangler types` to regenerate."
- **Why out of scope:** Plan 01-01 makes no change to `wrangler.jsonc`, bindings, or any Cloudflare configuration. `git log` shows `cloudflare-env.d.ts` was last regenerated in an unrelated prior commit (`39ad990 chore(cloudflare): regenerate binding types`). The drift predates this plan's changes.
- **Action:** Not fixed here (scope boundary — only auto-fix issues directly caused by the current task's changes). Regenerating `cloudflare-env.d.ts` is a one-line `wrangler types` run but touches unrelated generated output; leaving it for a dedicated task/commit outside this plan's file list.
- **Root cause (orchestrator, 2026-09-02):** NOT a real drift. CI run 33601930824 on the pushed `main` passed `cf-typecheck`. Locally, `.env.local` exists, and `wrangler types` folds its variable names (`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `CLERK_SECRET_KEY`, `ADMIN_VECTORIZE_TOKEN`, …) into the generated `CloudflareEnv` and rewrites the `mainModule` import as an absolute path, so the committed file never matches a local regeneration. Do NOT commit a local regeneration; it would leak secret names into the tracked types. This confirms the "Test Env Isolation Issue in cf-typecheck" entry in `.planning/codebase/CONCERNS.md`. Local workaround: run `cf-typecheck` with `.env.local` temporarily moved aside, or trust CI for this gate.

## Client-side admin dev-bypass not covered by the deployment-posture guard (WR-04, 01-REVIEW.md)

- **Found during:** Code review of Plan 01-03 (`01-REVIEW.md`, WR-04)
- **Symptom:** `components/admin/AdminGuard.tsx`'s `checkAdminAccess()` (lines ~69-74) and the
  exported `useAdminAccess()` hook (lines ~206-211) grant admin status purely from
  `process.env.NODE_ENV === "development"`, client-side, with no server round-trip. This is the
  same class of bug the new `assertDeploymentPosture()` guard was built to close on the server, but
  the guard cannot be meaningfully called here — in a browser, `navigator` is the browser's own
  object and will never equal `'Cloudflare-Workers'`, so it would silently never trip client-side
  even if wired in.
- **Why out of scope:** `middleware.ts` independently blocks `/admin` and `/api/admin` at the edge
  before this component (or its client bundle) is ever served, and any admin API call still goes
  through the now-guarded `checkAdminPermissions`/`authenticateRequest`. The residual is bounded and
  cosmetic: `useAdminAccess()` is consumed by `components/login/ClerkLogin.tsx` on every page, so a
  misbuilt deployed-dev-build would show the "Admin Dashboard" nav link to any signed-in non-admin
  user, even though clicking through leads to a 503. Not a data exposure.
- **Action:** Not fixed in this pass. Orchestrator decision on 2026-09-02 during the autonomous
  REVIEW-FIX pass, made under the phase's locked scope (no component behavior changes were in scope);
  Russell has NOT reviewed this deferral yet. Rationale: server-side middleware already blocks
  `/admin` and `/api/admin`, so client-side visibility is cosmetic. Deferred — fix suggestion if
  picked up later: gate the
  dev-mode shortcut in both functions behind a server round-trip (production already makes one via
  `/api/admin/auth-check`, itself protected by `checkAdminPermissions` and therefore by the
  deployment guard).
