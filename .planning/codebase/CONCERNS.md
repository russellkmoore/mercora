# Codebase Concerns

**Analysis Date:** 2026-08-31

## Critical Production Issues

### Flat Tax Rate Fallback for All Jurisdictions

**Issue:** Tax calculation falls back to `configured_fallback` (flat 8.25%) when Stripe Tax fails
- `lib/services/checkout-pricing.ts` lines 674-729: try/catch around `deps.calculateTax()` silently falls back to flat rate; `taxSource = 'configured_fallback'` is set at line 712
- `storeSettings['store.tax_rate']` is a single percentage applied uniformly
- Only correct for a single jurisdiction; breaks multi-state/multi-country compliance
- No telemetry event fires when the fallback is used (verified 2026-09-01: no `recordTelemetry` or `console.warn` on that path), so customers may overpay or underpay tax with no operator signal

**Files:**
- `lib/services/checkout-pricing.ts` lines 674-729

**Impact:** Tax compliance violations; customer overpayment/underpayment; audit risk

**Fix approach:**
1. Emit a `commerce.telemetry.v1` event on fallback with low-cardinality fields only (tracked as OBS-01)
2. Add a monitoring alert on that event
3. Implement address-based tax lookup (Stripe Tax for primary, jurisdictional DB for secondary) — larger scope, not in v1
4. Consider requiring Stripe Tax for multi-jurisdiction stores

---

## Type Safety & Runtime Regressions

### Loose `any` Type on Dynamic Route Props

**Issue:** Pages typed as `{ params }: any` defeat Next.js 16's strict Promise-typed params
- `app/product/[slug]/page.tsx` line 60: `export default async function ProductPage({ params }: any)`
- `app/category/[slug]/page.tsx` line 52: `export default async function CategoryPage({ params }: any)`
- Silently broke `/product/[slug]` and `/category/[slug]` in production until manually fixed
- Any remaining `any` on route props creates the same latent bug

**Files:**
- `app/product/[slug]/page.tsx` line 60
- `app/category/[slug]/page.tsx` line 52
- 30+ other instances of `: any` throughout admin pages and components

**Impact:** Type safety disabled; runtime failures undetected by TypeScript; regressions on Next.js version upgrades

**Fix approach:**
1. Type `params` as `Promise<{ slug: string }>` and `await` it in both `[slug]` pages (tracked as OBS-03)
2. Audit all `any` casts in admin pages (`ProductManagement.tsx`, `AdminPage.tsx`, etc.) and replace with proper types

**Note (corrected 2026-09-01):** `tsconfig.json` already sets `"strict": true` and CI already runs `npm run typecheck` and `npm run cf-typecheck`. Strict mode does not reject an explicit `: any` annotation, so "run tsc in strict mode in CI" was never the missing gate. The gap is the explicit escape hatches themselves.

---

## Orphaned & Dead Code

### Empty API Route Directories with No Callers

**Issue:** Twelve empty directories under `app/api/` have no `route.ts` and no references in the codebase (re-verified 2026-09-01 with `find app/api -type d -empty`):

`submit-order`, `update-order`, `vectorize-products`, `vectorize-knowledge`, `test-email`, `send-email`, `user-orders`, `admin/generate-token`, `mach/customers`, `mach/orders`, `mach/products`, `debug/user-id`

**Scope (corrected 2026-09-01):** git does not track empty directories, and `git ls-files` confirms none of these hold tracked files. They exist only in local working trees left over from deleted routes. A fresh clone does not have them. This is local clutter, not a repository defect.

**Impact:** Confuses developers reading the tree locally; risk of a ghost route being re-implemented

**Fix approach:**
1. Locally: `find app/api -type d -empty -delete`
2. No repository change is possible or needed (a `.gitignore` rule cannot affect directories git already ignores)

---

## Configuration & Environment Issues

### Demo Defaults Silently Reach Production

