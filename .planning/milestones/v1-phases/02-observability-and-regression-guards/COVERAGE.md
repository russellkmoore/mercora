# Phase 2 — API Coverage: Workers Analytics Engine

**Scope:** the one net-new external platform API this phase integrates. Everything else in Phase 2
is additive to modules already in the codebase and needs no coverage row.

**Integration surface:** the `analytics_engine_datasets` binding declared in `wrangler.jsonc` as
`WEB_VITALS` (dataset `mercora_web_vitals`), consumed by `app/api/analytics/vitals/route.ts` (plan
`02-02`).

**Note on the sibling binding:** `lib/observability/telemetry.ts` already contains a complete,
unit-tested Analytics Engine write path against a `COMMERCE_ANALYTICS` binding that has never been
declared in `wrangler.jsonc`. This phase does not wire it — `02-RESEARCH.md` Pitfall 6 records that
as a separate scope decision. Rows below describe only the new `WEB_VITALS` integration.

## Capability rows

| Capability | Surface | Disposition | Reason |
|---|---|---|---|
| `writeDataPoint({ blobs })` | Worker binding, write side | INTEGRATE | Four of the five stored fields ride here: metric name, rating, route template, and the mobile flag. Strings only; the limit is 20 blobs and 16 KB total, and four short ASCII values sit far under it. |
| `writeDataPoint({ doubles })` | Worker binding, write side | INTEGRATE | One double: the metric value, rounded to an integer. CLS is scaled by 1000 before storage because it is unitless and sub-1; the scaling is recorded in the route. |
| `writeDataPoint({ indexes })` | Worker binding, write side | INTEGRATE | One index: the route template. Analytics Engine permits at most one index per data point and caps it at 96 bytes, so the mapper's bounded ASCII output set is not a stylistic choice — it is what makes the index legal and keeps Cloudflare's sampling from engaging. |
| Data-point-per-invocation limit (250) | Worker binding, write side | OPT-OUT | One beacon produces at most one write, so the per-invocation ceiling is unreachable by construction. No batching layer is built. |
| Automatic row timestamping | Platform behavior | INTEGRATE (implicitly) | The beacon's own `timestamp` field is dropped rather than stored, because Analytics Engine timestamps every row itself. Storing both would be a redundant column and a second value to keep consistent. |
| Automatic sampling at high write volume | Platform behavior | OPT-OUT (accepted) | Cloudflare samples when a single index receives writes too quickly. With a bounded set of roughly a dozen route templates and storefront-scale beacon volume, this is well below the documented threshold. Accepted, not mitigated; if volume grows, splitting the index is the lever. |
| SQL API (read side) | HTTP query API | OPT-OUT | Operator-only. Nobody queries the dataset from application code, so no client, no credential, and no read path is built in this phase. An operator queries it from the Cloudflare dashboard or the SQL API by hand; that check is recorded in `02-VALIDATION.md` under Manual-Only Verifications. |
| GraphQL Analytics API | HTTP query API | OPT-OUT | Same reason as the SQL API, and the SQL API is the simpler operator surface for this shape of data. |
| Dataset creation / management API | Control plane | OPT-OUT | Analytics Engine creates a dataset lazily on first write. No provisioning step, no Terraform resource, and no D1 migration — which is exactly why this sink was chosen over a bounded D1 table. |
| Retention configuration | Control plane | OPT-OUT | Retention is a fixed platform behavior (roughly three months) and is not configurable per dataset. Nothing to integrate; nothing to maintain. This is the maintenance cost the rejected D1-plus-retention-cron alternative would have carried. |
| Local development emulation | Wrangler / Miniflare | OPT-OUT | The route's missing-binding path already returns 200 and emits one warning event, which is precisely the local-development behavior. Tests exercise the write path with a spy rather than an emulator, so no local Analytics Engine emulation is configured. |

## Assumption deltas

| # | Assumption | If wrong |
|---|---|---|
| 1 | The 96-byte index cap and the one-index-per-data-point rule are current. Sourced from Cloudflare's Analytics Engine limits documentation via `02-RESEARCH.md`, not verified against a live write this session. | A longer or multi-index write would be rejected at runtime. The route's `writeDataPoint` call is wrapped in a fail-open `try`/`catch`, so a rejection degrades to a dropped row and a 200 response rather than a broken beacon. The mapper's own test asserts every template is at most 96 bytes, so the phase does not depend on the cap being larger than documented. |
| 2 | A dataset is created lazily by its first write, so no provisioning step is needed before deploy. | The first writes are silently dropped until the dataset exists. Detectable by the manual post-deploy SQL-API check recorded in `02-VALIDATION.md`; the fix is a one-time dashboard action, with no code change. |
| 3 | Storefront beacon volume against roughly a dozen route templates stays below Cloudflare's sampling threshold. | Rows become sampled estimates rather than a full count. Acceptable for a performance baseline — medians and distributions survive sampling — and visible in the dataset's own sample-interval column. |
