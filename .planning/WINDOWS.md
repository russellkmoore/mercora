---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-04T20:10:54.742Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06 | deviation | tailwind.config.ts |  | font-display token is fully wired (Tailwind class, CSS var, next/font load) but no component in app/ or components/ applies it; Luxe's serif display face never actually renders on any heading today. Plan 06-03's own human-check verify item expects to see it — out of scope for a data-only theme-file plan, carried forward for 06-05 QA / a future component-wiring task. | open |  | 2026-09-04T20:10:54.742Z |  |

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
  }
]
````