**Issue:** `lib/store-config.ts` line 88-108 ships neutral demo defaults that override missing env vars
- Line 97-98: `supportEmail: "support@mercora.example.com"` and `senderEmail: "Mercora <support@mercora.example.com>"`
- Line 103: `site: "https://mercora.example.com"`
- If operator forgets to set `NEXT_PUBLIC_SITE_URL`, production advertises `mercora.example.com` in sitemaps/metadata
- If operator forgets to set `STORE_SUPPORT_EMAIL`, transactional emails send from `@example.com`

**Files:**
- `lib/store-config.ts` lines 88-108 (defaults)
- `lib/store-config.ts` lines 236, 380 (resolution logic with fallbacks)

**Existing guard (added 2026-09-01):** `scripts/check-deploy-config.mjs` already runs as `predeploy` and `predeploy:ci`. It fails the deploy on any `REPLACE_WITH_` placeholder in `wrangler.jsonc`, and on a missing https `NEXT_PUBLIC_SITE_URL` when `NEXT_PUBLIC_ROBOTS_INDEX` is `"true"`. It does not check the email defaults, and it does not check `NEXT_PUBLIC_SITE_URL` for non-indexable deployments. Note that `NEXT_PUBLIC_SITE_URL` and `STORE_SUPPORT_EMAIL` are not in `wrangler.jsonc` `vars` at all; if they are set, it is as Workers Build or dashboard variables, which this script cannot see.

**Impact:** Production site advertises placeholder domain; emails appear to come from non-existent address; brand damage; deliverability issues

**Fix approach:**
1. Extend `check-deploy-config.mjs` to fail when the resolved `STORE_SUPPORT_EMAIL` / `STORE_SENDER_EMAIL` still match `@mercora.example.com`, and to require `NEXT_PUBLIC_SITE_URL` regardless of the robots flag
2. Document required env vars clearly in deployment guide

---

## Build Process Fragility

### Cloudflare Type Generation Not Synced With wrangler.jsonc

**Issue:** Adding a binding or var to `wrangler.jsonc` requires running `npm run cf-typegen` to regenerate `cloudflare-env.d.ts`
- `package.json` line 33: `cf-typegen` regenerates the file; line 34: `cf-typecheck` runs the same `wrangler types` command with `--check` and fails if the committed file is stale
- Easy step to miss locally; CI runs `cf-typecheck` and catches it

**Correction (2026-09-01):** the earlier claim that the failure "cannot be reproduced locally" was wrong. `npm run cf-typecheck` is the exact CI command and reproduces it in seconds. The safety net already exists; the cost is one CI round-trip when someone forgets.

**Files:**
- `package.json` line 33-34
- `cloudflare-env.d.ts` (generated, 543KB)
- `docs/customer-communications.md` line 62 (documents the requirement)

**Impact:** One wasted CI run per forgotten regen. Low.

**Fix approach:**
1. Optional: a pre-commit hook that runs `cf-typegen` when `wrangler.jsonc` is staged
2. Document this as a common gotcha in onboarding guide

### Test Env Isolation Issue in cf-typecheck

**Issue:** `npm run cf-typecheck` fails when `.env.local` exists in local dev environment
- `.env.local` regenerates types with local environment variable names visible in generated file
- CI environment doesn't have `.env.local`, so generates different types
- Creates type mismatches: CI sees only secret names, local sees actual values exposed in generated types

**Files:**
- `package.json` line 34 (`cf-typecheck` script)
- Implicit: wrangler behavior when `.env.local` present

**Impact:** Local typecheck passes, CI typecheck fails; requires env cleanup to reproduce CI failure locally

**Status:** unverified. This entry was written from inference, not from a reproduced failure. Confirm it before acting on it.

**Fix approach:**
1. Reproduce first: with `.env.local` present, run `npm run cf-typecheck` and confirm it fails
2. If confirmed, run `cf-typecheck` with an equivalent of `--exclude-env-local`, or document that `.env.local` vars must not be referenced in types
3. `.env*.local` is already in `.gitignore` (line 30); nothing to do there

---

## Error Handling & Observability

### Generic Error Message Hides Distinct Failures

**Issue:** Payment pricing endpoint returns one generic string to the customer for every pricing failure
- `app/api/payment-intent/route.ts` line 119: all pricing errors return `"Checkout details are invalid or unavailable"`
- Could be tax failure, product unavailability, coupon validation failure, shipping config issue, etc.
- The customer gets no hint about what to change

