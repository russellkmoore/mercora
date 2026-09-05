---
gsd_state_version: 1.0
milestone: v2
milestone_name: Themeable Storefront
current_phase: 08
current_phase_name: Documentation & Visual QA Close-out
status: executing
stopped_at: Completed 08-02-PLAN.md
last_updated: "2026-09-05T16:40:16.255Z"
last_activity: 2026-09-05
last_activity_desc: Phase 08 execution started
state_head: 48c632479747f1ae2b3801498c7d1f20f68e6d3f
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 31
  completed_plans: 29
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-05 after Phase 7)

**Core value:** A customer or an external AI agent can find the right outdoor gear through Volt, pay for it exactly once, and have inventory, order state, and refunds end up correct, whether they arrive via the storefront or the MCP server.
**Current focus:** Phase 08 — Documentation & Visual QA Close-out

## Current Position

Phase: 08 (Documentation & Visual QA Close-out) — EXECUTING
Plan: 4 of 5
Status: Ready to execute
Last activity: 2026-09-05 — Phase 08 execution started

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**

- Total plans completed: 43 (all v1)
- Average duration: 56 min/plan (Phase 5, 12 plans)
- Total execution time: ~11.3 hours (v2)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (v1) | 4 | - | - |
| 2 (v1) | 5 | - | - |
| 3 (v1) | 3 | - | - |
| 4 (v1) | 5 | - | - |
| 6 (v2) | - | - | - |
| 7 (v2) | - | - | - |
| 8 (v2) | - | - | - |
| 5 (v2) | 12 | ~11.3h | 56min |
| 06 | 5 | - | - |
| 06.1 | 4 | - | - |
| 07 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: 25, 45, 90, 20, 95 min
- Trend: sweep chunks 20–55 min; bridge/email chunks 90+ min

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 05 P01 | 20min | 2 tasks | 7 files |
| Phase 05 P02 | 55min | 2 tasks | 5 files |
| Phase 05 P03 | 130min | 3 tasks | 11 files |
| Phase 05 P04 | 55min | 3 tasks | 18 files |
| Phase 05 P05 | 50min | 3 tasks | 6 files |
| Phase 05 P06 | 35min | 3 tasks | 8 files |
| Phase 05 P07 | 55min | 3 tasks | 6 files |
| Phase 05 P08 | 25min | 3 tasks | 13 files |
| Phase 05 P09 | 45min | 3 tasks | 5 files |
| Phase 05 P10 | 90min | 3 tasks | 16 files |
| Phase 05 P11 | 20min | 3 tasks | 19 files |
| Phase 05 P12 | 95min | 3 tasks | 7 files |
| Phase 06 P01 | 15min | 3 tasks | 19 files |
| Phase 06 P02 | 25min | 3 tasks | 9 files |
| Phase 06 P03 | 20min | 3 tasks | 6 files |
| Phase 06 P04 | 16min | 3 tasks | 4 files |
| Phase 06 P05 | 35min | 3 tasks | 4 files |
| Phase 06.1 P01 | 20min | 2 tasks | 4 files |
| Phase 06.1 P02 | 27min | 3 tasks | 6 files |
| Phase 06.1 P03 | 20min | 3 tasks | 26 files |
| Phase 06.1 P04 | 45min | 3 tasks | 5 files |
| Phase 07 P01 | 35min | 3 tasks | 17 files |
| Phase 07 P02 | 25min | 3 tasks | 7 files |
| Phase 07 P03 | 13min | 3 tasks | 7 files |
| Phase 07 P04 | 25min | 2 tasks | 3 files |
| Phase 07 P05 | 40min | 3 tasks | 5 files |
| Phase 08 P01 | 6min | 2 tasks | 3 files |
| Phase 08 P03 | 45min | 2 tasks | 1 files |
| Phase 08 P02 | 15min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Decisions locked for v2:

