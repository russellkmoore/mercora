# Database migrations

**Status:** Accepted (2026-08-03)

Mercora does not apply remote D1 migrations as part of `npm run deploy`.
Schema changes are an explicit operator action so a preview or a failed build
cannot silently mutate production data.

## Local development

`npm run dev` first runs `npm run db:prepare:local`. It applies tracked
migrations only to the local Wrangler state; it does not access Cloudflare and
does not seed or erase data.

## Remote plan and apply

Before any remote change, list the plan:

```bash
npm run db:migrate:status:preview
npm run db:migrate:status:production
```

Preview commands require a `preview_database_id` on the selected D1 binding.
If it is absent, Mercora aborts rather than falling back to production. Apply a
preview only after reviewing the plan:

```bash
npm run db:migrate:apply:preview
```

Production requires both a command confirmation and an environment guard:

```bash
MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production
```

The script verifies migration status after apply and aborts a failed/unknown
status. Keep migrations additive (expand first, deploy compatible code, then
contract in a later release) and take a durable backup before a destructive or
data-changing production migration.

## 0024_add_gift_card_events.sql

Applied on deploy like every other tracked migration — a push to `main` runs
`npm run deploy:ci` on Cloudflare Workers Builds, which applies pending remote
migrations before uploading the new Worker (see `docs/DEPLOYMENT_SETUP.md` §6
Step 1b and §9). It creates the gift-card event log and adds one nullable
column, and is expand-only like every migration in this repository. Gift
cards issued before it carry no code suffix and are not searchable by one —
there is no backfill.

## Two migrations share the number 0023

`0023_add_order_effects_payload.sql` and `0023_normalize_tax_category_codes.sql`
both use the number `0023`. Both are already applied in production. Migration
application orders by filename, and `add_` sorts before `normalize_`, so the
pair applies in a fixed, deterministic order and nothing is broken.

Neither file is ever renamed to "fix" the duplicate number. A production
database records which migrations it has already applied by filename; renaming
one of these two files would make that recorded name disagree with the
repository, which is a far worse problem than a cosmetic duplicate.

`npm run check:migrations` now refuses a new migration that reuses a number
an existing file already uses, so the next collision is caught at gate time,
before review.
