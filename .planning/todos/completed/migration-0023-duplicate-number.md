---
title: Two migrations share number 0023 — record it and make check:migrations refuse duplicates
created: 2026-09-10
resolves_phase: 18
source: Phase 14 planning scout, 2026-09-10
completed: 2026-09-11
status: completed
---

# Duplicate migration number 0023

`migrations/0023_add_order_effects_payload.sql` and `migrations/0023_normalize_tax_category_codes.sql` both exist and are both applied in production (the second was committed as "production-applied"). `applyD1Migrations` orders by filename, so they sort deterministically (`add_` before `normalize_`) and nothing is broken today.

## Wanted (Phase 18, tech debt)

- `docs/database-migrations.md` records the collision and the ordering rule, so nobody "fixes" it by renaming an applied file.
- `scripts/check-migrations` (the `check:migrations` gate) refuses a pull request that introduces a second file with an already-used number.
- A unit test on the checker with a fixture pair.
