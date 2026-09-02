# Deferred Items — Phase 01

Out-of-scope discoveries logged during execution, not fixed by the introducing task.

## `cf-typecheck` reports stale generated types (pre-existing, unrelated to 01-01)

- **Found during:** Plan 01-01, Task 3 (`npm run cf-typecheck` in the plan-level verification block)
- **Symptom:** `wrangler types --check` fails with "Types at ./cloudflare-env.d.ts are out of date. Run `wrangler types` to regenerate."
- **Why out of scope:** Plan 01-01 makes no change to `wrangler.jsonc`, bindings, or any Cloudflare configuration. `git log` shows `cloudflare-env.d.ts` was last regenerated in an unrelated prior commit (`39ad990 chore(cloudflare): regenerate binding types`). The drift predates this plan's changes.
- **Action:** Not fixed here (scope boundary — only auto-fix issues directly caused by the current task's changes). Regenerating `cloudflare-env.d.ts` is a one-line `wrangler types` run but touches unrelated generated output; leaving it for a dedicated task/commit outside this plan's file list.
