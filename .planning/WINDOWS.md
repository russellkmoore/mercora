---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 2
total_count: 4
last_updated: 2026-09-05T16:53:36.414Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06 | deviation | tailwind.config.ts |  | font-display token is fully wired (Tailwind class, CSS var, next/font load) but no component in app/ or components/ applies it; Luxe's serif display face never actually renders on any heading today. Plan 06-03's own human-check verify item expects to see it — out of scope for a data-only theme-file plan, carried forward for 06-05 QA / a future component-wiring task. | fixed |  | 2026-09-04T20:10:54.742Z | 2026-09-05T06:13:02.281Z |
| 2 | 06 | unrun-verify | components/admin/ThemePresetGrid.tsx |  | Task 3's <human-check> (sign in to admin, click a card, confirm ring/badge/toast behavior and keyboard arrow-key selection at /admin/settings/appearance) not run — no Clerk session available in this environment. Automated proof instead used the settings API directly with the documented x-dev-admin dev-bypass header: POSTing appearance.theme=midnight flipped the storefront's data-theme attribute with no restart, then restored to volt-dark. | open |  | 2026-09-04T20:29:17.650Z |  |
| 3 | 06 | deviation | app/api/admin/settings/route.ts |  | Pre-existing bug (not introduced by 06-04, and this file is explicitly out of scope per this plan's interfaces): GET /api/admin/settings?category=X inserts the FULL defaultSettings array (all categories) whenever the category-filtered result is empty, not scoped to X. The 'appearance' category has no defaultSettings entries, so on a DB where every other default category is already populated, ThemePresetGrid's category=appearance GET would trip this branch and throw a primary-key conflict on the re-insert, surfacing as a 500 and the load-failure banner. Not observed in this session only because plan 06-03 already left one appearance.theme row in the local D1 fixture. Worth a real fix (scope the insert to the requested category) before a genuinely fresh install exercises this page. | fixed |  | 2026-09-04T20:29:23.650Z | 2026-09-05T16:53:36.414Z |
| 4 | 07 | deviation | app/product/[slug]/ProductDisplay.tsx |  | Defaults-parity screenshot comparison (07-05 Task 2) found 1 of 12 compared home/category/product rows non-identical: product\|390\|resting differs from the pre-extraction baseline by exactly 2 pixels at +/-1/255 intensity (anti-aliased thumbnail border edge), reproduced identically across two independent recaptures. Source-level parity test (product-gallery-variants.test.ts) proves the component's JSX is byte-for-byte unchanged; attributed to headless-Chromium sub-pixel rendering variance between separate browser launches, not a code regression. Registered as snap S-07-01 with full pixel-diff evidence in 07-SCREENSHOTS.md. | open |  | 2026-09-05T09:12:07.856Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "06",
    "file": "tailwind.config.ts",
    "line": null,
    "description": "font-display token is fully wired (Tailwind class, CSS var, next/font load) but no component in app/ or components/ applies it; Luxe's serif display face never actually renders on any heading today. Plan 06-03's own human-check verify item expects to see it — out of scope for a data-only theme-file plan, carried forward for 06-05 QA / a future component-wiring task.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-04T20:10:54.742Z",
    "resolved_at": "2026-09-05T06:13:02.281Z"
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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-04T20:29:23.650Z",
    "resolved_at": "2026-09-05T16:53:36.414Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "07",
    "file": "app/product/[slug]/ProductDisplay.tsx",
    "line": null,
    "description": "Defaults-parity screenshot comparison (07-05 Task 2) found 1 of 12 compared home/category/product rows non-identical: product|390|resting differs from the pre-extraction baseline by exactly 2 pixels at +/-1/255 intensity (anti-aliased thumbnail border edge), reproduced identically across two independent recaptures. Source-level parity test (product-gallery-variants.test.ts) proves the component's JSX is byte-for-byte unchanged; attributed to headless-Chromium sub-pixel rendering variance between separate browser launches, not a code regression. Registered as snap S-07-01 with full pixel-diff evidence in 07-SCREENSHOTS.md.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-05T09:12:07.856Z",
    "resolved_at": null
  }
]
````
