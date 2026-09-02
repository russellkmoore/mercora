# Codebase Concerns

**Analysis Date:** 2026-08-31

## Critical Production Issues

### Test-Mode Publishable Keys in Production (accepted, not a defect)

**Status:** Accepted by the owner on 2026-09-01. Not a fix target.

- `wrangler.jsonc` lines 96-97 carry `pk_test_*` publishable keys for Stripe and Clerk.
- The deployed site is a demo environment with no live Stripe account. Test mode is intentional.
- Publishable keys are public by design (they ship to the browser), so keeping them in a tracked config file is not a secret leak. Secrets (`STRIPE_SECRET_KEY`, `CLERK_SECRET_KEY`, `ADMIN_VECTORIZE_TOKEN`) already live in Worker secrets and `.dev.vars`, which is gitignored.
- `wrangler.jsonc` must stay tracked: Cloudflare Workers Builds clones the repo, and `scripts/build-with-public-env.mjs`, `d1-migrate.mjs`, `check-deploy-config.mjs`, and `db-local-ensure.mjs` all read it.

**Revisit when:** a live Stripe account is attached. At that point swap the two `vars` values for `pk_live_*` keys and confirm `NEXT_PUBLIC_*` Workers Build variables match (see project memory on build-time vars).

### Flat Tax Rate Fallback for All Jurisdictions

**Issue:** Tax calculation falls back to `configured_fallback` (flat 8.25%) when Stripe Tax fails
- `lib/services/checkout-pricing.ts` lines 674-729: try/catch around `deps.calculateTax()` silently falls back to flat rate
- `storeSettings['store.tax_rate']` is a single percentage applied uniformly
- Only correct for a single jurisdiction; breaks multi-state/multi-country compliance
- No warning when fallback is used; customers may overpay or underpay tax

**Files:**
- `lib/services/checkout-pricing.ts` lines 674-729
- `lib/store-config.ts` line 713 (fallback rate resolution)

**Impact:** Tax compliance violations; customer overpayment/underpayment; audit risk

**Fix approach:**
1. Implement address-based tax lookup (Stripe Tax for primary, jurisdictional DB for secondary)
2. Log when fallback is used with destination address for audit trail
3. Add monitoring alert when fallback rate is applied
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

**Issue:** Multiple empty directories exist with no `route.ts` files and no references in the codebase

**Files (all empty):**
- `app/api/submit-order/` — no route.ts, no callers anywhere
- `app/api/update-order/` — no route.ts, no callers
- `app/api/vectorize-products/` — no route.ts, no callers
- `app/api/vectorize-knowledge/` — no route.ts, no callers
- `app/api/test-email/` — no route.ts, no callers
- `app/api/send-email/` — no route.ts, no callers
- `app/api/user-orders/` — no route.ts, no callers
- `app/api/admin/generate-token/` — no route.ts, no callers
- `app/api/mach/customers/` — no route.ts, no callers
- `app/api/mach/orders/` — no route.ts, no callers
- `app/api/mach/products/` — no route.ts, no callers
- `app/api/debug/user-id/` — no route.ts, no callers

Verified 2026-08-31 with `find app/api -type d -empty`: 12 empty directories, not 9.
- `app/api/mach/products/` — no route.ts, no callers
- `app/api/mach/orders/` — no route.ts, no callers
- `app/api/debug/user-id/` — no route.ts, no callers

**Impact:** Clutters codebase; confuses developers about available endpoints; ghost routes that might get accidentally implemented

**Fix approach:**
1. Delete all 12 empty directories
2. Add `.gitignore` rule to prevent empty dirs
3. Document all active API endpoints in `STRUCTURE.md`

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

**Impact:** Production site advertises placeholder domain; emails appear to come from non-existent address; brand damage; deliverability issues

**Fix approach:**
1. Add startup validation: throw error if `NEXT_PUBLIC_SITE_URL`, `STORE_SUPPORT_EMAIL`, or `STORE_SENDER_EMAIL` use example.com defaults
2. Document required env vars clearly in deployment guide
3. Add pre-flight check in `check-deploy-config.mjs` to validate config before build

---

## Build Process Fragility

### Cloudflare Type Generation Not Synced With wrangler.jsonc

**Issue:** Adding a variable to `wrangler.jsonc` requires running `npm run cf-typegen` to regenerate types
- Script at line 33 in `package.json`: `cf-typegen`
- Must regenerate `cloudflare-env.d.ts` after every wrangler.jsonc change
- Easy step to miss in local development; CI catches it
- Generates TypeScript errors that cannot be reproduced locally without setting up exact CI environment

**Files:**
- `package.json` line 33-34
- `cloudflare-env.d.ts` (generated, 543KB)
- `docs/customer-communications.md` line 62 (documents the requirement)

**Impact:** CI/local parity broken; developers can commit code that passes locally but fails in CI; requires CI re-run after fixes

**Fix approach:**
1. Add `precommit` hook to auto-run `cf-typegen` if `wrangler.jsonc` changes
2. Or: add check in `npm run build` to verify types are current
3. Document this as a common gotcha in onboarding guide

### Test Env Isolation Issue in cf-typecheck

**Issue:** `npm run cf-typecheck` fails when `.env.local` exists in local dev environment
- `.env.local` regenerates types with local environment variable names visible in generated file
- CI environment doesn't have `.env.local`, so generates different types
- Creates type mismatches: CI sees only secret names, local sees actual values exposed in generated types

**Files:**
- `package.json` line 34 (`cf-typecheck` script)
- Implicit: wrangler behavior when `.env.local` present

**Impact:** Local typecheck passes, CI typecheck fails; requires env cleanup to reproduce CI failure locally

**Fix approach:**
1. Run `cf-typecheck` in CI with `--exclude-env-local` flag or equivalent
2. Document that `.env.local` vars should not be referenced in types
3. Add `.env.local` to `.gitignore` explicitly (should already be there)

---

## Error Handling & Observability

### Generic Error Message Hides Distinct Failures

**Issue:** Payment pricing endpoint collapses all errors into one generic string
- `app/api/payment-intent/route.ts` line 119: all pricing errors return `"Checkout details are invalid or unavailable"`
- Could be tax failure, product unavailability, coupon validation failure, shipping config issue, etc.
- Makes production outages hard to diagnose from user reports
- Operators cannot distinguish between recoverable and permanent failures

**Files:** `app/api/payment-intent/route.ts` line 114-122

**Impact:** Slow incident diagnosis; hidden patterns in checkout failures; poor telemetry signal for operations

**Fix approach:**
1. Differentiate error responses: `"Tax calculation unavailable"`, `"Shipping method not available"`, `"Product out of stock"`, etc.
2. Include error category in telemetry but not in user-facing message
3. Add structured logging with specific failure reason for operators

---

## Code Complexity & Maintenance Concerns

### Large, Complex Service Files

**Issue:** Several key service files exceed 900 lines and handle multiple responsibilities

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

**Files:**
- `app/api/webhooks/stripe/route.ts` line comment: `// TODO: Implement order status update`
- `lib/hooks/useEnhancedUserContext.ts` line comment: `// TODO: Implement with product category mapping`

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

## Dependencies at Risk

### Stripe Test Keys Active

**Files:** `wrangler.jsonc` lines 96-97

**Risk:** None while the site is a demo. Accepted by the owner; see the first entry in this document.

---

*Concerns audit: 2026-08-31*
