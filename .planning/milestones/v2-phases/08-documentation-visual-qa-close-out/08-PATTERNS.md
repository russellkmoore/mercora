# Phase 8: Documentation & Visual QA Close-out - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 9 (new + modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docs/theming.md` | config/doc | request-response (how-to reference) | `docs/runtime-configuration.md`, `docs/database-migrations.md` | role-match (doc structure) |
| `docs/CLAUDE.md` (targeted edits) | config/doc | transform (surgical edit) | itself (existing file, lines 24/390/60-140) | exact (self-edit) |
| `README.md` (docs-index line) | config/doc | transform | itself, lines 120-135 | exact (self-edit) |
| `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING}.md` | config/doc | transform (insertion) | themselves, named sections | exact (self-edit) |
| `08-QA-MATRIX.md` | test/record | batch (screenshot capture + judgement log) | `06.1-SCREENSHOTS.md`, `07-SCREENSHOTS.md` | exact |
| `app/api/admin/settings/route.ts` (GET fix) | route/controller | CRUD (D1 read + conditional seed-insert) | itself, lines 25-60 (POST handler in same file for style) | exact (self-edit) |
| `tests/unit/app/api/admin-settings-empty-category.test.ts` | test | request-response (mocked-DB unit test) | `tests/unit/app/api/admin-settings-custom-js.test.ts` | exact |
| capture loop (shell/script for 21 runs) | utility/script | batch (POST → curl-verify → screenshot capture) | `06-05-SUMMARY.md` / `06.1-04-SUMMARY.md` / `07-05-SUMMARY.md` capture commands | exact |

## Pattern Assignments

### `docs/theming.md` (new doc)

**Analogs:** `docs/runtime-configuration.md` (table-driven reference prose, status-free but factual, ends with concrete constraints), `docs/database-migrations.md` (short how-to doc with a `**Status:**` line under the H1 and command-block sections).

**Status-line convention** (`docs/database-migrations.md` lines 1-3):
```markdown
# Database migrations

**Status:** Accepted (2026-08-03)
```
Use the same `**Status:**` line pattern under theming.md's H1 if a status line is desired (Claude's Discretion per D-01/CONTEXT).

**Table-driven reference style** (`docs/runtime-configuration.md` lines 7-24):
```markdown
| Purpose | Variable |
| --- | --- |
| Store identity | `NEXT_PUBLIC_STORE_NAME`, ... |
```
Use this exact `| Purpose | Variable |`-style two/three-column table shape for the 23-token contract table (columns: token, role, example value, surfaces).

**Command-block-per-step style** (`docs/database-migrations.md` lines 9-35):
```markdown
## Local development

`npm run dev` first runs `npm run db:prepare:local`. ...

## Remote plan and apply

Before any remote change, list the plan:

\`\`\`bash
npm run db:migrate:status:preview
npm run db:migrate:status:production
\`\`\`
```
Mirror this "one `##` section per workflow step, prose then fenced command block" shape for theming.md's "Duplicate a theme in five steps" and "the two gates" sections.