**What already exists (corrected 2026-09-01):** the catch block at line 115 calls `recordTelemetry('payment.pricing_rejected', …, error)`, and the telemetry envelope records `error_class` from the thrown error's name (`lib/observability/telemetry.ts:206-254`). So operators do get a signal. The limit is that `error_class` is an allowlist and anything not on it collapses to `OtherError`, so distinct pricing failures may still look identical in telemetry.

**Files:** `app/api/payment-intent/route.ts` line 114-122; `lib/observability/telemetry.ts` `ALLOWED_ERROR_CLASSES`

**Impact:** Customer cannot self-correct; operator diagnosis depends on whether the specific error class is on the allowlist

**Fix approach:**
1. Give pricing failures distinct, named error classes and add them to `ALLOWED_ERROR_CLASSES` so telemetry separates them
2. Then, where safe, map a few recoverable classes to specific customer messages (`"Coupon is not valid"`, `"Shipping method not available"`). Keep availability and tax internals generic.

---

## Code Complexity & Maintenance Concerns

### Large, Complex Service Files

**Issue:** Several key service files approach or exceed 900 lines and handle multiple responsibilities (sizes re-checked 2026-09-01). Splitting them is listed as out of scope in PROJECT.md until a feature touches them.

**Files with complexity concerns:**
- `lib/services/checkout-pricing.ts` (811 lines) — pricing, tax, discounts, shipping allocation all in one file
- `lib/models/reviews.ts` (1222 lines) — review operations, filtering, aggregation
- `lib/models/mach/products.ts` (956 lines) — product fetching, variant logic, search operations
- `lib/models/mach/inventory.ts` (921 lines) — inventory adjustments, tracking, validation
- `app/api/agent-chat/route.ts` (922 lines) — chat logic, response generation, guards all mixed

**Impact:** 
- Hard to test individual concerns
- Difficult to onboard new developers
- High risk of unintended side effects when modifying
- Promotion of cutting corners with copy-paste code

**Fix approach:**
1. Split checkout-pricing.ts into: price-calculator, tax-allocator, discount-resolver, shipping-resolver
2. Create dedicated files for complex operations
3. Add integration tests that verify cross-module contracts

### Multiple Unfinished TODO Markers

**Issue:** Incomplete implementations marked but not tracked

**Files (re-verified 2026-09-01; these are the only two TODO/FIXME markers in `app/`, `lib/`, and `components/`):**
- `app/api/webhooks/stripe/route.ts:351`: `// TODO: Implement order status update` — the whole `handlePaymentFailed` body is this comment. Tracked as OBS-05 (implement or remove).
- `lib/hooks/useEnhancedUserContext.ts:140`: `favoriteCategories` is always `[]` — `// TODO: Implement with product category mapping`. Personalization silently lacks category affinity. Not tracked; low impact.

**Impact:** Features partially implemented; may be forgotten; inconsistent behavior if someone relies on partial implementation

**Fix approach:**
1. Convert TODOs to GitHub issues with severity labels
2. Add due dates to deployment-blocking TODOs
3. Never merge code with TODO comments for critical paths

---

## Testing & Coverage Gaps

### Untested Area: Route Parameter Types

**Issue:** Dynamic pages use `any` types for params; type safety cannot be tested
- TypeScript ignores the param types entirely
- Integration tests run, but type regressions are invisible until runtime

**Files:**
- `app/product/[slug]/page.tsx` line 60
- `app/category/[slug]/page.tsx` line 52

**Risk:** High — this bug broke production before and could again on a Next.js upgrade

**Priority:** High

**Safe modification approach:**
1. Replace the explicit `: any` with `Promise<{ slug: string }>` (strict mode is already on and typecheck already runs in CI; see the correction under Type Safety above). Tracked as OBS-03.
2. Add a test that verifies `/product/invalid-slug` and `/category/invalid-slug` return 404 (not error 500, and not a 200 "not found" div)

---

## Fragile Areas Requiring Careful Modification

