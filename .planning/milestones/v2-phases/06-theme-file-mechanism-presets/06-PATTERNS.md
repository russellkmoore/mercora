# Phase 6: Theme File Mechanism & Presets - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 15
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/build-themes.mjs` | utility (build script) | file-I/O + transform (validate → codegen) | `scripts/check-deploy-config.mjs` | role-match (validator + exit-code convention); AST-walking specifics from `scripts/scan-hardcoded-colors.mjs` |
| `lib/themes/manifest.generated.ts` | model (generated data) | transform (build output) | `lib/themes/tokens.ts` (current `VOLT_DARK_TOKENS` literal) | role-match (plain data object shape) |
| `themes/index.generated.css` | config (generated CSS barrel) | transform (build output) | `app/globals.css` (current single `@import "../themes/volt-dark.css";`) | role-match |
| `lib/themes/tokens.ts` (body change) | service (typed lookup) | CRUD (sync read from manifest) | itself, pre-Phase-6 version | exact (same file, body swap only) |
| `lib/themes/active-theme.ts` | service | request-response (async resolver) | `lib/utils/settings.ts` (`getSettings`) + `lib/observability/telemetry.ts` (`recordTelemetry`) | role-match |
| `app/layout.tsx` | provider/layout (RSC) | request-response (becomes async) | itself, pre-Phase-6 version (`app/product/[slug]/page.tsx` as async-RSC precedent) | exact (same file) |
| `themes/luxe.css`, `themes/midnight.css`, `themes/volt-dark.css` (header) | config (CSS theme file) | transform | `themes/volt-dark.css` | exact |
| `app/admin/settings/appearance/page.tsx` | route/component (admin page) | request-response + CRUD (GET/POST settings) | `app/admin/settings/page.tsx` | role-match |
| `components/admin/*` (theme card, if extracted) | component | request-response | `components/admin/RecommendationSettingsCard.tsx` | role-match |
| `lib/observability/telemetry.ts` (event registration) | config (event map) | event-driven | itself — existing `TELEMETRY_EVENTS` entries (e.g. `payment.pricing_rejected`) | exact |
| `workers/observability-tail/src/core.ts` | — | — | **NOT modified this phase** (see Shared Patterns / Pitfall 4) | n/a |
| `package.json` (scripts) | config | build wiring | itself, `predev`/`build:worker` strings | exact |
| `.github/workflows/ci.yml` | config (CI) | batch (freshness check) | itself, existing `Test`/`Build` steps | exact |
| `tests/unit/lib/themes/token-contract.test.ts` | test | transform (CSS parse + assert) | itself, pre-Phase-6 version | exact |
| `tests/unit/lib/themes/active-theme.test.ts` (new) | test | request-response (mocked D1) | `tests/unit/scripts/scan-hardcoded-colors.test.ts` (spawnSync-a-script pattern not applicable here — use direct import + mock) — closer analog: any test that mocks `getSettings` (search `tests/unit/**/settings*`) | role-match |
| `tests/unit/scripts/build-themes.test.ts` (new) | test | file-I/O (fixture-based) | `tests/unit/scripts/scan-hardcoded-colors.test.ts` | exact |
| `tests/unit/workers/observability-tail-core.test.ts` (extended, not new) | test | event-driven parity | itself, existing parity assertion at lines 63-67 | exact |

## Pattern Assignments

### `scripts/build-themes.mjs` (utility, file-I/O/transform)

**Analogs:** `scripts/check-deploy-config.mjs` (script shape, exit codes) + `scripts/scan-hardcoded-colors.mjs` (multi-file scan, `--json`/`--path` CLI flags, findings collection)

**Script shape / testable-export + CLI guard** (`scripts/check-deploy-config.mjs` lines 1-9, 34-56):
```js
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateOrderStatusConfig(env = {}, vars = {}) {
  // ... pure, exported, unit-testable without shelling out
}

