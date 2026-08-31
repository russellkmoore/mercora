# Codebase Concerns

**Analysis Date:** 2026-08-31

## Critical Production Issues

### Test API Keys in Production Configuration

**Issue:** Production deployment uses Stripe and Clerk test mode publishable keys
- `wrangler.jsonc` lines 96-97 contain `pk_test_*` keys for both Stripe and Clerk
- Test keys cannot process real transactions or authenticate real users
- Orders cannot be taken as currently configured

**Files:** `wrangler.jsonc`

**Impact:** Complete payment processing failure in production; no real transactions possible

**Fix approach:**
1. Use environment secrets in Cloudflare (not vars) for production publishable keys
2. Keep test keys only in local `.env.local`
3. Verify CI/production builds fetch keys from secrets, not wrangler.jsonc
4. Add deployment validation to reject test keys at build time

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
1. Use proper `Awaitable<{ slug: string }>` type for all `[slug]` pages
2. Run tsc in strict mode in CI to catch all type escapes
3. Audit all `any` casts in admin pages (`ProductManagement.tsx`, `AdminPage.tsx`, etc.) and replace with proper types

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
1. Add TypeScript strict mode check to CI that fails on `any` in route handlers
2. Add E2E test that verifies `/product/invalid-slug` returns 404 (not error 500)

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
- No unit tests currently verify correctness for all line counts

**Safe modification approach:**
1. Add deterministic tests with mock tax amounts: `[100, 200, 50]` items with `1234` tax cents
2. Verify: sum of allocated tax === total tax
3. Test with 0, 1, 10, 100+ line items

---

## Security Considerations

### Admin Authentication Currently Disabled

**Issue:** Admin endpoints bypass authentication in development but must be re-enabled for production
- `lib/auth/admin-middleware.ts` returns `{ success: true, userId: "dev-admin" }` without validation
- `lib/auth/unified-auth.ts` bypasses all checks in development
- Requires explicit re-enabling; easy to forget before production deploy

**Files:**
- `lib/auth/admin-middleware.ts`
- `lib/auth/unified-auth.ts`
- Documented in `/docs/CLAUDE.md`

**Risk:** If deployed to production as-is, all admin endpoints are public

**Mitigation:**
- Already has placeholder for token-based auth (ADMIN_VECTORIZE_TOKEN)
- Documented in deployment guide

---

## Dependencies at Risk

### Stripe Test Keys Active

**Files:** `wrangler.jsonc` lines 96-97

**Risk:** Already listed in Production Issues section above

---

*Concerns audit: 2026-08-31*
