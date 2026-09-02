# Deferred Items — Phase 01

Out-of-scope discoveries logged during execution, not fixed by the introducing task.

## `cf-typecheck` reports stale generated types (pre-existing, unrelated to 01-01)

- **Found during:** Plan 01-01, Task 3 (`npm run cf-typecheck` in the plan-level verification block)
- **Symptom:** `wrangler types --check` fails with "Types at ./cloudflare-env.d.ts are out of date. Run `wrangler types` to regenerate."
- **Why out of scope:** Plan 01-01 makes no change to `wrangler.jsonc`, bindings, or any Cloudflare configuration. `git log` shows `cloudflare-env.d.ts` was last regenerated in an unrelated prior commit (`39ad990 chore(cloudflare): regenerate binding types`). The drift predates this plan's changes.
- **Action:** Not fixed here (scope boundary — only auto-fix issues directly caused by the current task's changes). Regenerating `cloudflare-env.d.ts` is a one-line `wrangler types` run but touches unrelated generated output; leaving it for a dedicated task/commit outside this plan's file list.
- **Root cause (orchestrator, 2026-09-02):** NOT a real drift. CI run 33601930824 on the pushed `main` passed `cf-typecheck`. Locally, `.env.local` exists, and `wrangler types` folds its variable names (`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `CLERK_SECRET_KEY`, `ADMIN_VECTORIZE_TOKEN`, …) into the generated `CloudflareEnv` and rewrites the `mainModule` import as an absolute path, so the committed file never matches a local regeneration. Do NOT commit a local regeneration; it would leak secret names into the tracked types. This confirms the "Test Env Isolation Issue in cf-typecheck" entry in `.planning/codebase/CONCERNS.md`. Local workaround: run `cf-typecheck` with `.env.local` temporarily moved aside, or trust CI for this gate.