**Existing theme-adjacent doc line to stay consistent with** (`docs/runtime-configuration.md` lines 29-31):
```markdown
Storefront colours no longer come from an environment variable. The active
look is selected by the `data-theme` attribute on `<html>` and resolves
through the matching `themes/*.css` file in the CSS cascade.
```
This line is already accurate — `docs/theming.md` must not contradict it; reference/link back to it rather than restate differently. Also note runtime-configuration.md's Theme table row (line 15) currently lists only `NEXT_PUBLIC_STORE_LOGO_PATH` — omits `NEXT_PUBLIC_THEME_DEFAULT` (a gap, not a stale claim per RESEARCH.md; optional one-line addition, not required by D-01/D-02).

---

### `docs/CLAUDE.md` (targeted edits, D-02)

**Analog:** itself — this is a surgical multi-point edit, not a new-file pattern. Exact target lines:

- Line 24 — current: `` - **Styling**: Tailwind CSS with dark theme (`background: #000000`) `` → replace per RESEARCH.md's docs/CLAUDE.md stale-claims table.
- Line 390 — current: `` - **Styling**: Tailwind classes, dark theme by default `` → replace per same table.
- Lines 74-140 (`## Project Structure` tree) — splice in the `themes/`, `lib/themes/`, `lib/layout/`, `components/layout/`, `components/admin/ThemePresetGrid.tsx`/`LayoutSwitches.tsx`, `scripts/build-themes.mjs`/`scan-hardcoded-colors.mjs`/`screenshot-routes.mjs` entries (exact fragment given in RESEARCH.md "Recommended Project Structure").
- Near lines 49-64 (Build Commands/gates section) — add a line naming `scan:tokens` (local/manual, not CI-wired) and `build:themes:check` (CI-wired, confirmed via `.github/workflows/ci.yml:37-40`, step name "Check theme manifest freshness").
- Near line ~570 ("Important Files to Reference") — add a link to `docs/theming.md`.

**Verified current tree style** for the splice-in (`docs/CLAUDE.md` lines 60-90, actual live content, differs slightly from RESEARCH.md's paraphrase — confirm exact indentation/comment style before editing):
```
npm run cf-typegen            # Generate Cloudflare types
...
## Project Structure

\`\`\`
mercora/
├── app/                      # Next.js App Router
│   ├── admin/                # Admin dashboard
...
```
Match the existing `├──`/`│   ├──` tree glyph style and trailing `# comment` alignment exactly — do not introduce a different tree-drawing convention.

---

### `README.md` (docs-index line)

**Analog:** itself, existing docs-index bullets, lines 120-135:
```markdown
- **[🔧 Development Context](docs/CLAUDE.md)** - Essential context for developers and AI assistants
```
Pattern: `- **[<emoji> <Title>](docs/<file>.md)** - <one-line description>`. Add a new bullet for `docs/theming.md` in the same `### 🔧 Technical Documentation` group (or a new group), following this exact emoji-bold-link-dash-description shape. Suggested text (from RESEARCH.md): `- **[🎨 Theming System](docs/theming.md)** - Token contract, presets, and layout switches`.

---

### `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING}.md` (targeted edits, D-06)

**Analog:** themselves — no external file pattern needed; these are insertion-point edits into existing structured docs. Exact insertion points (from RESEARCH.md, all grep-verified this session):

| File | Section | Line |
|---|---|---|
| `ARCHITECTURE.md` | `## Layers`, `## Key Abstractions`, `## Component Responsibilities` | 104, 136, 273 |
| `STRUCTURE.md` | `## Directory Layout` (tree), `## Directory Purposes`, `## Key File Locations`, `## Where to Add New Code` | 5, 310, 367, 420 |
| `CONVENTIONS.md` | `## Constants and Configuration` | 304 |
| `TESTING.md` | stale test-count claim ("233 files / 1701 tests") | ~27 |

`STRUCTURE.md`'s `scripts/` entry (lines 250-256) currently only names `shopify-migration/` — add `build-themes.mjs`, `scan-hardcoded-colors.mjs`, `screenshot-routes.mjs` alongside it, same list-item style as the existing `shopify-migration/` line.

**No touch needed** (per D-06 + RESEARCH.md grep): `STACK.md`, `INTEGRATIONS.md`, `CONCERNS.md` — no now-false claim found.

---

### `08-QA-MATRIX.md` (new, D-05)

**Analogs:** `06.1-SCREENSHOTS.md` (coverage grid + findings table + judgements, and its own explicit "why a new file, not appended to a prior phase's" framing) and `07-SCREENSHOTS.md` (combination-run naming precedent).

**Header/status framing pattern** (`06.1-SCREENSHOTS.md` lines 1-19):
```markdown
# Phase 6.1 Screenshot Record

This is Phase 6.1's own screenshot coverage record — a new file, following the format
`.planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md` established (label
sections, route/viewport/state/path/hash/notes tables, a findings table, and a phase-close
roll-up), scoped to this phase's own capture runs rather than appended to Phase 6's file.
Captured images live under the git-ignored `.screenshots/` directory and are never
committed — ...

Capture command: `mise exec -- npm run screenshot:routes -- --label <name> --allow-missing
--include-content --manifest
.planning/phases/06.1-remaining-presets-clinical-retro-atelier-market/06.1-SCREENSHOTS.md` —
the harness's `--manifest` flag defaults to Phase 5's `05-SCREENSHOTS.md`, and plan 06-05 hit
exactly that defect (rows had to be moved after the fact). This phase's own captures always
pass `--manifest` explicitly, pointed at this file, so no row lands anywhere else.

**Theme-switch method:** local `npm run dev` server against the existing local D1 fixture (1
category, 1 product). Theme switched via `POST /api/admin/settings` using the documented
`x-dev-admin: mercora-dev-bypass` dev-bypass header ...
```
Reproduce this exact framing for `08-QA-MATRIX.md`'s opening, substituting Phase 8's own manifest path (`.planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md`) and the 21-run/combo-A-B-C scope.

**Per-run coverage-grid table pattern** (`06.1-SCREENSHOTS.md`, Task section):
```markdown
| Run | Label | Theme written to D1 | `data-theme` confirmed before capture | Cells captured | Cells missing |
|---|---|---|---|---|---|
| 1 | `phase-06.1-01-clinical` | `clinical` | `data-theme="clinical"` | 28 | 4 |
```
followed by:
```markdown
## Label: `phase-06.1-01-clinical`

| Route | Viewport | State | Path | Hash | Notes |
|---|---|---|---|---|---|
| home | 1280 | resting | .screenshots/phase-06.1-01-clinical/home__1280__resting.png | <hash> | - |
```
Use the identical `<!-- gsd:write-continue -->` sentinel convention between sections seen in the source file for incremental writes.

**Findings-table pattern** (`06.1-SCREENSHOTS.md` line ~96):
```markdown
| F4 | Clinical — dropdown items, `Select` popover (checkout country selector) | `components/ui/select.tsx:110` (`SelectItem`) | `focus:bg-surface-elevated` (pre-fix) | ... | **Fixed** | Rule 1 bug, found while inspecting "dropdown items" per D-07's Clinical checklist. Swapped `SelectItem`'s highlight to `focus:bg-primary/10` ... |
```
Columns: `ID | Site/class | Location | Before | Observed/reasoning | Judgement (Fixed/Leave it) | Reason`. Every "Fixed" row cites the exact component file:line changed and the reason; every "Leave it" row states its own evidence, exactly this phase's D-04 requirement.

**Carried-forward-gap note pattern** (`06.1-SCREENSHOTS.md` lines 27-30, and WINDOWS-ledger-style close-out table lines 815-821):
```markdown
**Carried-forward note:** the local D1 fixture seeds no order, so the `order-status` route's
four cells ... are recorded `MISSING` by the harness on every run in this phase — the same gap
carried since Phase 5 ... Not a regression introduced here.
```
and the close-out ledger row style:
```markdown
| `GET /api/admin/settings?category=X` inserts the full `defaultSettings` array when the filtered result is empty, not scoped to `X` (Phase 6, WINDOWS #3) | Still open | A real fix scoping the insert to the requested category, before a genuinely fresh install exercises the Appearance page |
```
Use this table shape for `08-QA-MATRIX.md`'s own close-out/known-limits rollup, and note this WINDOWS #3 item as **Closed this phase** (via the D-07 fix), same row format.

**Combination naming:** neither `06.1-SCREENSHOTS.md` nor `07-SCREENSHOTS.md` literally contains the strings "Combination A/B/C" (grep returned 0 matches) — the A/B/C definitions live in `08-CONTEXT.md` D-03 itself (defaults / grid-2·split·top / list·full-bleed·left). Use CONTEXT.md's own definitions verbatim; do not expect to find a pre-existing "Combination A" label in the prior phase files — the label naming convention to reuse is the `phase-08-<combo>-<theme>` scheme from RESEARCH.md's QA-matrix-mechanics section, analogous to `phase-06.1-01-<theme>` / `phase-07-<combo>-<theme>`.

---

### `app/api/admin/settings/route.ts` GET fix (D-07)

**Analog:** the file itself — no external analog needed; this is a guard-condition change in an existing handler, verified read in full this session.

**Current buggy block** (lines 36-52, exact):
```typescript
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    const db = await getDbAsync();
    
    // Load settings from database
    const settings = category 
      ? await db.select().from(admin_settings).where(eq(admin_settings.category, category))
      : await db.select().from(admin_settings);
    
    // If no settings exist, initialize with defaults
    if (settings.length === 0) {
      console.log('Initializing default settings...');
      await db.insert(admin_settings).values(defaultSettings);
      const newSettings = await db.select().from(admin_settings);
      return NextResponse.json({ settings: newSettings });
    }
    
    return NextResponse.json({ settings });
```

**Existing imports** (top of file, unchanged, keep as-is):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { admin_settings, defaultSettings } from "@/lib/db/schema/settings";
import { checkAdminPermissions, isSuperAdminActor } from "@/lib/auth/admin-middleware";
import { CUSTOM_JS_ENABLED_SETTING, logCustomJsAudit } from "@/lib/cms/custom-js-guard";
import { eq, inArray } from "drizzle-orm";
```

**Auth pattern already present** (lines 25-34, unchanged by this fix):
```typescript
    // Check admin permissions
    const authResult = await checkAdminPermissions(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || "Admin access required" },
        { status: 403 }
      );
    }
```

**`defaultSettings` shape** (`lib/db/schema/settings.ts` lines 1-19 for the table, lines 20-40+ for the array — confirmed categories: `system`, `store`, `shipping`, `refund`, `promotions`, `recommendations`; NO `appearance` category exists in this array):
```typescript
export const admin_settings = sqliteTable("admin_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  data_type: text("data_type").notNull(),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const defaultSettings = [
  { key: 'system.maintenance_mode', value: JSON.stringify(false), category: 'system', ... },
  ...
];
```

**Recommended fix (Option B, per RESEARCH.md's Open Question recommendation)** — scope the insert to the requested category, guard against inserting an empty array:
```typescript
    if (settings.length === 0) {
      const seedRows = category
        ? defaultSettings.filter((s) => s.category === category)
        : defaultSettings;
      if (seedRows.length > 0) {
        console.log('Initializing default settings...');
        await db.insert(admin_settings).values(seedRows);
      }
      const newSettings = category
        ? await db.select().from(admin_settings).where(eq(admin_settings.category, category))
        : await db.select().from(admin_settings);
      return NextResponse.json({ settings: newSettings });
    }
```
Verify Drizzle's `insert().values([])` behavior before committing to skipping the `if (seedRows.length > 0)` guard — RESEARCH.md flags this as unverified this session; keep the guard to be safe.

---

### `tests/unit/app/api/admin-settings-empty-category.test.ts` (new, regression test for D-07)

**Analog:** `tests/unit/app/api/admin-settings-custom-js.test.ts` (the only file in this directory; same route, same mocking shape).

**Mocking boilerplate to copy verbatim** (lines 1-14):
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  isSuperAdminActor: vi.fn(),
  getDbAsync: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
  isSuperAdminActor: mocks.isSuperAdminActor,
}));
vi.mock("@/lib/db", () => ({ getDbAsync: mocks.getDbAsync }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/settings/route";
```
For the new test, change the last import to `import { GET } from "@/app/api/admin/settings/route";` and build `getDbAsync` mock to return a `db` object whose `select().from().where()` resolves `[]` for `category='appearance'` while a plain `select().from()` returns non-empty rows (simulating a partially-seeded table).

**Request-builder helper pattern** (lines 16-24, adapt for GET with a query string instead of a POST body):
```typescript
function request(value: boolean) {
  return new NextRequest("https://store.example.test/api/admin/settings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://store.example.test",
    },
    body: JSON.stringify({
      updates: [{ key: "cms.custom_js_enabled", value, category: "cms" }],
    }),
  });
}
```
New analog for GET: `new NextRequest("https://store.example.test/api/admin/settings?category=appearance", { method: "GET" })`.

**beforeEach auth-mock reset pattern** (lines 44-48):
```typescript
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin_1" });
    mocks.isSuperAdminActor.mockResolvedValue(false);
  });
```
Copy this exactly; GET doesn't need `isSuperAdminActor` but it doesn't hurt to keep the mock reset shape consistent.

**Assertions to add** (two cases per RESEARCH.md):
1. Partially-seeded table, `category=appearance` (0 rows) → `db.insert` never called with the full unfiltered `defaultSettings`, response `200` with `{ settings: [] }`, never `500`.
2. Whole table genuinely empty, unfiltered `GET` → existing full-seed behavior still fires (assert `db.insert` called with all default rows).

---

### Capture loop for the 21 QA-matrix runs

**Analog:** the shell-loop pattern already given in RESEARCH.md's own "Code Examples" section, itself extracted from `06-05-SUMMARY.md`/`06.1-04-SUMMARY.md`/`07-05-SUMMARY.md`'s documented per-run command sequence (settings POST → curl-verify → screenshot-routes.mjs). No separate file to read — RESEARCH.md already assembled the skeleton:

```bash
for combo in a b c; do
  for theme in volt-dark luxe midnight clinical retro atelier market; do
    curl -sX POST http://localhost:3000/api/admin/settings \
      -H "x-dev-admin: mercora-dev-bypass" -H "content-type: application/json" \
      -d "{\"updates\":[{\"key\":\"appearance.theme\",\"value\":\"$theme\",\"category\":\"appearance\"}, ...]}"
    curl -s http://localhost:3000/ | grep -o 'data-theme="[a-z-]*"'
    mise exec -- npm run screenshot:routes -- \
      --label "phase-08-$combo-$theme" \
      --manifest .planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md \
      --allow-missing --include-content
  done
done
```

**Dev-bypass auth mechanism** (`lib/auth/admin-middleware.ts:26-28`, quoted in RESEARCH.md): header `x-dev-admin: mercora-dev-bypass`, gated to `NODE_ENV === "development"` only. This is the same mechanism every prior Phase 6/6.1/7 capture used — do not attempt a real Clerk session.

**Critical guard:** always pass `--manifest` explicitly on all 21 invocations — the flag's undocumented default silently writes into `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` (this exact defect happened at plan 06-05 and required a byte-for-byte restore).

**Close-out step** every prior phase performed and this phase must repeat: restore all four settings keys to their defaults (`volt-dark`/`grid-3`/`minimal`/`left`) and stop the dev server at the end.

## Shared Patterns

### Verbatim-quote discipline (cross-cutting for docs/theming.md and PATTERNS excerpts above)
**Source:** `scripts/build-themes.mjs` error strings (RESEARCH.md's full table), theme file headers (`themes/*.css`), settings keys/enums (`lib/themes/active-theme.ts`, `lib/layout/settings.ts`, `lib/layout/variants.ts`).
**Apply to:** every claim in `docs/theming.md` — Russell's explicit instruction is to quote error text, token names, and enum members character-for-character, not paraphrase, so a reader can grep for them.

### Status-line-under-H1 convention
**Source:** `docs/database-migrations.md` line 3 (`**Status:** Accepted (2026-08-03)`).
**Apply to:** `docs/theming.md`'s opening, if a status line is wanted (optional per D-01/Discretion).

### `--manifest` explicit-flag discipline
**Source:** `scripts/screenshot-routes.mjs`'s `MANIFEST_PATH` default, and the documented 06-05 regression it caused.
**Apply to:** every one of the 21 `screenshot-routes.mjs` invocations for `08-QA-MATRIX.md`.

### Auth-gate-unchanged discipline
**Source:** `app/api/admin/settings/route.ts` lines 25-34 (`checkAdminPermissions`).
**Apply to:** the D-07 fix — the auth check must remain untouched; only the post-auth seed-insert guard changes.

## No Analog Found

None — all 9 files/edit-targets have a strong (exact or role-match) analog in the codebase.

## Metadata

**Analog search scope:** `docs/`, `.planning/codebase/`, `.planning/phases/06*`, `.planning/phases/07*`, `app/api/admin/settings/`, `lib/db/schema/`, `lib/auth/`, `tests/unit/app/api/`, `README.md`.
**Files scanned:** docs/database-migrations.md, docs/runtime-configuration.md, docs/CLAUDE.md, README.md, app/api/admin/settings/route.ts, lib/db/schema/settings.ts, tests/unit/app/api/admin-settings-custom-js.test.ts, .planning/phases/06.1-remaining-presets-clinical-retro-atelier-market/06.1-SCREENSHOTS.md, .planning/phases/07-layout-switches/07-SCREENSHOTS.md (path confirmed, not content-read further — 06.1-SCREENSHOTS.md's format is the primary analog and already covers the needed pattern).
**Pattern extraction date:** 2026-09-05

## PATTERN MAPPING COMPLETE

**Phase:** 08 - Documentation & Visual QA Close-out
**Files classified:** 9
**Analogs found:** 9 / 9

### Coverage
- Files with exact analog: 7 (`08-QA-MATRIX.md`, `app/api/admin/settings/route.ts`, regression test, capture loop, `docs/CLAUDE.md` self-edit, `README.md` self-edit, codebase-docs self-edit)
- Files with role-match analog: 2 (`docs/theming.md` — no prior "how-to add a theme" doc exists, so it composes patterns from two analogs)
- Files with no analog: 0

### Key Patterns Identified
- Docs in this repo use a `**Status:**` line under the H1 (database-migrations.md) and table-driven reference sections (runtime-configuration.md); `docs/theming.md` should compose both.
- Screenshot QA records follow a fixed shape: framing prose + capture-command block + per-run coverage-grid table + per-label route/viewport/state/path/hash table + a findings table with Fixed/Leave-it judgements, each with cited file:line and reason (06.1-SCREENSHOTS.md).
- The settings-GET bug fix is a pure guard-condition change (scope the seed-insert to the requested category, guard against inserting `[]`) inside an already-auth-gated handler — no auth/schema change.
- The regression test must follow the exact `vi.hoisted` + `vi.mock("@/lib/auth/admin-middleware")` + `vi.mock("@/lib/db")` shape already established in the one sibling test file for this route.
- Every screenshot-routes.mjs invocation across the 21 runs must pass `--manifest` explicitly — its undocumented default has already caused one real cross-phase file-corruption incident (06-05).

### File Created
`/Users/rmoore/Workspaces/mercora/.planning/phases/08-documentation-visual-qa-close-out/08-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