### Discount & Promotion Allocation Logic

**Files:** `lib/services/checkout-pricing.ts` lines 252-280 (allocateDiscount function)

**Why fragile:** 
- Distributes discount across eligible lines using complex math
- Rounding edge cases could cause penny discrepancies
- Tests must verify every combination of discount type + line count

**Safe modification approach:**
1. Add property-based tests (fast-check) that verify: final total = items - discount + tax
2. Never modify allocation math without adding 10+ test cases
3. Spot-check real orders monthly for penny-rounding issues

### Tax Allocation Fallback

**Files:** `lib/services/checkout-pricing.ts` lines 451-480 (allocateLargestRemainder function)

**Why fragile:**
- Allocates tax remainder using "largest remainder method"
- Off-by-one errors here cause customer refunds or lost tax

**Test coverage (corrected 2026-09-01):** an earlier draft said no unit tests covered this. That was wrong. `tests/unit/lib/services/checkout-pricing.test.ts:525` ("uses largest remainders so fallback line taxes remain integer and sum exactly") already asserts integer allocation and an exact sum. The remaining gap is breadth, not existence: the existing test covers one line-count shape.

**Safe modification approach:**
1. Extend the existing test with 1, 2, 10, and 100 line items and penny-rounding edge cases (tracked as OBS-04)
2. Keep the invariant: sum of allocated tax === total tax

---

## Security Considerations

### Admin Authentication Development Bypasses (verified: production fails closed)

**Issue:** Two development-only admin bypasses exist. Both are gated on
`process.env.NODE_ENV === "development"`, so production is NOT exposed.
Corrected 2026-08-31 after direct verification — an earlier draft of this
document claimed production admin endpoints were public. That was wrong.

- `lib/auth/admin-middleware.ts:22` — returns `{ success: true, userId: "dev-admin" }`,
  but only when the `x-dev-admin` header equals the literal `mercora-dev-bypass`
  AND `NODE_ENV === "development"`. Both conditions are required.
- `lib/auth/unified-auth.ts:163` — treats any signed-in Clerk user as admin,
  but only when `NODE_ENV === "development"`.

`lib/auth/unified-auth.ts:85` states the intent explicitly: "Production fails closed."

**Files:**
- `lib/auth/admin-middleware.ts`
- `lib/auth/unified-auth.ts`

**Residual risk (low, but real):** the guard is only as good as `NODE_ENV` in the
deployed Worker. Next.js bakes `NODE_ENV=production` into a production build, so
this holds today. It would break if a development build were ever deployed, or if
`NODE_ENV` were added to `wrangler.jsonc` vars with the wrong value — note that
`nodejs_compat_populate_process_env` copies those vars into `process.env`.

**Suggested hardening:** assert `NODE_ENV !== "development"` at Worker startup,
so a misbuilt deploy fails loudly instead of silently opening admin routes.

---

## Accepted Risks

Known, decided, and not fix targets. Listed so nobody re-raises them.

### Test-Mode Publishable Keys in Production

**Decided:** 2026-09-01 by the owner.

- `wrangler.jsonc` lines 96-97 carry `pk_test_*` publishable keys for Stripe and Clerk.
- The deployed site is a demo environment with no live Stripe account. Test mode is intentional.
- Publishable keys are public by design (they ship to the browser), so keeping them in a tracked config file is not a secret leak. Secrets (`STRIPE_SECRET_KEY`, `CLERK_SECRET_KEY`, `ADMIN_VECTORIZE_TOKEN`) live in Worker secrets and `.dev.vars`, which is gitignored.
- `wrangler.jsonc` stays tracked: Cloudflare Workers Builds clones the repo, and `scripts/build-with-public-env.mjs`, `d1-migrate.mjs`, `check-deploy-config.mjs`, and `db-local-ensure.mjs` all read it.

**Revisit when:** a live Stripe account is attached. Swap the two `vars` values for `pk_live_*` keys and confirm the `NEXT_PUBLIC_*` Workers Build variables match (build-time vars are separate from runtime vars).

---

*Concerns audit: 2026-08-31; corrected 2026-09-01 after code verification*
