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