- Theme registry is build-time generated from `themes/*.css` only — never a wrangler var or hand-maintained list
- A new theme requires a deploy; switching between shipped themes is instant via D1
- `getActiveTheme()` accepts the per-request D1 read; no caching layer unless traces show it's needed
- `theme.mode` (dark/light) folds into the theme file — a theme IS a mode; no separate mode switch
- Per-theme component/markup overrides and per-category layout overrides are rejected — tokens + enumerated variants is the line
- Admin theming is out of scope for this milestone; admin keeps its hardcoded palette
- [Phase 05]: MANUAL_REVIEW files are excluded from scanning entirely (not just flagged inline), each printed with a written reason on every run. — Matches TOKEN-MAP §6's framing of them as named-file exceptions with a printed reason, so a future 0-violations result never silently omits content the scanner never looked at.
- [Phase 05]: The screenshot harness's 'open' interactive state for every non-cart route is the header nav (desktop dropdown / mobile sheet); only two selectors (nav trigger, cart trigger) cover the whole coverage grid.
- [Phase 05]: Local D1 dev seed (predev/seed-dev.sql) does not provide catalog data; data/d1/seed.sql is the documented but currently broken source (bad bulk-insert row) — screenshot baseline used a minimal local-only D1 fixture instead of fixing the unrelated seed file.
- [Phase 05]: [Phase 05-03] Adopted all four discretionary volt-dark token values as derived: on-primary=black, border/ring=neutral-700 (#404040), warning=amber-500 (#f59e0b), border-inverse=gray-700 (#374151). — User decision (Task 0, adopt-all). border-inverse routes both D-05 (drawer edges) and D-10 (email dividers) to the same value, so transactional email dividers will visibly darken once plan 05-12 lands — a known, accepted consequence, recorded as the place to reverse course if it reads badly.
- [Phase 05]: [Phase 05-03] StoreConfig.theme reduced to { logoPath: string } only; mode/primary/surface/surfaceElevated/foreground/mutedForeground deleted from both the type and defaults, not kept as a Phase 6 compatibility shim. — app/layout.tsx was the only reader of the colour fields anywhere in the tree (confirmed by whole-repo grep) and Task 1 already removed those reads, so a shim would just be a second, unused source of the same values.
- [Phase 05]: [Phase 05-03] Added app/not-found.tsx to fix a regression Next's built-in notFound() fallback exposed once the body's inline style was removed. — Next's built-in 404 boundary injects an unlayered body{background:#fff} style that outranks Tailwind's @layer utilities regardless of specificity; the prior inline style always won by CSS origin priority, masking this. Reproduced in dev and production next start; reachable from real notFound() call sites (category, product, blog, account, order-status), not just the screenshot tooling.
- [Phase 05]: [Phase 05-04] Fixed CSS-specificity regression on CategoryDisplay.tsx's sort-toggle active indicator (Rule 1) — data-[state=on]:bg-surface-elevated now legitimately outranks the page's unconditional bg-orange-500 override; marked the override !important to restore the exact prior pixel.
- [Phase 05]: Categories dropdown panel uses bg-foreground/text-surface (main-set tokens) instead of the inverse token set, since it's not one of the four scoped inverse surfaces and both frozen values equal white/black — Satisfies both D-16 pixel-preservation and the plan's own automated no-inverse-tokens check
- [Phase 05]: Registered two new shade-consolidation snaps S13 (Footer bg-neutral-950 to bg-surface) and S14 (mobile category-card gray/orange convergence) rather than reverting them — Both are directed by the frozen token substitution table and D-15's close-enough-snap allowance; verified via PIL pixel diff before annotating
- [Phase 05]: [Phase 05-06] Binary available/unavailable badges map to success/warning, not success/danger -- this app's only unavailable copy ("Coming Soon", "Currently unavailable") reads as anticipatory/temporary, and there's no discontinued-product state to reserve danger for.
- [Phase 05]: [Phase 05-06] app/page.tsx's and app/product/[slug]/page.tsx's page-wrapper bg-neutral-900 maps to bg-surface-elevated, not bg-surface -- corrected mid-plan (Rule 1) after a screenshot diff caught the initial bg-surface interpretation as an unregistered ~83% full-page pixel shift; 05-05 already established the pixel-identical mapping for the same literal class.
- [Phase 05]: [Phase 05-06] Registered new shade-consolidation snap S15 (ProductCard.tsx/ProductDisplay.tsx bg-neutral-800 card/gallery surfaces -> bg-surface-elevated, rgb(38,38,38) -> rgb(23,23,23)) after PIL-diffing all ten differing chunk-3-catalog cells back to this single, table-directed root cause.
- [Phase 05]: [Phase 05] [Phase 05-07] StarRating.tsx's filled/unfilled colours (primary/muted-foreground) ripple into every ProductCard star badge across home/category/product grids since StarRating is a shared component; registered as new snap S16 after a full pixel-diff against chunk-3-catalog confirmed no other change.
- [Phase 05]: [Phase 05] [Phase 05-07] SubscriptionAcquisitionPanel.tsx's Stripe setup host wrapper (previously bg-white/text-black) moved to bg-surface-elevated/text-foreground on the main token set rather than the inverse token set, since it is not one of TOKEN-MAP section 3's four scoped inverse surfaces; the Stripe iframe itself stays light independently via StripeProvider.tsx's own hardcoded appearance config, untouched by this plan.
- [Phase 05]: [Phase 05] [Phase 05-07] SubscriptionAcquisitionPanel.tsx has no plan-card selection UI to give a selected-vs-unselected contrast -- plan choice is a native select dropdown -- so the selected-plan primary-token mitigation is satisfied by the Subscribe section's own accent styling rather than inventing new card markup.
- [Phase 05]: [Phase 05] [05-08] All CMS block components and the blog surfaces are now token-driven; every prose block in this chunk runs on Typography plugin defaults with no raw override, recorded for Phase 6. — The CMS block dispatcher (PageRenderer.tsx) was confirmed clean by a full read rather than trusting the measured-zero count; prose accent colour will not follow a future theme until Phase 6 wires custom typography colours off the CSS variables.
- [Phase 05]: [Phase 05] [05-08] scripts/screenshot-routes.mjs gained an opt-in --include-content flag (Rule 3 auto-fix) to resolve blog/CMS slugs, rather than changing the default seven-route grid. — The script had no concept of blog/CMS routes despite the plan's read_first describing it as already handling them; an opt-in flag avoids changing every other chunk's expected captured-cell count.
- [Phase 05]: [Phase 05] [05-09] The Tailwind colour key border-inverse generates the border-color class border-border-inverse, not border-inverse -- caught via screenshot pixel-diff, not by scan/build/lint/typecheck. — border-inverse alone generates no CSS rule and silently falls back to currentColor; only a screenshot comparison against the registered S10 snap value exposed the wrong resulting colour.
- [Phase 05]: [Phase 05] [05-09] The agent chat's user bubble maps to bg-info/text-foreground per D-03, matching the existing PromotionalBanner.tsx on-colour precedent for status tokens. — D-03 names the chat bubble as one of exactly three surfaces that justify the info token's place in the contract; bg-info pairs with text-foreground everywhere else it's used.
- [Phase 05]: [Phase 05-10] Checkout's legacy light (bg-white/text-black) panel design is normalized to the dark main-set token surface, not preserved as a fifth inverse-surface exception -- a deliberate polarity change scoped to exactly the checkout UI files, directed by Task 2's own action text.
- [Phase 05]: [Phase 05-10] Completed-step summary boxes in CheckoutClient.tsx map to the success token, not primary, per the plan's own 'a completed step is success' instruction; confirmed by the acceptance criterion requiring danger and success as distinct tokens in that file.
- [Phase 05]: [Phase 05-11] AccountNav.tsx's active-item requirement is satisfied by the existing hover-state token mapping (hover:border-primary), not new usePathname() active-route logic -- the component never had active/inactive differentiation, and adding one would break a test that mocks next/navigation.
- [Phase 05]: [Phase 05-11] SubscriptionManager.tsx and GiftCardDashboard.tsx status badges are newly colour-coded onto the success/warning/danger/info quartet by meaning, directed explicitly by the plan's own action text -- both previously rendered as flat neutral chips with no status colour.
- [Phase 05]: [Phase 05-11] app/order-status/[id]/page.tsx's dead shadcn classes and bg-white legacy panels normalize onto the dark main-set token surface (not the inverse set), following the same precedent 05-10 set for checkout -- it's not one of TOKEN-MAP section 3's four scoped inverse consumers.
- [Phase 05]: [Phase 05-11] app/global-error.tsx maps its seven inline colours to MAIN-set getThemeTokens() fields only, avoiding RESEARCH Pitfall 4's predicted trap of pattern-matching the inverse-mapped drawers/Stripe/email consumers it sits near in CONTEXT.md.
- [Phase 05]: [Phase 05] [Phase 05-12] Card/section email backgrounds map to surfaceInverseElevated (#f3f4f6), not surfaceInverse -- a real visual change (white card becomes light grey) beyond the S10 divider darkening the plan flagged in advance, per TOKEN-MAP §3b's literal table; documented explicitly in the phase-close record.
- [Phase 05]: [Phase 05] [Phase 05-12] Phase 5 closes with a clean whole-tree scan:tokens (0 violations, 2 manual-review rows), the 23-token contract intact across all nine sweep chunks, and NEXT_PUBLIC_THEME_PRIMARY confirmed absent tree-wide -- all four ROADMAP success criteria met with command evidence in 05-SCREENSHOTS.md's phase-close section.
- [Phase 06]: [Phase 06-01] lib/themes/manifest.generated.ts added to scan-hardcoded-colors.mjs's THEME_SOURCE_FILES exclusion set (same treatment as lib/themes/tokens.ts) so scan:tokens stays 0 violations on the generated hex-bearing manifest.
- [Phase 06]: [Phase 06-01] Barrel @import lines use an explicit relative prefix (./volt-dark.css) — a bare specifier broke the real Next.js build because Tailwind's CSS import resolution treats it as a Node-style module lookup, not a relative path.
- [Phase 06-02]: theme.unknown_selection registered a task early (Task 1, not Task 2) because recordTelemetry's event param is a literal-union type that Task 1's own typecheck gate requires satisfied
- [Phase 06-02]: An env default (NEXT_PUBLIC_THEME_DEFAULT) that is not a manifest name falls through silently with no telemetry -- treated as operator error at deploy, not a per-request anomaly
- [Phase 06]: [Phase 06-03] Both presets took every token value from 06-UI-SPEC.md's pre-computed table verbatim, including its two flagged accessibility corrections (Midnight's on-primary, Luxe's ring) — no oklch value was re-derived by hand.
- [Phase 06]: [Phase 06-03] Direction-doc properties dropped under D-03 were folded into existing tokens where the role overlapped (Midnight's accent-2 cyan into info; Luxe's surface-sunken into border) rather than lost outright; recorded in .planning/todos/pending/theme-contract-dropped-properties.md.
- [Phase 06]: [Phase 06-03] font-display is fully wired (Tailwind class, CSS var, next/font load) but unused by any component in app/ or components/ — luxe's serif display face does not currently render anywhere; flagged in .planning/WINDOWS.md for plan 06-05.
- [Phase 06]: [Phase 06-04] Imported the appearance setting constants directly from lib/themes/active-theme.ts into the client ThemePresetGrid component per the plan's interface contract, verified via a real npm run build that this does not break the client bundle.
- [Phase 06]: [Phase 06-04] Settings hub tabs array gained a kind: "state" | "route" discriminant so the new Appearance entry navigates via next/link while the seven existing entries keep setActiveTab, with correct TS narrowing on tab.id.
- [Phase 06]: [Phase 06-05] Three of four light-preset scrim sites (Dialog, AlertDialog, Sheet) fixed to literal dark-alpha via the scanner's sentinel; category hero overlay accepted as-is after evidence-based inspection. — bg-surface/NN composited to near-invisible near-white under luxe for the modal/drawer backdrops (verified live and via compositing tests); the category hero's different job and weaker opacity supported a genuinely different outcome, not a blanket fix.
- [Phase 06.1]: [Phase 06.1] [06.1-01] Every clinical token value copied verbatim from 06.1-UI-SPEC.md's pre-computed table, including its one flagged deviation (primary/ring darkened to #00828a, 4.61:1) -- no oklch value re-derived by hand.
- [Phase 06.1]: [Phase 06.1] [06.1-01] Clinical ships no new font dependency -- both font tokens stay the existing Geist stack byte-identical to volt-dark.css, proving the pipeline's thinnest possible slice with zero app/layout.tsx involvement.
- [Phase 06.1]: [Phase 06.1] [06.1-02] Font weight arrays (Orbitron [600,700,800], Fraunces [500,600,700,800], Nunito [600,700,800]) extend each UI-SPEC floor with the storefront's actual font-semibold/font-bold/font-extrabold heading classes rather than the doc's bare minimum.
- [Phase 06.1]: [Phase 06.1] [06.1-02] Market's success token deliberately keeps the direction doc's literal, uncorrected value even though primary (same hue family) needed a contrast correction -- success renders as tinted text/panel backgrounds, not solid white-on-green button text, so the AA failure forcing primary's correction doesn't apply.
- [Phase 06.1]: [Phase 06.1] [06.1-03] Fixed a real CSS scoping bug beyond the plan's design: a custom property whose value nests a var() reference resolves at the element that DECLARES it ([data-theme] on <html>), not the element that CONSUMES it (<body>'s font-family) -- applied the six next/font variable classes to <html> as well as <body>.
- [Phase 06.1]: [Phase 06.1] [06.1-03] document.fonts.check() must query at the heading's own live rendered font-weight, not the default 400 -- Orbitron/Fraunces/Nunito load no 400 cut, so a weight-naive check would have false-negatived three of the four new display faces.
- [Phase 06.1]: [06.1-04] SelectItem's focus highlight (focus:bg-surface-elevated) was byte-identical to its own SelectContent container background, invisible on every theme not just clinical; fixed to focus:bg-primary/10. — Discovered live via the checkout country Select while inspecting D-07's 'dropdown items' checklist item for Clinical's acid test; the fix is token-driven and needs no sentinel.
- [Phase 06.1]: [06.1-04] Atelier's ProductCard fill is kept even though the direction doc wants 'no card fills' -- per-theme component/markup overrides are rejected on principle. — A borderless-card variant scoped to Atelier alone would violate the milestone's tokens+enumerated-variants architecture; recorded as an accepted, reasoned leave-it, not a silent gap.
- [Phase 07]: Passing a resolved variant COMPONENT from the server category page into the client CategoryDisplay does not work (RSC cannot serialize a function/component prop); fixed by passing the resolved enum value (typed CategoryLayout) and doing the CATEGORY_LAYOUT_MAP lookup inside CategoryDisplay itself, still a single map access with no branching.
- [Phase 07]: Accepted two D1 reads per request for getLayoutSettings() (RESEARCH Pitfall 1) rather than sharing a memoised readAppearance() helper with getActiveTheme() -- keeps the new resolver fully independent of the frozen theme-resolver test suite.
- [Phase 07]: Home hero's split/full-bleed variants delegate fully to HomeHeroMinimal (not a placeholder image) when there is no featured product — Supersedes RESEARCH assumption A1 per the UI-SPEC's explicit decision
- [Phase 07]: Added components/layout/home/home-hero-map.ts, a small module not enumerated in 07-02's files_modified list — Mirrors category-layout-map.ts's precedent from 07-01 so the map's key/enum equality and every-member-renders invariants are directly testable
- [Phase 07]: [Phase 07] [07-03] PRODUCT_GALLERY_MAP and a sibling PRODUCT_GALLERY_LAYOUT map both live inside ProductDisplay.tsx (not a separate module) — both plain object lookups keyed by the gallery enum, never a comparison against a member name literal, giving each variant its own outer container/info-column geometry without a generic layout prop.
- [Phase 07]: [Phase 07] [07-03] productGallery declared optional on ProductDisplayProps with a DEFAULT_LAYOUTS fallback rather than required, because the plan's task/file split puts app/product/[slug]/page.tsx's wiring in Task 3 while the prop is introduced in Task 2, whose own typecheck gate had to stay green immediately after that commit.
- [Phase 07]: [Phase 07] [07-04] Icon substitution: used lucide-react's primary export names TextAlignCenter/SquareSplitHorizontal in place of the now-deprecated-alias names AlignCenter/SplitSquareHorizontal the UI-SPEC table listed, verified against the installed package's own type declarations.
- [Phase 07]: [Phase 07] [07-04] The whole Layout admin section (heading, subtitle, three radiogroups, Save button) lives inside components/admin/LayoutSwitches.tsx itself, not split with the page -- app/admin/settings/appearance/page.tsx's change is a two-line import+render addition, keeping ThemePresetGrid.tsx byte-for-byte unchanged.
- [Phase 07]: [Phase 07] [07-05] The three map-holding source files are category-layout-map.ts, home-hero-map.ts, and ProductDisplay.tsx (not the page files a shorthand read_first line named) -- the repo-wide contract test targets the files that actually declare each production map.
- [Phase 07]: [Phase 07] [07-05] Registered snap S-07-01: a 2-pixel, 1/255-intensity defaults-parity screenshot difference (product|390|resting) is headless-Chromium rendering noise, not a code regression -- root-caused via PIL pixel-diff and cross-validated against a passing source-level parity test, rather than tolerated or endlessly re-captured. Logged to WINDOWS.md #4.
- [Phase 08]: [Phase 08] [08-01] Settings-GET seed guard: compute the category-scoped (or whole) seed set first and only insert when non-empty, and scope the post-seed re-select the same way -- closes WINDOWS #3 without relying on Drizzle's untested insert().values([]) behavior.
- [Phase 08]: [Phase 08] [08-01] docs/theming.md's status line describes its actual in-progress, multi-plan state (sections land across 08-01/08-02/08-04/08-05) rather than a placeholder Draft/Accepted value.
- [Phase 08]: QA matrix: labels use phase-08-<combo>-<theme>, one settings POST per run, four carried-forward screenshot gaps accepted (not fought) — Matches RESEARCH.md's suggested naming; matches every prior phase's posture on order-status/Stripe/account/review-form gaps
- [Phase 08]: [Phase 08] [08-02] docs/theming.md's five-of-seven-corrections callout scopes to the six presets actually converted from docs/voltique-theme-direction.md (volt-dark predates it, relocated verbatim); retro is named as the one converted preset needing no correction.
- [Phase 08]: [Phase 08] [08-02] Added a new scripts/ entry to docs/CLAUDE.md's structure tree (none existed to splice the three theme/QA scripts under), matching the tree's existing glyph/comment-alignment convention.

### Pending Todos

None.

### Blockers/Concerns

Open items carried from v1 close (blocks v2 feature work; full list in `milestones/v1-MILESTONE-AUDIT.md`):

- [Needs Russell] Add `NEXT_PUBLIC_SITE_URL` as a Cloudflare Workers Build variable and redeploy (sitemap still advertises `mercora.example.com`)
- [Cloudflare hygiene] Delete the unused `ADMIN_USER_IDS` Worker secret
- [Backlog] Mobile Lighthouse scores 72-80 vs. target 85 on all four measured routes
- [Review 2026-12-01] Five moderate dev-only `npm audit` findings

Research flags for v2 execution (from `.planning/research/SUMMARY.md`):

Carried out of Phase 5:

- [Phase 5] `data/d1/seed.sql` products bulk insert has a row missing its `options` value; the documented `--file=data/d1/seed.sql` load fails. Not fixed (out of scope); a local-only D1 fixture was used for screenshots
- [Phase 5] Screenshot coverage gaps for Phase 8's visual QA: order-status (no seeded order), Stripe payment step (payment-intent 400 locally), authenticated account dashboard, review-form error state. Seed an order and a Clerk session before the cross-preset QA pass
- [Phase 5] Prose blocks (`prose-invert prose-orange`) run on Typography plugin defaults; prose accent colour will not follow a theme until Phase 6 wires typography colours off the CSS variables
- [Phase 5] `border-inverse` serves both drawer edges and email dividers; split into a second token in a later milestone only if a preset's email dividers read badly

Carried out of Phase 6 (see `.planning/WINDOWS.md`):

- [Needs Russell] Add `NEXT_PUBLIC_THEME_DEFAULT=volt-dark` as a Cloudflare Workers Build variable before the next deploy
- [Phase 6] `--store-font-display` is wired end to end but no component applies the `font-display` class, so Luxe's serif headings never render — **closed at 06.1-03**: `font-display` is applied to all 23 storefront headings, the `volt-dark` change is registered as intentional snap `S-TYPE-01`, and WINDOWS #1 is marked fixed
- [Phase 6] `app/api/admin/settings/route.ts` GET re-inserts the entire `defaultSettings` array when a category filter returns no rows; would 500 a fresh install's first Appearance-page load. Pre-existing, out of scope so far (WINDOWS #3)
- [Phase 6] Admin Appearance page has not been walked through in a real browser with a Clerk admin session; Dialog/AlertDialog scrims under `luxe` verified by compositing test only (WINDOWS #2)
- [Phase 6] Four more preset specs (Clinical, Retro, Atelier, Market) — **shipped at Phase 6.1** (06.1-01 through 06.1-04); the direction doc's extra properties (shadow, border-width, image-aspect, some `accent-2` values, font-mono, letter-spacing) remain backlog, recorded per preset in `.planning/todos/pending/theme-contract-dropped-properties.md` (luxe/midnight) and `.planning/todos/pending/theme-direction-doc-backlog-06.1.md` (clinical/retro/atelier/market)
- [Phase 06-04] app/api/admin/settings/route.ts's GET ?category=X inserts the full defaultSettings array (all categories) when the filtered result is empty; appearance has no defaults, so a fresh DB with other categories already populated would 500 on the Appearance page's own load. Out of scope for 06-04 (interfaces explicitly forbid touching this file); logged in WINDOWS.md #3.

### Roadmap Evolution

- Phase 06.1 inserted after Phase 6: Remaining presets from the theme direction doc (Clinical, Retro, Atelier, Market) — Russell asked for all six during autonomous run (URGENT)

Carried out of Phase 7 (see `.planning/WINDOWS.md`):

- [Phase 7] Admin Layout section and Appearance theme grid have not had a real-browser Clerk-session walkthrough; both verified by dev-bypass probes and render tests only
- [Phase 7] Two image-URL resolvers coexist (`gallery-media-url.ts` verbatim from ProductDisplay vs `lib/utils/product-image.ts`); consolidate when the product display is next touched
- [Phase 7] Pre-extraction parity tests self-write a missing baseline snapshot; snapshots are committed today, but a deleted snapshot would silently regenerate

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-05T16:40:16.030Z
Stopped at: Completed 08-02-PLAN.md
Resume file: None

Next: `/gsd-discuss-phase 8` (or `/gsd-plan-phase 8` directly) to start Documentation & Visual QA Close-out