function main() {
  try {
    // ... do the work
    console.log("[deploy-check] configuration contains no deployment placeholders.");
  } catch (error) {
    console.error(`[deploy-check] ABORT: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```
Copy this exact `main()`-guard + exported-pure-function shape for `build-themes.mjs`: export `validateThemeFile(filePath)` and `buildManifest(themeDir)` for direct unit testing (mirrors `tests/unit/scripts/build-themes.test.ts`'s needs), gate the CLI/exit-1 behavior behind the `import.meta.url` check.

**CLI arg parsing / JSON findings output** (`scripts/scan-hardcoded-colors.mjs` lines 96-100, plus its `Finding[]`/`--json` convention referenced in its test file):
```js
function parseArgs(argv) {
  const args = { path: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--path") args.path = argv[++i];
    else if (argv[i] === "--json") args.json = true;
    // build-themes.mjs adds: else if (argv[i] === "--check") args.check = true;
  }
  return args;
}
```
Use this same `--path`/`--json`-style flag convention, adding `--check` for the CI freshness gate (D-08). The scan script's whole-tree-walk + collected-findings-array (not first-failure) pattern is the direct analog for "collect errors across all files before deciding first-failure-vs-all-errors" (RESEARCH Pattern 1).

**Header/directory walk convention** (`scripts/scan-hardcoded-colors.mjs` lines 12-16):
```js
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
```
Same `node:fs`/`node:path`, `process.cwd()`-rooted convention — no third-party file-walking library, matching every `scripts/*.mjs` in this repo.

**Exit-code convention:** both analogs exit non-zero via `process.exit(1)` inside a caught error, and print a prefixed `[script-name]` message (`[deploy-check]`) — use `[build-themes]` as the prefix for consistency, with `file:line` per D-06.

---

### `lib/themes/manifest.generated.ts` (model, generated data)

**Analog:** `lib/themes/tokens.ts`'s current `VOLT_DARK_TOKENS` object (lines 49-75) — this is the literal shape the generated manifest's per-theme `tokens` field should match (same 23 camelCase keys, same flat string-value object), per RESEARCH's Assumption A2 (camelCase, not kebab-case).

```ts
const VOLT_DARK_TOKENS: ThemeTokens = {
  primary: "#f97316",
  onPrimary: "#000000",
  surface: "#000000",
  // ... all 23 keys, flat camelCase
};
```
The generated manifest wraps N of these (one per theme file) plus `{ name, label, meta }` — see RESEARCH's Code Examples section for the full `ThemeManifestEntry` shape (already fully specified there, copy verbatim, do not re-derive key names).

**File-header doc-comment convention** (`lib/themes/tokens.ts` lines 1-21): every module in `lib/themes/` opens with a JSDoc block explaining its non-obvious constraint (why it's plain data, what reads it, what must never change). Match this style in `manifest.generated.ts`'s header, but note it plus every field is machine-generated — say so explicitly ("DO NOT EDIT — generated by scripts/build-themes.mjs").

---

### `themes/index.generated.css` (config, generated barrel)

**Analog:** `app/globals.css`'s current single-file import — read `app/globals.css`'s first lines before editing; it currently does `@import "../themes/volt-dark.css";` ahead of `@config`. The generated barrel replaces that one line with `@import "../themes/index.generated.css";`, and the barrel itself is N `@import` lines, one per theme file, in filename order. No analog file exists yet for a multi-`@import` barrel in this repo — follow D-08's plain-`@import`-per-line convention, comment-headed `/* GENERATED — do not edit, see scripts/build-themes.mjs */`.

---

### `lib/themes/tokens.ts` (service, CRUD — body change only)

**Analog:** itself (same file, only the function body and the `VOLT_DARK_TOKENS` constant are replaced by a manifest `.find()`).

**Current body to replace** (lines 77-80):
```ts
export function getThemeTokens(): ThemeTokens {
  return VOLT_DARK_TOKENS;
}
```
**Required shape** (per RESEARCH Pattern 3 / D-11): keep the exported `ThemeTokens` type exactly as-is (lines 23-47, unchanged — every downstream consumer keys off this type), change the function to:
```ts
import { THEME_MANIFEST, DEFAULT_THEME_NAME } from "@/lib/themes/manifest.generated";

export function getThemeTokens(name: string = DEFAULT_THEME_NAME): ThemeTokens {
  const entry = THEME_MANIFEST.find((t) => t.name === name) ?? THEME_MANIFEST.find((t) => t.name === DEFAULT_THEME_NAME)!;
  return entry.tokens as ThemeTokens;
}
```
Keep the existing file-header JSDoc's warnings intact ("Do not read the environment here and do not import anything server-only") — `manifest.generated.ts` must stay import-clean (no `fs`, no server-only) for this constraint to hold; `tests/unit/lib/themes/token-contract.test.ts`'s existing "reads no environment variable" assertion (lines 115-125) needs extending to also scan the generated file's source.

---

### `lib/themes/active-theme.ts` (service, request-response)

**Analog 1 — D1 read pattern:** `lib/utils/settings.ts` lines 20-52 (`getSettings`):
```ts
import { getDbAsync } from '@/lib/db';
import { admin_settings } from '@/lib/db/schema/settings';
import { eq } from 'drizzle-orm';

export async function getSettings(category?: string): Promise<Record<string, any>> {
  const db = await getDbAsync();
  let settings;
  if (category) {
    settings = await db.select().from(admin_settings).where(eq(admin_settings.category, category));
  } else {
    settings = await db.select().from(admin_settings);
  }
  const result: Record<string, any> = {};
  for (const setting of settings) {
    try {
      result[setting.key] = JSON.parse(setting.value as string);
    } catch {
      result[setting.key] = setting.value;
    }
  }
  return result;
}
```
`getActiveTheme()` calls `await getSettings('appearance')` and reads `['appearance.theme']` — reuse this helper verbatim (RESEARCH Assumption A1 endorses this as the lower-friction choice), do not hand-roll a single-key query.

**Analog 2 — telemetry emission:** `lib/observability/telemetry.ts`'s `recordTelemetry` (lines 312-337, signature at top of function):
```ts
export function recordTelemetry(
  event: TelemetryEvent,
  fields?: unknown,
  error?: unknown,
  options: TelemetryOptions = {},
): void {
  try {
    const envelope = buildTelemetryEnvelope(event, fields, error, options);
    if (!envelope) return;
    // ... fails open, never throws
  } catch {
    // Telemetry must always fail open.
  }
}
```
Call `recordTelemetry('theme.unknown_selection', { stored }, undefined, { ... })` only in Pitfall 6's case (b) — a present-but-unrecognized stored value — never on an absent row. This is the exact call-site API (RESEARCH's Assumption A4 was unresolved on the exact name; it is `recordTelemetry`, confirmed this session).

**Full skeleton:** RESEARCH.md's "Code Examples § `getActiveTheme()` skeleton" (lines 402-425) is accurate and ready to use as the literal starting point — no changes needed beyond swapping the illustrative `emitTelemetry` call for the real `recordTelemetry` signature above.

---

### `app/layout.tsx` (provider/layout, becomes async)

**Analog:** itself, current file.

**Current (lines 115-121, 140):**
```tsx
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = getStoreConfig();
  const themeTokens = getThemeTokens();
  // ...
      <html lang="en" data-theme="volt-dark" suppressHydrationWarning>
```
**Required shape (RESEARCH Pattern 3, verified against this exact file):**
```tsx
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = getStoreConfig();
  const activeTheme = await getActiveTheme();
  const themeTokens = getThemeTokens(activeTheme);
  // ...
      <html lang="en" data-theme={activeTheme} suppressHydrationWarning>
```
Also add the `Cormorant_Garamond` `next/font/google` import per UI-SPEC's "Font loading (D-02)" snippet (already fully specified, copy verbatim), placed alongside the existing Geist Sans/Mono imports at the top of the file (import block around line 55-56 where `getThemeTokens` is currently imported).

Treat this as its own task/checkpoint per RESEARCH's explicit flag — "a real, non-cosmetic change to a file every route in the app renders through."

---

### `themes/luxe.css`, `themes/midnight.css`, `themes/volt-dark.css` (header only)

**Analog:** `themes/volt-dark.css` itself — the reference structure (single `[data-theme="volt-dark"]` block, all 23 `--store-*` custom properties, existing file-header JSDoc-style comment at lines 1-9).

All three files get/keep the `/* @theme label: ... | industry: ... | synopsis: ... */` header (D-05) — exact literal header strings for all three are already fully computed in `06-UI-SPEC.md` §Preset Token Contracts (Luxe line 246, Midnight line 276, volt-dark line 280) and §rename map / per-token tables (lines 193-274) — copy verbatim, do not re-derive hex values or wording.

---

### `app/admin/settings/appearance/page.tsx` (route/component)

**Analog:** `app/admin/settings/page.tsx` — save-flow, load-failure banner, and `tabs` array conventions.

**Tab entry array shape** (lines 469-476):
```tsx
const tabs = [
  { id: "system" as const, label: "System", icon: Settings, description: "Maintenance & debug" },
  { id: "store" as const, label: "Store", icon: Store, description: "Operations & policies" },
  // ...
  { id: "admins" as const, label: "Admin Users", icon: Shield, description: "Access management" }
];
```
Add an 8th entry `{ id: "appearance", label: "Appearance", icon: Palette, description: "Theme & look" }` whose click is a real `next/link` navigation to `/admin/settings/appearance` rather than `setActiveTab`, per UI-SPEC's routing note — active-state styling driven by `usePathname()` instead of `activeTab`.

**Save button + saved-badge pattern** (lines 489-509, paraphrased structure — read exact lines at implementation time):
```tsx
{saved && <Badge>Saved</Badge>}
<Button onClick={handleSave} disabled={busy}>
  <Save className="w-4 h-4 mr-2" />
  Save Changes
</Button>
```
`handleSave` (starts line 370) is the async POST-then-toast pattern to copy for the Appearance page's own save handler, posting to the same `POST /api/admin/settings` endpoint with `{ updates: [{ key: 'appearance.theme', value, category: 'appearance', data_type: 'string' }] }` (RESEARCH Pattern 4, code example already given verbatim).

**Settings POST endpoint (unchanged, reused):** `app/api/admin/settings/route.ts` lines 1-90 — `checkAdminPermissions` guard (lines 27-33 pattern, repeated at POST too), generic `{ updates: [...] }` body shape. No new route needed (D-09) — the Appearance page's save calls this existing endpoint directly.

---

### `components/admin/*` theme card (component)

**Analog:** `components/admin/RecommendationSettingsCard.tsx` (full file read, lines 1-60+) — the load/save/message state-machine shape for a self-contained admin settings card:
```tsx
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function RecommendationSettingsCard() {
  const [settings, setSettings] = useState(defaults);
  const [busy, setBusy] = useState<"load" | "save" | "rebuild" | null>("load");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/recommendations/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings");
        const body = await response.json();
        setSettings(body.settings);
      })
      .catch(() => setMessage("... could not be loaded."))
      .finally(() => setBusy(null));
  }, []);

  async function save() { /* POST, try/catch, setMessage */ }
  // ...
}
```
Use this `useState`(busy/message) + `useEffect`-on-mount-fetch shape for the theme-card-grid's client island, adapted to the click-to-select + explicit-Save model in UI-SPEC (`## Admin Appearance Page Layout`, "Selection & save model (D-15)" — pending selection via `ring-2 ring-orange-500`, Active badge moves only after successful save). Base component is `@/components/ui/card` (`Card`), consistent with this analog's import.

---

### `lib/observability/telemetry.ts` (event registration)

**Analog:** existing `TELEMETRY_EVENTS` map entries, specifically the two existing `warning`-severity precedents (lines 27-28):
```ts
export const TELEMETRY_EVENTS = {
  // ...
  'ai.response_guard_replaced': { severity: 'warning', sampleRate: 1 },
  'payment.pricing_rejected': { severity: 'warning', sampleRate: 0.05 },
  // ...
} as const;
```
Add `'theme.unknown_selection': { severity: 'warning', sampleRate: 1 },` following this exact object-literal shape (alphabetical-by-area grouping is not strict — new entries have been appended near related areas historically; place it near the top with other cross-cutting/non-payment events, or wherever the plan's diff is cleanest).

**Do NOT touch `workers/observability-tail/src/core.ts`'s `TAIL_CRITICAL_EVENTS`** — see Shared Patterns below (Pitfall 4, verified this session).

---

### `package.json` (scripts)

**Analog:** itself — current exact strings (verified via direct read this session, not the grep-filtered tool output which was garbled):
```json
"predev": "node scripts/db-local-ensure.mjs",
"build:worker": "node scripts/build-with-public-env.mjs ./node_modules/.bin/opennextjs-cloudflare build",
"deploy": "npm run clean && npm run build:worker && opennextjs-cloudflare deploy",
"scan:tokens": "node scripts/scan-hardcoded-colors.mjs"
```
Per D-06/Pitfall 1, edit these two literal strings to prepend the validator, e.g.:
```json
"predev": "node scripts/build-themes.mjs && node scripts/db-local-ensure.mjs",
"build:worker": "node scripts/build-themes.mjs && node scripts/build-with-public-env.mjs ./node_modules/.bin/opennextjs-cloudflare build",
```
Never add/rely on a `prebuild` key — confirmed absent, confirmed never fires on the deploy path (`deploy` → `build:worker` directly, no `build` step).

---

### `.github/workflows/ci.yml` (CI freshness check)

**Analog:** itself — existing `Test`/`Build` step shape (`.github/workflows/ci.yml` lines 1-60+):
```yaml
      - name: Test
        run: npm test

      - name: Test Workers integration
        run: npm run test:workers
```
Add a new step, e.g. `- name: Check theme manifest freshness` / `run: node scripts/build-themes.mjs --check`, placed before or alongside the `Build` step (which itself already indirectly proves the wiring via `npm run build` → whatever chain that resolves to — confirm this doesn't already call `build:worker`). Follow this repo's existing step-naming convention (`name:` sentence-case, `run:` a single npm/node command).

---

### Test files

**`tests/unit/lib/themes/token-contract.test.ts` (extend, not create)** — Analog: itself, current full file (139 lines, read this session). Its `EXPECTED_KEYS`/`COLOUR_KEYS`/`RADIUS_KEYS` arrays and `parseThemeCssProperties()` regex-based CSS reader (lines 43-57) are reusable verbatim — loop the existing per-file assertions (lines 93-113) over every `themes/*.css` file (via `readdirSync('themes')`) instead of only `themes/volt-dark.css`, and assert each file's parsed props match `getThemeTokens(themeName)`'s corresponding manifest entry rather than the single `getThemeTokens()` call.

**`tests/unit/scripts/build-themes.test.ts` (new)** — Analog: `tests/unit/scripts/scan-hardcoded-colors.test.ts` (lines 1-40+):
```ts
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runScan(fixturePath: string) {
  const proc = spawnSync("node", ["scripts/scan-hardcoded-colors.mjs", "--path", fixturePath, "--json"], { encoding: "utf8", cwd: process.cwd() });
  return { status: proc.status, result: JSON.parse(proc.stdout) };
}

describe("scan-hardcoded-colors", () => {
  it("flags a raw palette utility and a hex literal, with a non-zero exit code", () => {
    const { status, result } = runScan("tests/fixtures/scan-tokens/dirty.tsx");
    expect(status).not.toBe(0);
    // ...
  });
});
```
Mirror this `spawnSync`-the-real-script + fixture-directory pattern for `build-themes.mjs`: create `tests/fixtures/themes/` (or similar) with a deliberately-broken theme file (missing token, extra `@import`, wrong selector name) and assert non-zero exit + `file:line` message content — this directly satisfies THEME-01's "break a theme file, run the real script, assert non-zero exit" Wave-0 gap noted in RESEARCH's Validation Architecture table. Also export and directly unit-test `validateThemeFile()`/`buildManifest()` per the `check-deploy-config.mjs` exported-pure-function convention (no `spawnSync` needed for those cases).

**`tests/unit/lib/themes/active-theme.test.ts` (new)** — No exact spawnSync-style analog exists; this needs `vi.mock('@/lib/utils/settings')` and `vi.mock('@/lib/observability/telemetry')` to unit test `getActiveTheme()`'s three-tier fallback (D1 → env → default) and the Pitfall-6 telemetry-only-on-case-(b) rule. Structure the `describe`/`it` blocks the same way `tests/unit/lib/themes/token-contract.test.ts` does (flat `describe("getActiveTheme()", () => { it("...", () => {}) })`, no nested `describe`).

**`tests/unit/workers/observability-tail-core.test.ts` (extend, not new)** — Analog: itself, existing parity assertion (lines 62-68):
```ts
it('keeps the exact producer marker and critical taxonomy synchronized', () => {
  expect(TAIL_TELEMETRY_MARKER).toBe(TELEMETRY_MARKER);
  for (const event of TAIL_CRITICAL_EVENTS) {
    expect(TELEMETRY_EVENTS[event].severity).toBe('critical');
  }
  expect([...TAIL_ROUTE_PATHS]).toEqual([...TELEMETRY_PATHS]);
});
```
Per Pitfall 4's resolution: do NOT add `theme.unknown_selection` to `TAIL_CRITICAL_EVENTS` (would break this exact loop, since `severity` is `warning`). Instead add a narrow new assertion in this same file (new `it` block, same `describe`):
```ts
it('registers theme.unknown_selection as a non-critical, sampled-at-1 warning event', () => {
  expect(TELEMETRY_EVENTS['theme.unknown_selection']).toEqual({ severity: 'warning', sampleRate: 1 });
  expect(TAIL_CRITICAL_EVENTS).not.toContain('theme.unknown_selection');
});
```

## Shared Patterns

### Admin auth guard
**Source:** `app/api/admin/settings/route.ts` lines 27-33 (repeated identically at the POST handler)
**Apply to:** No new route is created (D-09 reuses the existing endpoint) — but if any new admin API route were needed, this is the pattern:
```ts
const authResult = await checkAdminPermissions(request);
if (!authResult.success) {
  return NextResponse.json({ error: authResult.error || "Admin access required" }, { status: 403 });
}
```

### D1 settings read/write
**Source:** `lib/utils/settings.ts` (`getSettings`) for reads; `app/api/admin/settings/route.ts` POST body shape for writes.
**Apply to:** `lib/themes/active-theme.ts` (read), `app/admin/settings/appearance/page.tsx` (read current + write on save).

### Telemetry event registration + emission
**Source:** `lib/observability/telemetry.ts` — `TELEMETRY_EVENTS` object literal shape, `recordTelemetry()` fail-open call convention.
**Apply to:** `lib/themes/active-theme.ts` (emit `theme.unknown_selection`), `lib/observability/telemetry.ts` itself (register the event).
**Critical constraint:** do NOT add the new event to `workers/observability-tail/src/core.ts`'s `TAIL_CRITICAL_EVENTS` — that list is structurally `severity: 'critical'`-only (enforced both by an existing passing test and by `parseEnvelope()`'s own runtime guard at core.ts:181). Register in `TELEMETRY_EVENTS` only; extend the parity test with a narrower assertion instead (see Test files above).

### `.mjs` build-script convention
**Source:** `scripts/check-deploy-config.mjs` (exported-function + `main()`-guard shape), `scripts/scan-hardcoded-colors.mjs` (multi-file walk, `--json`/`--path` CLI flags, findings-array-not-first-failure).
**Apply to:** `scripts/build-themes.mjs`.

### Blocking, non-Suspense server data resolution in the root layout
**Source:** `app/layout.tsx`'s existing (pre-Phase-6) synchronous `getStoreConfig()`/`getThemeTokens()` calls, sitting directly in the function body above the two existing `<Suspense>`-wrapped children (`<Header>`, `<PromotionalBanner>` — not modified this phase, referenced only as the contrast case).
**Apply to:** `getActiveTheme()`'s call site in the now-`async function RootLayout`. Never wrap in `<Suspense>` (Pitfall 3 — FOUC).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `themes/index.generated.css` | config (generated barrel) | transform | No existing multi-`@import` barrel file in this repo; `app/globals.css`'s single-line `@import` is the closest fragment but not a structural analog — follow D-08's plain-per-line convention directly, no precedent to copy beyond CSS `@import` syntax itself |
| `tests/unit/lib/themes/active-theme.test.ts` | test | request-response (mocked D1) | No existing test in this repo mocks `getSettings()`/`recordTelemetry` together for a resolver function; nearest structural precedent (`token-contract.test.ts`'s flat describe/it shape) covers only the *shape* of the test file, not the mocking strategy — use `vi.mock()` per Vitest's standard API, no repo-specific mocking helper exists to copy |

## Metadata

**Analog search scope:** `scripts/`, `lib/themes/`, `lib/utils/`, `lib/observability/`, `app/admin/settings/`, `app/api/admin/settings/`, `components/admin/`, `themes/`, `tests/unit/lib/themes/`, `tests/unit/scripts/`, `tests/unit/workers/`, `.github/workflows/`, `package.json`, `app/layout.tsx`, `app/globals.css`
**Files scanned:** ~20 read directly this session (exact line ranges cited above)
**Pattern extraction date:** 2026-09-04

## PATTERN MAPPING COMPLETE

**Phase:** 06 - Theme File Mechanism & Presets
**Files classified:** 15 (+3 test files broken out individually = 17 total entries)
**Analogs found:** 15 / 17

### Coverage
- Files with exact analog: 8 (`tokens.ts`, `app/layout.tsx`, three `themes/*.css`, `package.json`, `token-contract.test.ts`, `observability-tail-core.test.ts` extension, `telemetry.ts` registration)
- Files with role-match analog: 7 (`build-themes.mjs`, `manifest.generated.ts`, `active-theme.ts`, `appearance/page.tsx`, admin theme card, `build-themes.test.ts`, `.github/workflows/ci.yml` step)
- Files with no analog: 2 (`themes/index.generated.css`, `active-theme.test.ts` — both noted above with the closest available fragment)

### Key Patterns Identified
- Every new `scripts/*.mjs` follows the same shape: exported pure functions + `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();` CLI guard, non-zero `process.exit(1)` on failure with a `[prefix]`-tagged message.
- All D1-backed settings reads go through `getSettings(category)` (async, `getDbAsync()`-based); all writes go through the existing generic `POST /api/admin/settings` with `{ updates: [{ key, value, category, data_type }] }` — no new API route needed anywhere in this phase.
- Telemetry events are registered as flat entries in `TELEMETRY_EVENTS` with `{ severity, sampleRate }`; only `critical`-severity events may join `workers/observability-tail/src/core.ts`'s `TAIL_CRITICAL_EVENTS` — a structural, test-and-runtime-enforced constraint, not a style choice. `theme.unknown_selection` (`warning`) must NOT be added there.
- `app/layout.tsx`'s change from sync to `async function RootLayout` is a same-file, same-call-site-position change (no restructuring, no new Suspense boundary) — the existing `getStoreConfig()`/`getThemeTokens()` call positions are exactly where `await getActiveTheme()` and the updated `getThemeTokens(activeTheme)` go.

### File Created
`/Users/rmoore/Workspaces/mercora/.planning/phases/06-theme-file-mechanism-presets/06-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
