---
schema_version: 1
open_count: 9
waived_count: 0
fixed_count: 3
total_count: 12
last_updated: 2026-09-11T11:52:55.562Z
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
| 5 | 08.1 | deviation | docs/CLAUDE.md |  | Gates/Testing sections still claim scan:tokens is local-only, not CI-wired — stale after 08.1-03 added the CI step; out of this plan's declared files_modified scope | open |  | 2026-09-05T20:22:36.784Z |  |
| 6 | 08.1 | deviation | .planning/phases/08.1-v2-tech-debt-closure/08.1-07-PLAN.md |  | Task 3's automated verify includes a whole-file check that REQUIREMENTS.md has zero unchecked bold requirement lines; DOCS-04 and DOCS-05 (Phase 8.2, not yet executed) remain unchecked as intended, so this specific sub-check fails as literally written. DEBT-01's own checkbox and traceability row were verified directly instead; no other requirement's state was changed. | open |  | 2026-09-05T22:07:40.268Z |  |
| 7 | 12 | deviation | N/A (CDN edge cache, not a repo file) |  | Public CDN URL https://voltique-images.russellkmoore.me/knowledge_md/gift-cards.md served a stale cached GET body (old article, TTL max-age=14400) for ~13min+ after the 12-02 upload while HEAD/ETag and the direct R2 object read already showed the correct new content; self-resolves by cache TTL expiry, no wrangler purge command exists, and plan 12-04's re-index reads via the R2 binding directly so is unaffected | open |  | 2026-09-09T20:37:10.407Z |  |
| 8 | 12 | deviation | .planning/phases/12-content-assistant-live-proof/12-04-SUMMARY.md |  | 12-04 upserted only knowledge-gift-cards, not all nine knowledge articles (dispatch narrowed the plan's Task 1 scope); the other seven knowledge vectors carry pre-phase embeddings of unchanged articles | open |  | 2026-09-09T20:47:36.043Z |  |
| 9 | 12 | deviation | wrangler.jsonc, lib/services/checkout-pricing.ts, lib/services/gift-card-fulfillment.ts |  | 12-06's scope assertion (zero files under lib/, app/, components/, migrations/, wrangler.jsonc over the phase range) did not hold: three files changed, all attributable to the four unattended orchestrator commits 3b821f7, 32b9df1, f813499, d8b4d11 made during 12-05. app/, components/ and migrations/ are empty in the range and no migration was added, so D-11's template/component claim and T-12-31 hold; the secret scan over added lines is 0. Recorded rather than narrowed. | open |  | 2026-09-09T22:35:16.228Z |  |
| 10 | 12 | deviation | lib/gift-cards/customization.ts |  | Gift-card notes containing a URL are rejected by parseGiftCardCustomization (12 review WR-08); the same parser runs over persisted cart state on load (migrateCartState -> normalizeCartItemForStore), so a browser holding a pre-deploy cart whose note contains a URL silently loses that cart line. Paid orders unaffected. Open debt from the iteration-3 review (WR-16); fix is a validation prompt instead of a dropped line. | fixed |  | 2026-09-09T23:42:12.862Z | 2026-09-11T11:52:55.562Z |
| 11 | 13 | deviation | lib/gift-cards/honor-guard.ts |  | reportHonorDisabledWithBalances has no caller until plan 13-07 wires the cron tick | open |  | 2026-09-10T16:42:05.501Z |  |
| 12 | 18 | deviation | lib/checkout/digital-only.ts |  | isDigitalOnlyCart keys on item.giftCardCustomization presence; a D-03-flagged gift-card line (invalid note) has no customization, so a cart holding only a flagged gift-card line is misclassified as not-digital-only, showing a shipping-address step for a checkout that projectCartLineForCheckout will refuse regardless. Not fixed here: digital-only.ts is owned by plan 18-02 (D-05), out of 18-04's files_modified scope. | open |  | 2026-09-11T11:52:52.347Z |  |

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
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "08.1",
    "file": "docs/CLAUDE.md",
    "line": null,
    "description": "Gates/Testing sections still claim scan:tokens is local-only, not CI-wired — stale after 08.1-03 added the CI step; out of this plan's declared files_modified scope",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-05T20:22:36.784Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "08.1",
    "file": ".planning/phases/08.1-v2-tech-debt-closure/08.1-07-PLAN.md",
    "line": null,
    "description": "Task 3's automated verify includes a whole-file check that REQUIREMENTS.md has zero unchecked bold requirement lines; DOCS-04 and DOCS-05 (Phase 8.2, not yet executed) remain unchecked as intended, so this specific sub-check fails as literally written. DEBT-01's own checkbox and traceability row were verified directly instead; no other requirement's state was changed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-05T22:07:40.268Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "12",
    "file": "N/A (CDN edge cache, not a repo file)",
    "line": null,
    "description": "Public CDN URL https://voltique-images.russellkmoore.me/knowledge_md/gift-cards.md served a stale cached GET body (old article, TTL max-age=14400) for ~13min+ after the 12-02 upload while HEAD/ETag and the direct R2 object read already showed the correct new content; self-resolves by cache TTL expiry, no wrangler purge command exists, and plan 12-04's re-index reads via the R2 binding directly so is unaffected",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-09T20:37:10.407Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "12",
    "file": ".planning/phases/12-content-assistant-live-proof/12-04-SUMMARY.md",
    "line": null,
    "description": "12-04 upserted only knowledge-gift-cards, not all nine knowledge articles (dispatch narrowed the plan's Task 1 scope); the other seven knowledge vectors carry pre-phase embeddings of unchanged articles",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-09T20:47:36.043Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "12",
    "file": "wrangler.jsonc, lib/services/checkout-pricing.ts, lib/services/gift-card-fulfillment.ts",
    "line": null,
    "description": "12-06's scope assertion (zero files under lib/, app/, components/, migrations/, wrangler.jsonc over the phase range) did not hold: three files changed, all attributable to the four unattended orchestrator commits 3b821f7, 32b9df1, f813499, d8b4d11 made during 12-05. app/, components/ and migrations/ are empty in the range and no migration was added, so D-11's template/component claim and T-12-31 hold; the secret scan over added lines is 0. Recorded rather than narrowed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-09T22:35:16.228Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "12",
    "file": "lib/gift-cards/customization.ts",
    "line": null,
    "description": "Gift-card notes containing a URL are rejected by parseGiftCardCustomization (12 review WR-08); the same parser runs over persisted cart state on load (migrateCartState -> normalizeCartItemForStore), so a browser holding a pre-deploy cart whose note contains a URL silently loses that cart line. Paid orders unaffected. Open debt from the iteration-3 review (WR-16); fix is a validation prompt instead of a dropped line.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-09T23:42:12.862Z",
    "resolved_at": "2026-09-11T11:52:55.562Z"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "13",
    "file": "lib/gift-cards/honor-guard.ts",
    "line": null,
    "description": "reportHonorDisabledWithBalances has no caller until plan 13-07 wires the cron tick",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-10T16:42:05.501Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "18",
    "file": "lib/checkout/digital-only.ts",
    "line": null,
    "description": "isDigitalOnlyCart keys on item.giftCardCustomization presence; a D-03-flagged gift-card line (invalid note) has no customization, so a cart holding only a flagged gift-card line is misclassified as not-digital-only, showing a shipping-address step for a checkout that projectCartLineForCheckout will refuse regardless. Not fixed here: digital-only.ts is owned by plan 18-02 (D-05), out of 18-04's files_modified scope.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T11:52:52.347Z",
    "resolved_at": null
  }
]
````
