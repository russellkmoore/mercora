---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-09-04T20:29:23.650Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06 | deviation | tailwind.config.ts |  | font-display token is fully wired (Tailwind class, CSS var, next/font load) but no component in app/ or components/ applies it; Luxe's serif display face never actually renders on any heading today. Plan 06-03's own human-check verify item expects to see it — out of scope for a data-only theme-file plan, carried forward for 06-05 QA / a future component-wiring task. | open |  | 2026-09-04T20:10:54.742Z |  |
| 2 | 06 | unrun-verify | components/admin/ThemePresetGrid.tsx |  | Task 3's <human-check> (sign in to admin, click a card, confirm ring/badge/toast behavior and keyboard arrow-key selection at /admin/settings/appearance) not run — no Clerk session available in this environment. Automated proof instead used the settings API directly with the documented x-dev-admin dev-bypass header: POSTing appearance.theme=midnight flipped the storefront's data-theme attribute with no restart, then restored to volt-dark. | open |  | 2026-09-04T20:29:17.650Z |  |
| 3 | 06 | deviation | app/api/admin/settings/route.ts |  | Pre-existing bug (not introduced by 06-04, and this file is explicitly out of scope per this plan's interfaces): GET /api/admin/settings?category=X inserts the FULL defaultSettings array (all categories) whenever the category-filtered result is empty, not scoped to X. The 'appearance' category has no defaultSettings entries, so on a DB where every other default category is already populated, ThemePresetGrid's category=appearance GET would trip this branch and throw a primary-key conflict on the re-insert, surfacing as a 500 and the load-failure banner. Not observed in this session only because plan 06-03 already left one appearance.theme row in the local D1 fixture. Worth a real fix (scope the insert to the requested category) before a genuinely fresh install exercises this page. | open |  | 2026-09-04T20:29:23.650Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "06",
    "file": "tailwind.config.ts",
    "line": null,
    "description": "font-display token is fully wired (Tailwind class, CSS var, next/font load) but no component in app/ or components/ applies it; Luxe's serif display face never actually renders on any heading today. Plan 06-03's own human-check verify item expects to see it — out of scope for a data-only theme-file plan, carried forward for 06-05 QA / a future component-wiring task.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T20:10:54.742Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "06",
    "file": "components/admin/ThemePresetGrid.tsx",
    "line": null,
    "description": "Task 3's <human-check> (sign in to admin, click a card, confirm ring/badge/toast behavior and keyboard arrow-key selection at /admin/settings/appearance) not run — no Clerk session available in this environment. Automated proof instead used the settings API directly with the documented x-dev-admin dev-bypass header: POSTing appearance.theme=midnight flipped the storefront's data-theme attribute with no restart, then restored to volt-dark.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T20:29:17.650Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "06",
    "file": "app/api/admin/settings/route.ts",
    "line": null,
    "description": "Pre-existing bug (not introduced by 06-04, and this file is explicitly out of scope per this plan's interfaces): GET /api/admin/settings?category=X inserts the FULL defaultSettings array (all categories) whenever the category-filtered result is empty, not scoped to X. The 'appearance' category has no defaultSettings entries, so on a DB where every other default category is already populated, ThemePresetGrid's category=appearance GET would trip this branch and throw a primary-key conflict on the re-insert, surfacing as a 500 and the load-failure banner. Not observed in this session only because plan 06-03 already left one appearance.theme row in the local D1 fixture. Worth a real fix (scope the insert to the requested category) before a genuinely fresh install exercises this page.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T20:29:23.650Z",
    "resolved_at": null
  }
]
````
