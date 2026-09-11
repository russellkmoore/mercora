# Phase 17: Saved Payment Methods - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss. Russell was away; grey areas took the recommended, most-conservative answer for money/PCI-adjacent code. Source: Russell's own todo (`.planning/todos/pending/saved-payment-methods.md`), written after discovering Stripe Link's "Save my information" saved nothing to the store.

<domain>
## Phase Boundary

A signed-in shopper can save a card at checkout (a real Stripe Customer per Clerk user, PaymentIntent created against it) and reuse or remove it later from Account → Payment methods. A guest sees the plain card form and no saved-method UI. Card data (PAN) never touches our servers — Stripe Elements/Stripe's own Customer + saved-payment-method APIs do the tokenization and storage; the store only holds a Stripe customer id and, transiently, payment-method ids returned by Stripe for display. Requirements PAY-01..03. No change to gift-card tender, reservations, refunds, or subscription billing — this phase adds a parallel, independent customer↔Stripe-customer binding for checkout, not a shared one with subscriptions.
</domain>

<decisions>
## Implementation Decisions

### Data model — independent of subscriptions
- **D-01:** New expand-only migration `0025_add_payment_customers.sql`: table `payment_customers` — `customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE RESTRICT`, `stripe_customer_id TEXT NOT NULL UNIQUE CHECK (length BETWEEN 5 AND 255 AND GLOB 'cus_*')`, `created_at`, `updated_at` — modeled byte-for-byte on the existing `subscription_provider_customers` table shape (`lib/db/schema/subscriptions.ts`) but as its own table, its own migration, its own Drizzle export (`lib/db/schema/payments.ts` `paymentCustomers`).
- **D-02 (Claude's call, recorded for Russell):** Deliberately **not** reusing `subscription_provider_customers`/`lib/subscriptions/repository.ts`'s `findProviderCustomer`/`bindProviderCustomer`. Reuse would mean one shared Stripe Customer for both subscriptions and checkout (arguably the more correct real-world model — one person, one Stripe customer) but requires touching revenue-critical, already-shipped subscription code during an unattended run, which this run avoids. The cost: a shopper who both subscribes and saves a card at checkout ends up with two separate Stripe Customer objects. Logged as a Phase 18 tech-debt todo: consolidate to one `payment_customers`-style table shared by both features, with subscriptions migrated onto it.
- **D-03:** New module `lib/payments/customer-binding.ts` mirrors `establishProviderCustomer`'s idempotent find-or-create/conflict-reconciliation pattern (`lib/subscriptions/acquisition-service.ts`) against the new table: `ensureStripeCustomer({ customerId, email, name, stripe }): Promise<string>` — checks the table first, else creates via `stripe.customers.create({ metadata: { mercora_customer_id }, email, name }, { idempotencyKey })` (idempotency key derived deterministically from `customerId`, same `stableId` helper used elsewhere), binds via `INSERT OR IGNORE` + re-read-on-conflict, verifies the winner's Stripe customer id if a race occurred.

### Checkout flow
- **D-04:** In `app/api/payment-intent/route.ts`, immediately after the existing `getCustomer(userId)`/`createCustomer` block (only when `userId` is non-null — guests skip entirely), call `ensureStripeCustomer(...)` to get a `stripeCustomerId`. Failure to establish the Stripe customer must not block checkout: log/telemetry and fall through to a customer-less PaymentIntent (guest-equivalent behavior) rather than 503ing the whole purchase — saving a card is a convenience, not a checkout blocker.
- **D-05:** When a `stripeCustomerId` is available and a PaymentIntent is actually created (the non-zero-cash branch; the zero-cash gift-card path at line ~242 is untouched), `createPaymentIntent` is called with `customer: stripeCustomerId` only — no `setup_future_usage` field (see D-06a). A Customer Session is created alongside it (D-06) and its client secret returned to the client in the same response payload as the PaymentIntent's `clientSecret`.
- **D-06 (resolved by 17-RESEARCH.md, verified against installed SDK types and live Stripe docs):** A **Stripe Customer Session** (`stripe.customerSessions.create({ customer: stripeCustomerId, components: { payment_element: { enabled: true, features: { payment_method_save: 'enabled', payment_method_save_usage: 'off_session', payment_method_redisplay: 'enabled', payment_method_remove: 'disabled' } } } })`) is what makes the Payment Element show saved cards and a "save this card" checkbox. Its `client_secret` is returned to the client and passed as `customerSessionClientSecret` to `stripe.elements()`/`<Elements options={...}>` (confirmed in the installed `@stripe/stripe-js` 9.14.0 types), alongside the existing PaymentIntent `clientSecret`.
- **D-06a (correction — do not set `setup_future_usage` on the PaymentIntent):** Stripe's own docs state combining an explicit `setup_future_usage` on the PaymentIntent with the Customer Session's `payment_method_save_usage` causes an integration error. `usage: 'off_session'` lives only in the Customer Session config (D-06); Stripe.js applies `setup_future_usage` automatically at `confirmPayment()` time based on the shopper's checkbox state. This corrects the roadmap success criterion's literal phrasing ("creates the PaymentIntent... with setup_future_usage") — the *effect* (the card ends up saved for off-session use) is achieved through the Customer Session, not a PaymentIntent field.
- **D-06b:** No webhook is needed (confirms D-13): card save/attach is synchronous with `confirmPayment()`, verified against Stripe's current docs.
- **D-06c:** `lib/payments/` already exists (refund logic) — the new binding module is `lib/payments/customer-binding.ts` inside that existing namespace, not a new top-level directory; the planner must check for filename collisions there.
- **D-07:** Guest checkout is completely unaffected: no Stripe customer lookup, no Customer Session, no saved-method UI, identical to today's flow. The existing `userId: string | null` prop already threaded through `CheckoutClient.tsx` is the single source of truth for the branch — no new signed-in detection is added.

### Account → Payment methods
- **D-08:** New route `app/api/account/payment-methods/route.ts` (GET, list) and `app/api/account/payment-methods/[id]/route.ts` (DELETE, remove), following `app/api/account/addresses/route.ts`'s exact shape: `await auth()` → 401; `hasSameOrigin(request)` → 403 on DELETE; bounded request; typed error codes. GET reads the bound `stripeCustomerId` (404 `no_payment_customer` if the shopper has never saved a card — an empty list, not an error, is the friendlier response, so GET returns `{ paymentMethods: [] }` rather than 404 when no binding exists) then `stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' })`, projecting only `{ id, brand, last4, expMonth, expYear }` — no Stripe internal ids beyond the payment-method id itself, no billing details.
- **D-09:** DELETE verifies ownership before detaching: retrieve the payment method from Stripe, confirm `.customer === stripeCustomerId` for the *signed-in* shopper's own binding, only then `stripe.paymentMethods.detach(id)`. A payment method that doesn't belong to the caller returns 404 (not 403, to avoid confirming existence), matching the "don't leak" convention used elsewhere in this codebase (e.g. the gift-card balance route).
- **D-10:** New page `app/account/payment-methods/page.tsx` (server component, `auth()` gate like `app/account/addresses/page.tsx`) rendering a client component `components/account/PaymentMethodList.tsx` modeled directly on `AddressManager`'s list-with-remove-button pattern (card per row: brand + last4 + expiry, a "Remove" button, busy/disabled states during the delete call, an inline message region). No add-a-card UI on this page — cards are only added during checkout (per the todo's scope); the page is read/remove only.
- **D-11:** `components/account/AccountNav.tsx` gets a new "Payment methods" entry, added the same way Subscriptions was — but **unconditional** (no feature flag), since PAY-01..03 don't describe a toggle and Stripe is always configured in this store (test mode).

### Stripe Link
- **D-12:** `link: 'never'` in `components/checkout/PaymentForm.tsx` stays exactly as-is. The stale code comment explaining why Link is disabled ("the store has no saved-payment-method feature") is updated to explain the store now has its own saved-card feature and Link is deliberately still disabled — re-enabling Link is a separate, explicit future decision (per the roadmap's own wording "unless it is deliberately re-enabled alongside this feature"), not something this phase does.

### Webhooks
- **D-13 (Claude's discretion):** No new webhook handler is added. Saving happens synchronously in the checkout request/response cycle (the Payment Element confirms the card save as part of `confirmPayment`); nothing here depends on an async `setup_intent.succeeded` or `payment_method.attached` event arriving later. If research surfaces a reason a webhook is required for correctness (e.g. 3DS-delayed confirmation), that becomes a research-resolved decision, not assumed away.

### UI design contract
- **D-14:** The Payment Element's saved-card selector and "save this card" checkbox are entirely Stripe-hosted UI (no custom design). The only new custom UI is the Account → Payment methods list, which is a near-exact visual analog of `AddressManager`'s existing list (same token classes, same row/button pattern). Planning runs with `--skip-ui`, the same call as Phases 9, 12, 13, 14 and 16.

### Tests
- **D-15:** Tests: extend `tests/unit/app/api/payment-intent-authority.test.ts`'s hoisted-mock block with a fake `ensureStripeCustomer`/Stripe client to cover signed-in-with-binding, signed-in-first-save, signed-in-binding-failure-falls-through, and guest-unaffected cases; a new `tests/unit/lib/payments/customer-binding.test.ts` (unit) plus a D1 integration test for the find-or-create/conflict path (mirroring `tests/unit/lib/subscriptions/acquisition-service.test.ts`'s shape); `tests/unit/app/api/account-payment-methods.test.ts` for the list/delete routes including the ownership-check 404; extend `tests/unit/app/account-security-source.test.ts`'s source list to include the new route files; a migration-ordering test for `0025` in the style of `tests/integration/gift-cards-migration.test.ts`.

### Claude's Discretion
- Exact copy for the Account → Payment methods page (empty state, remove confirmation — a native `confirm()` is acceptable here, matching account-page conventions, not a new Dialog).
- Whether `ensureStripeCustomer` is called eagerly on account-page load too (to show "no cards yet, add one at checkout") or only from checkout (recommended: only from checkout — no reason to create a Stripe customer for a shopper who never intends to save a card).
</decisions>

<specifics>
## Specific Ideas

- Russell (via the summarized handoff): "Save my information" doesn't seem to actually save anything, right? — confirmed correct; Link's box saves to Stripe Link, not to the store.
- Todo: "create a Stripe Customer per signed-in shopper... pass it when creating the PaymentIntent with setup_future_usage, add Account → Payment methods (list/remove), and offer saved methods in the Payment Element for signed-in shoppers. Guests keep the plain card form. Re-enable Link only if it is wanted alongside this."
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Checkout
- `app/api/payment-intent/route.ts` — auth (~151), customer provisioning (~213-238), `createPaymentIntent` call (~243-264), `releasePreviousCheckout` (~60-84, do not disturb), zero-cash gift-card branch (~242, ~372-403)
- `lib/stripe.ts` — `getStripe()`/`getStripeClient()`, `createPaymentIntent`, API version pin
- `components/checkout/PaymentForm.tsx` (~80-87 `wallets.link: 'never'` and its comment), `components/checkout/StripeProvider.tsx` (Elements wrapper, ~42-137), `components/checkout/CheckoutClient.tsx` (`userId` prop, `useClerkAddressPrefill` ~83-97)

### Existing Stripe-customer precedent (pattern only, not shared code — see D-02)
- `lib/subscriptions/stripe-provider.ts` `createProviderCustomer`/`retrieveProviderCustomer` (~206-221), `createSetupIntent` (~243-260)
- `lib/subscriptions/acquisition-service.ts` `establishProviderCustomer` (~240-286) — the find-or-create/conflict pattern to mirror
- `lib/subscriptions/repository.ts` `findProviderCustomer`/`bindProviderCustomer` (~271-286) — the SQL shape to mirror, not import
- `lib/db/schema/subscriptions.ts` `subscriptionProviderCustomers` (~118-128) — the table shape to mirror in the new migration

### Account
- `app/account/layout.tsx` — the auth gate all account pages inherit
- `app/account/addresses/page.tsx`, `components/account/AddressManager.tsx`, `lib/account/address-client.ts` `saveAddress` — the list/remove UI and API-call pattern to mirror
- `app/api/account/addresses/route.ts`, `app/api/account/addresses/[id]/route.ts` — the auth/same-origin/bounded-body/error-code route shape
- `components/account/AccountNav.tsx` `accountLinks()` (~4-14)
- `tests/unit/app/account-security-source.test.ts` — the source-contract list to extend

### Locked
- `docs/checkout-trust-boundary.md` — no change to reservation/tender semantics; card data never touches our servers, only Stripe ids
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `establishProviderCustomer`'s find-or-create/conflict-reconciliation shape is the exact algorithm to copy for `ensureStripeCustomer`, just against a new table.
- `AddressManager`'s list/remove/busy-state pattern is the exact UI shape for the payment-methods page.
- `app/api/account/addresses/route.ts` is the exact route contract (auth, same-origin, bounded body, typed errors) to copy for the new payment-methods routes.

### Established Patterns
- D1 CAS/idempotent-binding tables use `PRIMARY KEY` on the Mercora-side id, `UNIQUE` + `GLOB` CHECK on the provider id, `INSERT OR IGNORE` + re-read-on-conflict.
- Account routes: `auth()` → 401, `hasSameOrigin` → 403 on mutation, bounded body, `Error.message` mapped to a typed JSON error.

### Integration Points
- The PaymentIntent creation call already has a signed-in branch (customer provisioning); the Stripe-customer binding slots in right after it.
- `CheckoutClient.tsx` already threads `userId` down; no new plumbing needed to know guest vs. signed-in.
</code_context>

<deferred>
## Deferred Ideas

- Consolidating `payment_customers` and `subscription_provider_customers` into one shared table (D-02).
- Adding a card outside of checkout (a standalone "add card" flow on the account page).
- Re-enabling Stripe Link.
- Default/primary payment method selection.
</deferred>

---

*Phase: 17-saved-payment-methods*
*Context gathered: 2026-09-11 autonomously from Russell's todo; D-06 explicitly deferred to research rather than guessed*
