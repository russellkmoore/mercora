# Phase 17: Saved Payment Methods - Research

**Researched:** 2026-09-11
**Domain:** Stripe Payment Element + Customer Session (save/redisplay/remove a card), D1 customer↔Stripe-customer binding
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New expand-only migration `0025_add_payment_customers.sql`: table `payment_customers` — `customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE RESTRICT`, `stripe_customer_id TEXT NOT NULL UNIQUE CHECK (length BETWEEN 5 AND 255 AND GLOB 'cus_*')`, `created_at`, `updated_at` — modeled byte-for-byte on the existing `subscription_provider_customers` table shape (`lib/db/schema/subscriptions.ts`) but as its own table, its own migration, its own Drizzle export (`lib/db/schema/payments.ts` `paymentCustomers`).
- **D-02 (Claude's call, recorded for Russell):** Deliberately **not** reusing `subscription_provider_customers`/`lib/subscriptions/repository.ts`'s `findProviderCustomer`/`bindProviderCustomer`. Reuse would mean one shared Stripe Customer for both subscriptions and checkout (arguably the more correct real-world model) but requires touching revenue-critical, already-shipped subscription code during an unattended run, which this run avoids. The cost: a shopper who both subscribes and saves a card at checkout ends up with two separate Stripe Customer objects. Logged as a Phase 18 tech-debt todo: consolidate to one `payment_customers`-style table shared by both features, with subscriptions migrated onto it.
- **D-03:** New module `lib/payments/customer-binding.ts` mirrors `establishProviderCustomer`'s idempotent find-or-create/conflict-reconciliation pattern (`lib/subscriptions/acquisition-service.ts`) against the new table: `ensureStripeCustomer({ customerId, email, name, stripe }): Promise<string>` — checks the table first, else creates via `stripe.customers.create({ metadata: { mercora_customer_id }, email, name }, { idempotencyKey })` (idempotency key derived deterministically from `customerId`, same `stableId` helper used elsewhere), binds via `INSERT OR IGNORE` + re-read-on-conflict, verifies the winner's Stripe customer id if a race occurred.
- **D-04:** In `app/api/payment-intent/route.ts`, immediately after the existing `getCustomer(userId)`/`createCustomer` block (only when `userId` is non-null — guests skip entirely), call `ensureStripeCustomer(...)` to get a `stripeCustomerId`. Failure to establish the Stripe customer must not block checkout: log/telemetry and fall through to a customer-less PaymentIntent (guest-equivalent behavior) rather than 503ing the whole purchase.
- **D-05:** When a `stripeCustomerId` is available and a PaymentIntent is actually created (the non-zero-cash branch; the zero-cash gift-card path is untouched), `createPaymentIntent` is called with `customer: stripeCustomerId`. `setup_future_usage` is **not** hardcoded — resolved by this research (see Summary/Pattern 2: do not set it explicitly; the Customer Session's `payment_method_save_usage` drives it dynamically).
- **D-06 (research-resolved — this document is the resolution):** The exact mechanism for (a) letting the shopper opt into saving the card via a checkbox in the Payment Element, and (b) showing that shopper's previously-saved cards in the Payment Element, is resolved above: Customer Session + `payment_element.features` (`payment_method_save`, `payment_method_redisplay`, `payment_method_remove`, `payment_method_save_usage: 'off_session'`), client secret passed as `customerSessionClientSecret` alongside the PaymentIntent's `clientSecret`.
- **D-07:** Guest checkout is completely unaffected: no Stripe customer lookup, no Customer Session, no saved-method UI, identical to today's flow. The existing `userId: string | null` prop already threaded through `CheckoutClient.tsx` is the single source of truth for the branch.
- **D-08:** New route `app/api/account/payment-methods/route.ts` (GET, list) and `app/api/account/payment-methods/[id]/route.ts` (DELETE, remove), following `app/api/account/addresses/route.ts`'s exact shape: `await auth()` → 401; `hasSameOrigin(request)` → 403 on DELETE; bounded request; typed error codes. GET reads the bound `stripeCustomerId` then `stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' })`, projecting only `{ id, brand, last4, expMonth, expYear }`. GET returns `{ paymentMethods: [] }` rather than 404 when no binding exists.
- **D-09:** DELETE verifies ownership before detaching: retrieve the payment method from Stripe, confirm `.customer === stripeCustomerId` for the *signed-in* shopper's own binding, only then `stripe.paymentMethods.detach(id)`. A payment method that doesn't belong to the caller returns 404 (not 403, to avoid confirming existence).
- **D-10:** New page `app/account/payment-methods/page.tsx` (server component, `auth()` gate like `app/account/addresses/page.tsx`) rendering a client component `components/account/PaymentMethodList.tsx` modeled directly on `AddressManager`'s list-with-remove-button pattern. No add-a-card UI on this page — cards are only added during checkout.
- **D-11:** `components/account/AccountNav.tsx` gets a new "Payment methods" entry, added the same way Subscriptions was — but **unconditional** (no feature flag).
- **D-12:** `link: 'never'` in `components/checkout/PaymentForm.tsx` stays exactly as-is. The stale code comment explaining why Link is disabled is updated to explain the store now has its own saved-card feature and Link is deliberately still disabled.
- **D-13 (Claude's discretion, confirmed correct by this research):** No new webhook handler is added. Saving happens synchronously in the checkout request/response cycle. Confirmed by Stripe's own docs: `confirmPayment()` synchronously sets `setup_future_usage`/`allow_redisplay` — nothing depends on an async event.
- **D-14:** The Payment Element's saved-card selector and "save this card" checkbox are entirely Stripe-hosted UI (no custom design). The only new custom UI is the Account → Payment methods list, a near-exact visual analog of `AddressManager`'s existing list. Planning runs with `--skip-ui`.
- **D-15:** Tests: extend `tests/unit/app/api/payment-intent-authority.test.ts`'s hoisted-mock block with a fake `ensureStripeCustomer`/Stripe client to cover signed-in-with-binding, signed-in-first-save, signed-in-binding-failure-falls-through, and guest-unaffected cases; a new `tests/unit/lib/payments/customer-binding.test.ts` (unit) plus a D1 integration test for the find-or-create/conflict path; `tests/unit/app/api/account-payment-methods.test.ts` for the list/delete routes including the ownership-check 404; extend `tests/unit/app/account-security-source.test.ts`'s source list; a migration-ordering test for `0025` in the style of `tests/integration/gift-cards-migration.test.ts`.

### Claude's Discretion

- Exact copy for the Account → Payment methods page (empty state, remove confirmation — a native `confirm()` is acceptable here, matching account-page conventions, not a new Dialog).
- Whether `ensureStripeCustomer` is called eagerly on account-page load too (to show "no cards yet, add one at checkout") or only from checkout (recommended: only from checkout).

### Deferred Ideas (OUT OF SCOPE)

- Consolidating `payment_customers` and `subscription_provider_customers` into one shared table (D-02).
- Adding a card outside of checkout (a standalone "add card" flow on the account page).
- Re-enabling Stripe Link.
- Default/primary payment method selection.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | A signed-in shopper can save a card at checkout; the store creates a Stripe Customer per shopper (mapped from the Clerk user) and the PaymentIntent is created with that customer and `setup_future_usage` | Pattern 1 (`ensureStripeCustomer` find-or-create), Pattern 2 (Customer Session resolves how `setup_future_usage` actually gets applied — dynamically via `payment_method_save_usage`, not hardcoded), migration/schema in Code Examples |
| PAY-02 | Account → Payment methods lists saved methods (brand, last four, expiry) and lets the shopper remove one; guests never see saved-method UI | Pattern 5 (list/detach + ownership check), Pattern 6 (route shape to copy), Security Domain (IDOR mitigation) |
| PAY-03 | The Payment Element offers a signed-in shopper their saved methods; Stripe Link stays hidden unless explicitly re-enabled with this feature | Pattern 2/3 (Customer Session + `customerSessionClientSecret` wiring), Pitfall 3 (guest isolation), D-12 unchanged `link: 'never'` |
</phase_requirements>

## Summary

D-06's open question is resolved. Stripe's Payment Element supports a "save this card"
checkbox and a saved-card selector **only** through a **Customer Session** — a second,
short-lived client secret created server-side (`stripe.customerSessions.create`) and passed
to `stripe.elements()` / `<Elements options={...}>` alongside the PaymentIntent's own
`clientSecret`, as `customerSessionClientSecret`. This param is confirmed present at the
exact installed version (`@stripe/stripe-js` 9.14.0). The Customer Session's
`components.payment_element.features` config (`payment_method_save`,
`payment_method_redisplay`, `payment_method_remove`, and — critically —
`payment_method_save_usage: 'off_session'`) is what makes the checkbox appear and controls
what happens when it's checked.

The single most important finding, direct from Stripe's own current docs: **do not set
`setup_future_usage` explicitly on the PaymentIntent when using this flow.** Stripe's docs
state verbatim: *"If you intend to specify `setup_future_usage`, don't set
`payment_method_save_usage` in the same payment transaction because this causes an
integration error."* The two are mutually exclusive. `payment_method_save_usage` on the
Customer Session is the correct mechanism here — Stripe.js "automatically controls setting
`setup_future_usage` on the PaymentIntent... depending on whether the customer checked the
box." This directly confirms CONTEXT.md D-05's already-correct instinct ("setup_future_usage
is not hardcoded") and narrows PAY-01's literal wording: the requirement is satisfied by the
PaymentIntent ending up with `setup_future_usage` applied through this dynamic path, not by
the route code setting a static value at creation.

No webhook is required for correctness. Card save/attach happens synchronously as part of
the client's `confirmPayment()` call; D-13's assumption is confirmed correct by the docs
excerpt above.

One correction to CONTEXT.md's assumptions: `lib/payments/` **already exists** (refund
logic: `refund-ledger.ts`, `refund-lifecycle.ts`, etc. — not customer-binding code). D-03's
plan to add `lib/payments/customer-binding.ts` lands in an **existing, occupied namespace**,
not a new one — see Package Legitimacy Audit note and the "Don't Hand-Roll" section below.
This is not a blocker (no name collision on `customer-binding.ts` itself), but the planner
should not assume a fresh directory and should double-check nothing in the existing
`lib/payments/` files imports/exports a conflicting `ensureStripeCustomer` or similar name.

**Primary recommendation:** Server creates (or reuses) a Stripe Customer, then a Customer
Session scoped to `payment_element` with `payment_method_save/redisplay/remove: 'enabled'`
and `payment_method_save_usage: 'off_session'`, alongside the existing PaymentIntent (no
`setup_future_usage` set at PaymentIntent creation). Client passes both secrets to
`<Elements>`. Account → Payment methods reads/removes via `paymentMethods.list`/`.detach`,
both confirmed current on the pinned Stripe Node SDK (22.6.0).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stripe Customer creation/lookup | API / Backend | Database / Storage | `ensureStripeCustomer` runs server-side in `app/api/payment-intent/route.ts`; D1 `payment_customers` table is the durable binding |
| Customer Session creation | API / Backend | — | Must be created server-side (secret-key operation); short-lived client secret handed to the browser |
| Save-card checkbox / saved-card selector UI | Browser / Client | — | Entirely Stripe-hosted iframe UI inside the Payment Element; no custom markup |
| `setup_future_usage` application | Browser / Client (via Stripe.js) | API / Backend (Customer Session config only) | Config lives server-side (Customer Session `features`), but the actual PaymentIntent mutation happens client-side inside `confirmPayment()` |
| Account → Payment methods list/remove | API / Backend | Browser / Client | `stripe.paymentMethods.list`/`.detach` server-side; `PaymentMethodList.tsx` client-side renders/triggers |
| Payment-method ownership verification | API / Backend | — | Must check `.customer === stripeCustomerId` server-side before `detach`; never trust a client-supplied customer id |

## Package Legitimacy Audit

No new external packages are introduced. `stripe` (Node SDK), `@stripe/stripe-js`, and
`@stripe/react-stripe-js` are already installed, pinned, and in active production use —
already vetted in prior phases. This section is included for completeness per the research
protocol; no legitimacy check is required for already-installed, already-shipped
dependencies.

| Package | Registry | Installed Version | Verdict | Disposition |
|---------|----------|-------------------|---------|-------------|
| `stripe` | npm | 22.6.0 [VERIFIED: node_modules/stripe/package.json] | OK | Already in use — no action |
| `@stripe/stripe-js` | npm | 9.14.0 [VERIFIED: node_modules/@stripe/stripe-js/package.json] | OK | Already in use — no action |
| `@stripe/react-stripe-js` | npm | 6.8.2 [VERIFIED: node_modules/@stripe/react-stripe-js/package.json] | OK | Already in use — no action |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Standard Stack

### Core (already installed — exact pinned versions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` (Node SDK) | 22.6.0 [VERIFIED: `node_modules/stripe/package.json` `"version": "22.6.0"`] | Server-side Customer, CustomerSession, PaymentIntent, PaymentMethod calls | Already the store's sole payment provider client |
| `@stripe/stripe-js` | 9.14.0 [VERIFIED: `node_modules/@stripe/stripe-js/package.json` `"version": "9.14.0"`] | Browser Stripe.js loader; typed `StripeElementsOptions` incl. `customerSessionClientSecret` | Already the store's client-side Stripe loader |
| `@stripe/react-stripe-js` | 6.8.2 [VERIFIED: `node_modules/@stripe/react-stripe-js/package.json` `"version": "6.8.2"`] | `<Elements>`, `<PaymentElement>`, `useStripe`/`useElements` React bindings | Already used by `StripeProvider.tsx`/`PaymentForm.tsx` |

No new packages needed. `package.json` pins these with `^` ranges (`"@stripe/react-stripe-js": "^6.8.2"`, `"@stripe/stripe-js": "^9.14.0"`, `"stripe": "^22.6.0"`) [VERIFIED: `package.json:64-65,82`]; installed versions match exactly.

**`lib/stripe.ts`'s exact `apiVersion` pin:** `'2026-08-26.dahlia'` [VERIFIED: `lib/stripe.ts:78`]. The `CustomerSessions` resource and its `payment_element` component config exist in the installed SDK's type declarations regardless of the pinned string API version (the Node SDK ships one set of types per package version, and this SDK version is current as of this pin), confirmed directly by reading `node_modules/stripe/cjs/resources/CustomerSessions.d.ts` this session.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Customer Session + Payment Element checkbox | Standalone `SetupIntent` flow (`createSetupIntent`, already used by `lib/subscriptions/stripe-provider.ts` for a *different* purpose — subscription card-on-file, no live charge) | Would require a second Stripe API round trip and a second Elements mount just to save a card with no accompanying purchase; wrong shape for "save at checkout," and explicitly out of scope (checkout-time save only, per D-02/deferred "adding a card outside of checkout") |
| Server-set `setup_future_usage` on PaymentIntent create | Letting the Customer Session `payment_method_save_usage` config + checkbox drive it dynamically | Server-set `setup_future_usage` forces save-or-error for every PaymentIntent regardless of checkbox state, and combining it with `payment_method_save_usage` triggers a documented Stripe **integration error** — not a viable alternative for this phase's "user opts in via checkbox" requirement |

**Installation:** No installation needed — all three packages already present at required versions.

## Architecture Patterns

### System Architecture Diagram

```
Signed-in shopper reaches payment step
        │
        ▼
app/api/payment-intent/route.ts  (existing getCustomer/createCustomer block ~213-238)
        │  userId present?
        ▼
ensureStripeCustomer(customerId, email, name)  [new: lib/payments/customer-binding.ts]
        │  checks payment_customers (D1) → binds/creates Stripe Customer on miss
        ▼
stripeCustomerId  ──────────────┐
        │                        │
        ▼                        ▼
createPaymentIntent({            stripe.customerSessions.create({
  customer: stripeCustomerId,      customer: stripeCustomerId,
  ...                              components: { payment_element: {
})  (existing ~243-264,              enabled: true,
   customer: stripeCustomerId       features: {
   added, NO setup_future_usage         payment_method_save: 'enabled',
   set here)                            payment_method_redisplay: 'enabled',
        │                               payment_method_remove: 'enabled',
        │                               payment_method_save_usage: 'off_session',
        │                            } } } })
        │                        │
        ▼                        ▼
  clientSecret            customerSessionClientSecret
        └───────────┬────────────┘
                     ▼
      NextResponse.json({ clientSecret, customerSessionClientSecret, ... })
                     │
                     ▼
     CheckoutClient.tsx state (both stored, both set together)
                     │
                     ▼
  <StripeProvider key={clientSecret} clientSecret={clientSecret}
                   customerSessionClientSecret={customerSessionClientSecret}>
                     │
                     ▼
     stripe.elements({ clientSecret, customerSessionClientSecret, appearance })
                     │
                     ▼
        <PaymentElement>  ← Stripe-hosted: saved-card list + "save this card" checkbox
                     │
                     ▼
  stripe.confirmPayment({ elements, confirmParams, redirect: 'if_required' })
                     │   (Stripe.js sets setup_future_usage + allow_redisplay
                     │    automatically based on checkbox state, synchronously)
                     ▼
              Payment succeeds → card attached to Customer (if checked)


Account → Payment methods (separate, independent read path)
        │
        ▼
GET /api/account/payment-methods → stripe.paymentMethods.list({ customer, type: 'card' })
        │
        ▼
DELETE /api/account/payment-methods/[id] → retrieve(id) → verify .customer ===
        stripeCustomerId → stripe.paymentMethods.detach(id)
```

### Recommended Project Structure

```
lib/payments/
├── refund-*.ts              # EXISTING — do not touch, do not collide names
├── customer-binding.ts      # NEW — ensureStripeCustomer(), mirrors establishProviderCustomer
lib/db/schema/
├── payments.ts               # NEW — paymentCustomers Drizzle table export
migrations/
├── 0025_add_payment_customers.sql   # NEW — expand-only
app/api/payment-intent/route.ts     # MODIFIED — customer binding + Customer Session
app/api/account/payment-methods/
├── route.ts                  # NEW — GET (list)
├── [id]/route.ts              # NEW — DELETE (remove, with ownership check)
app/account/payment-methods/
├── page.tsx                   # NEW — server component, auth gate
components/account/
├── PaymentMethodList.tsx      # NEW — client component, mirrors AddressManager
components/checkout/
├── StripeProvider.tsx         # MODIFIED — thread customerSessionClientSecret prop
├── CheckoutClient.tsx         # MODIFIED — new state, pass prop to StripeProvider
├── PaymentForm.tsx            # MODIFIED (comment only) — Link-disabled comment update
```

### Pattern 1: Idempotent find-or-create + conflict reconciliation (mirror, not import)

**What:** `establishProviderCustomer` in `lib/subscriptions/acquisition-service.ts:241-286`
[VERIFIED: read this session] is the exact algorithm `ensureStripeCustomer` must mirror
against the new `payment_customers` table:

```typescript
// Source: lib/subscriptions/acquisition-service.ts:241-286 (verbatim pattern, re-target table)
async function establishProviderCustomer(args: {
  repository: Repository;
  provider: SubscriptionAcquisitionProvider;
  input: BeginSubscriptionAcquisitionInput;
}): Promise<string> {
  const existing = await args.repository.findProviderCustomer(args.input.customerId);
  if (existing) {
    const verified = await args.provider.retrieveProviderCustomer({
      customerId: args.input.customerId,
      stripeCustomerId: existing.stripeCustomerId,
    });
    if (verified.customerId !== args.input.customerId
      || verified.stripeCustomerId !== existing.stripeCustomerId) {
      throw new SubscriptionProviderConflictError("Provider customer ownership changed");
    }
    return existing.stripeCustomerId;
  }

  const idempotencyKey = await stableId("subscription-customer", args.input.customerId);
  const created = await args.provider.createProviderCustomer({
    customerId: args.input.customerId,
    email: args.input.customerEmail,
    name: args.input.customerName,
    idempotencyKey,
  });
  if (created.customerId !== args.input.customerId) {
    throw new SubscriptionProviderConflictError("Provider customer ownership changed");
  }
  const result = await args.repository.bindProviderCustomer({
    customerId: args.input.customerId,
    stripeCustomerId: created.stripeCustomerId,
  });
  if (result === "conflict") {
    const winner = await args.repository.findProviderCustomer(args.input.customerId);
    if (!winner) throw new SubscriptionProviderConflictError("Provider customer mapping did not converge");
    const verified = await args.provider.retrieveProviderCustomer({
      customerId: args.input.customerId,
      stripeCustomerId: winner.stripeCustomerId,
    });
    if (verified.customerId !== args.input.customerId
      || verified.stripeCustomerId !== winner.stripeCustomerId) {
      throw new SubscriptionProviderConflictError("Provider customer ownership changed");
    }
    return verified.stripeCustomerId;
  }
  return created.stripeCustomerId;
}
```

**When to use:** Exactly this shape for `ensureStripeCustomer`, targeting
`payment_customers` (`findPaymentCustomer`/`bindPaymentCustomer` names, or whatever the
plan names the equivalent two functions) instead of `subscription_provider_customers`.

**stableId is NOT a shared export** — it is duplicated locally, unexported, in both
`lib/subscriptions/acquisition-service.ts:123-128` and
`lib/services/gift-card-fulfillment.ts:161-166` [VERIFIED: both files read this session].
Exact signature to copy verbatim into the new module (not import):

```typescript
// Source: lib/subscriptions/acquisition-service.ts:123-128
async function stableId(prefix: string, ...parts: string[]): Promise<string> {
  const encoded = new TextEncoder().encode(parts.join(" "));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 48)}`;
}
```

The repository SQL to mirror (D1 `INSERT OR IGNORE` + re-read-on-conflict):

```sql
-- Source: lib/subscriptions/repository.ts:272-286 (verbatim pattern, re-target table)
-- findProviderCustomer:
SELECT customer_id AS customerId, stripe_customer_id AS stripeCustomerId
  FROM subscription_provider_customers WHERE customer_id = ? LIMIT 1

-- bindProviderCustomer:
INSERT OR IGNORE INTO subscription_provider_customers
  (customer_id, stripe_customer_id) VALUES (?, ?)
-- if changes > 0 -> "created"; else re-SELECT and compare stripeCustomerId ->
-- "identical" | "conflict"
```

The Stripe-call shape to mirror (idempotency key, metadata, no unnecessary fields):

```typescript
// Source: lib/subscriptions/stripe-provider.ts:206-221
async createProviderCustomer(request: CreateProviderCustomerRequest): Promise<ProviderCustomerBinding> {
  const customerId = boundedString(request.customerId, "Mercora customer id", { maxLength: 128 });
  const idempotencyKey = boundedString(request.idempotencyKey, "customer idempotency key", { maxLength: 255 });
  const email = optionalBoundedString(request.email, "customer email", 320);
  const name = optionalBoundedString(request.name, "customer name", 200);
  const customer = await this.#client.customers.create({
    metadata: { mercora_customer_id: customerId },
    ...(email === undefined ? {} : { email }),
    ...(name === undefined ? {} : { name }),
  }, { idempotencyKey });
  return mapProviderCustomer(customer, customerId);
}
```

This idempotency-key usage (`{ idempotencyKey }` as the second arg to `customers.create`)
is confirmed still the current SDK shape: `RequestOptions.idempotencyKey` exists on the
installed `stripe` 22.6.0 types [VERIFIED: `node_modules/stripe/cjs/lib.d.ts:109`].

### Pattern 2: Customer Session creation (server) — D-06 resolution

**What:** Create alongside the PaymentIntent, only for signed-in shoppers with a
`stripeCustomerId`, in the same non-zero-cash branch (~line 242 of
`app/api/payment-intent/route.ts`).

```typescript
// Server: params confirmed against installed types this session
// (node_modules/stripe/cjs/resources/CustomerSessions.d.ts:237-254, 400-443)
const customerSession = await stripe.customerSessions.create({
  customer: stripeCustomerId,
  components: {
    payment_element: {
      enabled: true,
      features: {
        payment_method_save: 'enabled',
        payment_method_redisplay: 'enabled',
        payment_method_remove: 'enabled',
        payment_method_save_usage: 'off_session',
      },
    },
  },
});
// customerSession.client_secret -> returned to client as `customerSessionClientSecret`
```

**Source:** Live-fetched from `docs.stripe.com/payments/save-during-payment.md?payment-ui=elements`
this session [CITED: docs.stripe.com/payments/save-during-payment (Payment Intents API
variant)] — this is the exact Ruby/curl example Stripe's own current guide gives for "Save
payment methods during payment [Server-side]," field names verified verbatim against the
installed Node SDK's `.d.ts`.

**Do not set `payment_method_save_usage` and PaymentIntent-level `setup_future_usage`
together** — Stripe's docs state this "causes an integration error." Because D-05 already
leaves `setup_future_usage` unset at PaymentIntent creation (pending this research), no code
change is needed there beyond adding `customer: stripeCustomerId`.

### Pattern 3: Client Elements setup — D-06 resolution

```javascript
// Source: docs.stripe.com/payments/save-during-payment.md?payment-ui=elements (verbatim)
const elementsOptions = {
  clientSecret: '{{CLIENT_SECRET}}',
  customerSessionClientSecret,
  appearance: {/*...*/},
};
const elements = stripe.elements(elementsOptions);
const paymentElement = elements.create('payment', paymentElementOptions);
paymentElement.mount('#payment-element');
```

`customerSessionClientSecret` is a first-class field on `StripeElementsOptions`
[VERIFIED: `node_modules/@stripe/stripe-js/dist/stripe-js/elements-group.d.ts:779`
— `customerSessionClientSecret?: string;`], the exact type `StripeProvider.tsx` already
imports (`import type { StripeElementsOptions } from '@stripe/stripe-js';`
[VERIFIED: `components/checkout/StripeProvider.tsx:27`]). `@stripe/react-stripe-js`'s
`<Elements options={...}>` prop is typed as this same `stripeJs.StripeElementsOptions`
[VERIFIED: `node_modules/@stripe/react-stripe-js/dist/react-stripe.d.ts:802`], so no
separate React-specific param is needed — pass it straight through `options`.

**Exact current `StripeProvider.tsx` integration point** [VERIFIED: read this session]:

```typescript
// components/checkout/StripeProvider.tsx:30-46 (current signature)
interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
  options?: StripeElementsOptions;
}
export default function StripeProvider({ children, clientSecret, options = {} }: StripeProviderProps) {
  ...
  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: { /* theme tokens */ },
    ...(options.fonts && { fonts: options.fonts }),
    ...(options.locale && { locale: options.locale }),
  };
  return <Elements stripe={stripePromise} options={elementsOptions}>{children}</Elements>;
}
```

Adding `customerSessionClientSecret` requires: (1) a new optional prop
`customerSessionClientSecret?: string` on `StripeProviderProps`, and (2) one added line in
`elementsOptions`: `...(customerSessionClientSecret ? { customerSessionClientSecret } : {})`
— placed alongside the existing `clientSecret` spread, following the file's own
conditional-spread convention already used for `fonts`/`locale`.

**Exact current `CheckoutClient.tsx` remount + response shape** [VERIFIED: read this
session]:

```typescript
// components/checkout/CheckoutClient.tsx:130 (state)
const [clientSecret, setClientSecret] = useState<string>('');
// components/checkout/CheckoutClient.tsx:283-301 (response handling)
const data = await res.json() as {
  noCash?: boolean;
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
  quote: AuthoritativeCheckoutQuote;
};
...
setClientSecret(data.clientSecret);
// components/checkout/CheckoutClient.tsx:533 (remount key)
<StripeProvider key={clientSecret} clientSecret={clientSecret}>
```

The response type gains `customerSessionClientSecret?: string` (optional, since guests
never get one); a new `const [customerSessionClientSecret, setCustomerSessionClientSecret]
= useState<string>('')` is set in the same branch as `setClientSecret(data.clientSecret)`,
and passed as a new prop on `<StripeProvider key={clientSecret} clientSecret={clientSecret}
customerSessionClientSecret={customerSessionClientSecret}>`. **The existing `key={clientSecret}`
remount is sufficient** — no separate remount key is needed for the Customer Session, because
both secrets arrive in the same `/api/payment-intent` response and are set together; a
requote already produces a new `clientSecret` (and, under this design, a new
`customerSessionClientSecret` created in the same request), so both remount in lockstep.

### Pattern 4: Confirm-time behavior — no client code change needed

Per the docs excerpt above: *"When confirming the PaymentIntent, Stripe.js automatically
controls setting `setup_future_usage`... and `allow_redisplay`... depending on whether the
customer checked the box."* `PaymentForm.tsx`'s existing `handleSubmit` /
`stripe.confirmPayment({ elements, confirmParams, redirect: 'if_required' })`
[VERIFIED: `components/checkout/PaymentForm.tsx:111-118`] needs **no changes** — the save
behavior is fully driven by the Elements instance's Customer Session config, not by
anything in the confirm call.

### Pattern 5: List / remove saved payment methods (server)

```typescript
// Confirmed method signatures against installed stripe 22.6.0 types:
// node_modules/stripe/esm/resources/PaymentMethods.d.ts:11 (list), :45 (detach)
const methods = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' });
// project only: methods.data.map(pm => ({
//   id: pm.id, brand: pm.card!.brand, last4: pm.card!.last4,
//   expMonth: pm.card!.exp_month, expYear: pm.card!.exp_year,
// }))

// DELETE — verify ownership first (D-09):
const pm = await stripe.paymentMethods.retrieve(id);
if (pm.customer !== stripeCustomerId) return notFound(); // don't leak existence
await stripe.paymentMethods.detach(id);
```

`PaymentMethod.Card` field names confirmed from installed types
[VERIFIED: `node_modules/stripe/esm/resources/PaymentMethods.d.ts:250-304`]: `brand: string`,
`exp_month: number`, `exp_year: number`, `last4: string`. `detach` is confirmed the current
removal call — no newer API superseded it; the type doc comment itself says "Detachment is
permanent and irreversible... a PaymentMethod can no longer be used for payments or
re-attached to a Customer" [VERIFIED: same file, line 43].

### Pattern 6: Account route shape to copy verbatim

```typescript
// Source: app/api/account/addresses/route.ts:8-13 (GET — no hasSameOrigin needed)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const customer = await getCustomer(userId);
  return NextResponse.json({ addresses: customer?.addresses ?? [] });
}

// Source: app/api/account/addresses/[id]/route.ts:35-59 (DELETE — hasSameOrigin required)
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  const { id } = await context.params;
  if (!id || id.length > 80) return denial(); // 404, not 403 — "don't leak" convention
  ...
}
```

Note: the existing GET addresses route does **not** call `hasSameOrigin` (non-mutating);
only POST/PUT/DELETE do. The new payment-methods GET route should follow the same asymmetry
— `hasSameOrigin` only on DELETE.

### Anti-Patterns to Avoid

- **Setting `setup_future_usage` explicitly on the PaymentIntent at creation while also
  configuring `payment_method_save_usage` on the Customer Session:** Stripe's own docs call
  this an integration error. Pick the Customer Session path only.
- **Building a custom "save this card" checkbox or saved-card picker UI:** the Payment
  Element renders this natively once the Customer Session is wired in — per D-14, this is
  entirely Stripe-hosted UI, zero custom markup.
- **Skipping the ownership check before `detach`:** `paymentMethods.detach(id)` takes only
  an id — nothing stops detaching a payment method belonging to a different customer unless
  the route verifies `.customer === stripeCustomerId` first (D-09).
- **Assuming `lib/payments/` is a fresh, empty namespace:** it already holds refund logic;
  double-check for name collisions before adding new files (none found this session, but the
  planner must not skip this check based on CONTEXT.md's stated assumption alone).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Save-card checkbox / saved-card selector | Custom form fields, custom card-brand icons, custom "remove this card" toggle inside checkout | Stripe Payment Element + Customer Session `payment_element.features` | Stripe owns PCI scope, i18n, card-brand icon assets, and accessibility for this UI; a hand-rolled version would touch raw card data or duplicate Stripe's maintained icon set |
| Idempotent Stripe-customer find-or-create under concurrent requests | A raw D1 upsert without a bind/reconcile step | `INSERT OR IGNORE` + re-read-on-conflict, mirroring `establishProviderCustomer` | Two concurrent first-checkouts for the same shopper would otherwise race and create two Stripe Customers; the existing subscription code already solved this exact race |
| Card brand/expiry formatting | Custom brand→icon mapping, custom date formatting | Stripe's `card.brand`/`card.last4`/`card.exp_month`/`card.exp_year` fields, displayed as plain text per D-08 (no icons required by the decision) | D-08 explicitly scopes the projection to `{ id, brand, last4, expMonth, expYear }` with no Stripe internal ids beyond the payment-method id — keep it that plain |

**Key insight:** Nearly everything in this phase is either (a) already-shipped D1
binding/idempotency patterns being mirrored into a new table, or (b) Stripe-hosted UI wired
through two client secrets. There is no custom payment logic to write beyond the binding
module and the plain list/remove account routes.

## Common Pitfalls

### Pitfall 1: Combining server-set `setup_future_usage` with Customer Session save config
**What goes wrong:** The PaymentIntent confirm call throws a Stripe integration error.
**Why it happens:** Both mechanisms try to control the same PaymentIntent field; Stripe
rejects the ambiguity rather than picking a winner.
**How to avoid:** Never add `setup_future_usage` to the `createPaymentIntent(...)` call in
`app/api/payment-intent/route.ts` for this phase. Only `customer: stripeCustomerId` is added
there.
**Warning signs:** A Stripe API error mentioning `setup_future_usage` and
`payment_method_save_usage` together during checkout confirmation.

### Pitfall 2: Forgetting the Customer Session client secret is optional/best-effort
**What goes wrong:** Treating a failed `customerSessions.create` call as a hard checkout
failure.
**Why it happens:** It's easy to bundle it into the same try/catch as PaymentIntent
creation, which today does 503 on failure.
**How to avoid:** Per D-04 ("Failure to establish the Stripe customer must not block
checkout"), the Customer Session call should be similarly best-effort: if it fails, fall
through to a plain PaymentIntent client secret with no `customerSessionClientSecret` in the
response — the Payment Element still works fine without one (it just won't show saved
cards/checkbox for that one checkout).
**Warning signs:** A signed-in shopper's checkout starts failing that previously succeeded,
traceable to a Customer Session creation error rather than a PaymentIntent error.

### Pitfall 3: Guests accidentally getting a Customer Session
**What goes wrong:** A code path creates a Customer Session even when `userId` is null.
**Why it happens:** Copy-paste of the signed-in branch without the `userId` guard.
**How to avoid:** The Customer Session call must live strictly inside the same `if (userId)`
gate that already surrounds customer provisioning (~line 213-238) and the new
`ensureStripeCustomer` call, and only fire when a `stripeCustomerId` was actually obtained.
**Warning signs:** A guest checkout's `/api/payment-intent` response contains a
`customerSessionClientSecret` field, or a guest sees a saved-card UI (they have none, so it
would be an empty saved-methods list at worst, but it should never even attempt the call —
D-07 requires guest checkout be "completely unaffected").

### Pitfall 4: Detach without ownership check
**What goes wrong:** Any authenticated shopper can pass another shopper's `payment_method`
id to the DELETE route and detach it from someone else's Stripe Customer.
**Why it happens:** `stripe.paymentMethods.detach(id)` takes only the payment-method id —
Stripe does not implicitly scope this to "methods belonging to customer X" unless the caller
checks first.
**How to avoid:** `stripe.paymentMethods.retrieve(id)` first, compare `.customer` to the
caller's own `stripeCustomerId`, return 404 (not 403) on mismatch — exactly D-09.
**Warning signs:** A test that detaches a payment method belonging to a different
`payment_customers` row succeeds instead of 404ing.

### Pitfall 5: `lib/payments/` name collision assumption
**What goes wrong:** Planner assumes `lib/payments/` doesn't exist yet (per CONTEXT.md
canonical refs framing) and doesn't check for existing exports before adding
`customer-binding.ts`.
**Why it happens:** CONTEXT.md's "New module `lib/payments/customer-binding.ts`" framing
reads as if the directory itself is new.
**How to avoid:** `lib/payments/` already contains `refund-email.ts`, `refund-idempotency.ts`,
`refund-ledger-store.ts`, `refund-ledger.ts`, `refund-lifecycle.ts`, `refund-tender.ts`
[VERIFIED: `ls lib/payments/` this session]. `customer-binding.ts` itself does not exist, so
there is no literal filename collision — but any shared barrel file (none currently exists;
no `lib/payments/index.ts` was found) or naming convention should be checked before adding.
**Warning signs:** none currently — this is a documentation correction, not a live bug.

## Code Examples

See Patterns 1-6 above for verified code, sourced from: this session's `Read`/`grep` of
`lib/subscriptions/{acquisition-service,repository,stripe-provider}.ts`,
`app/api/account/addresses/{route.ts,[id]/route.ts}`, `components/checkout/{StripeProvider,
CheckoutClient,PaymentForm}.tsx`, `app/api/payment-intent/route.ts`,
`lib/db/schema/{customer,subscriptions}.ts`, and installed `node_modules/stripe` /
`node_modules/@stripe/stripe-js` / `node_modules/@stripe/react-stripe-js` type declarations,
plus one live fetch of `docs.stripe.com/payments/save-during-payment.md?payment-ui=elements`.

### New migration `0025_add_payment_customers.sql` (D-01, modeled byte-for-byte on
`subscription_provider_customers`)

```sql
-- Source shape: lib/db/schema/subscriptions.ts:117-129 (subscriptionProviderCustomers),
-- re-targeted per D-01's table name and column names.
CREATE TABLE payment_customers (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(stripe_customer_id) BETWEEN 5 AND 255 AND stripe_customer_id GLOB 'cus_*')
);
```

`customers.id` is `text("id").primaryKey()` with no length/format constraint of its own
[VERIFIED: `lib/db/schema/customer.ts:19-20`, quoted: `id: text("id").primaryKey(),`], and
is populated directly from the Clerk `userId` string in `app/api/payment-intent/route.ts:221`
(`await createCustomer({ id: userId, ... })`) — so `payment_customers.customer_id`'s FK
target is format-compatible by construction, identical to how
`subscription_provider_customers.customer_id` already works.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `SetupIntent` + manual customer attach for saving cards outside a purchase | `PaymentIntent` + Customer Session `payment_element.features.payment_method_save` for saving during a purchase | Customer Session Payment Element support: 2024-09-30 changelog entry found this session [CITED: docs.stripe.com/changelog/acacia/2024-09-30/support-payment-element-customer-session] | This phase's "save at checkout" requirement maps to the newer, purpose-built mechanism, not the older `SetupIntent`-based subscription pattern already in this codebase |

**Deprecated/outdated:** None of the APIs used here are deprecated. `stripe-js` 9 already
required one adjustment elsewhere in this codebase (`radios: 'never'` replacing a boolean in
`PaymentForm.tsx:76`, pre-existing, unrelated to this phase) — no similar breaking change
affects Customer Sessions at the pinned version.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `payment_customers` should NOT have `payment_customers_pair_unique` composite index or other extra indexes beyond `PRIMARY KEY`/`UNIQUE` (subscriptions' table has one extra `uniqueIndex` on the pair; D-01 doesn't mention it) | Code Examples / migration | If the extra pair index is actually required for some D1 query pattern this phase doesn't yet use, a follow-up migration would be needed; low risk since the FK+unique already enforce the same invariant a pair-unique index would |
| A2 | The existing `payment_customer_prepare_failed`-style telemetry event naming convention (`payment.customer_prepare_failed` already exists for the unrelated MACH-customer block at line 232) should get a *new*, distinctly-named telemetry event for Stripe-customer-binding failure, not reuse the existing one | Common Pitfall 2 | If the planner reuses the existing event name for a semantically different failure, dashboards/alerts keyed on that event name become ambiguous between "MACH customer row failed" and "Stripe customer binding failed" |

## Open Questions

None blocking. D-06 (the phase's explicit research placeholder) is fully resolved above with
direct evidence from the installed SDK's type declarations and Stripe's own current,
live-fetched documentation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Stripe test-mode account | Whole phase | ✓ (per AGENTS.md — store stays test-mode) | — | — |
| `stripe` Node SDK | Server-side Customer/CustomerSession/PaymentMethod calls | ✓ | 22.6.0 | — |
| `@stripe/stripe-js` | Client Elements init | ✓ | 9.14.0 | — |
| `@stripe/react-stripe-js` | React Elements bindings | ✓ | 6.8.2 | — |
| D1 (local dev via `npm run dev`'s predev hook) | New `payment_customers` table, migration test | ✓ | — | — |

No missing dependencies. Everything required is already installed and configured.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit: `vitest.config.*` default via `npm test`; Workers/D1: `vitest.workers.config.mts` via `npm run test:workers`) |
| Config file | `vitest.workers.config.mts` [VERIFIED: `package.json:17` `"test:workers": "vitest run --config vitest.workers.config.mts"`] |
| Quick run command | `mise exec -- npx vitest run tests/unit/lib/payments/customer-binding.test.ts tests/unit/app/api/payment-intent-authority.test.ts tests/unit/app/api/account-payment-methods.test.ts` |
| Full suite command | `mise exec -- npm test && mise exec -- npm run test:workers` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | Signed-in checkout creates/reuses Stripe Customer, PaymentIntent gets `customer` + Customer-Session-driven save | unit | `mise exec -- npx vitest run tests/unit/lib/payments/customer-binding.test.ts` | ❌ Wave 0 (new) |
| PAY-01 | `payment-intent` route wires `ensureStripeCustomer`+Customer Session into the existing signed-in branch, falls through on failure | unit | `mise exec -- npx vitest run tests/unit/app/api/payment-intent-authority.test.ts` | ✅ (extend existing hoisted-mock block) |
| PAY-01 | `ensureStripeCustomer` find-or-create/conflict path against real D1 | integration | `mise exec -- npm run test:workers` (new file under `tests/integration/` or `tests/unit/lib/payments/`, per plan's choice) | ❌ Wave 0 (new) |
| PAY-02 | GET lists brand/last4/expiry; DELETE removes with ownership check (404 on mismatch) | unit | `mise exec -- npx vitest run tests/unit/app/api/account-payment-methods.test.ts` | ❌ Wave 0 (new) |
| PAY-02 | Guests never see saved-method UI | unit | covered by `payment-intent-authority.test.ts`'s guest-unaffected case + a render/props assertion in whichever test covers `PaymentMethodList`/account page gating | ❌ Wave 0 (new, or covered by existing account-page auth-redirect pattern) |
| PAY-03 | Payment Element offers saved cards for signed-in shopper (Customer Session wiring reaches `StripeProvider`) | unit | `mise exec -- npx vitest run tests/unit/app/api/payment-intent-authority.test.ts` (response shape assertion: `customerSessionClientSecret` present for signed-in, absent for guest) | ✅ (extend existing) |
| PAY-03 | Link stays hidden (`link: 'never'`) | unit/contract | existing `PaymentForm.tsx` behavior — no test currently pins `link: 'never'` as a literal string; consider adding one alongside the comment update (D-12) | ❌ Wave 0 (new, small) |
| — | Migration ordering: `0025` doesn't disturb populated baseline | integration | `mise exec -- npm run test:workers` — new file mirroring `tests/integration/gift-cards-migration.test.ts` | ❌ Wave 0 (new) |
| — | `account-security-source.test.ts` contract extended to cover new routes | unit | `mise exec -- npx vitest run tests/unit/app/account-security-source.test.ts` | ✅ (extend existing — add the two new route file `readFileSync` entries and `hasSameOrigin`/`await auth()` assertions per D-15) |

### Sampling Rate

- **Per task commit:** the relevant file(s) from the Quick run command above
- **Per wave merge:** `mise exec -- npm test` (full unit suite)
- **Phase gate:** `mise exec -- npm test && mise exec -- npm run test:workers`, then
  `npm run lint && npm run typecheck && npm run cf-typecheck && npm run scan:tokens && npm run build`
  (mirrors CI's full order per `AGENTS.md`'s Gates section)

### Wave 0 Gaps

- [ ] `tests/unit/lib/payments/customer-binding.test.ts` — unit coverage for
  `ensureStripeCustomer`'s find-existing / create-new / bind-conflict-reconcile paths
  (mirrors `tests/unit/lib/subscriptions/acquisition-service.test.ts`'s
  `mocks()`/`repository.findProviderCustomer`/`bindProviderCustomer` shape, verified this
  session at lines 51-58, 207-227)
- [ ] A D1 integration test for the same find-or-create/conflict path against real D1
  (place under `tests/integration/` or co-located with the unit test per the plan's own
  convention; run via `test:workers`)
- [ ] `tests/unit/app/api/account-payment-methods.test.ts` — GET list projection + DELETE
  ownership-check-then-detach + 404-on-mismatch + 401/403 guards
- [ ] A migration-ordering test for `0025_add_payment_customers.sql`, in the exact style of
  `tests/integration/gift-cards-migration.test.ts` (verified this session: use
  `env.TEST_MIGRATIONS.findIndex(...)`, slice, `applyD1Migrations`, snapshot-before/after,
  then assert the new table starts empty)
- [ ] Extend `tests/unit/app/api/payment-intent-authority.test.ts`'s hoisted-mock block
  (already confirmed shape at lines 4-16) with a mocked `ensureStripeCustomer` and a mocked
  `stripe.customerSessions.create`-equivalent, covering: signed-in-with-existing-binding,
  signed-in-first-save (creates binding), signed-in-binding-failure-falls-through (still
  gets a PaymentIntent, just no `customer`/`customerSessionClientSecret`), guest-unaffected
  (no binding call attempted at all)
- [ ] Extend `tests/unit/app/account-security-source.test.ts`'s `readFileSync` source list
  (currently 5 files, confirmed this session) to add
  `app/api/account/payment-methods/route.ts` and
  `app/api/account/payment-methods/[id]/route.ts`, asserting `await auth()` on both and
  `hasSameOrigin(request)` on the DELETE route only (matching the addresses precedent, where
  the GET route is exempt)

## Security Domain

`security_enforcement` is absent from `.planning/config.json` [VERIFIED: read this session
— the file contains only `workflow` and `git` keys, no `security_enforcement` key] → treated
as enabled per the default rule.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Clerk `await auth()` gate, reused verbatim on all new routes |
| V3 Session Management | yes | Clerk session cookie (unchanged); Stripe's own short-lived Customer Session client secret (expires — never stored, never logged, matching the docs' own compliance note) |
| V4 Access Control | yes | Payment-method ownership check before `detach` (D-09) — the core new access-control surface this phase introduces |
| V5 Input Validation | yes | Existing `isBoundedString`/`isPlainRecord` helpers already used in `app/api/payment-intent/route.ts`; payment-method `id` path param bounded (`id.length > 80` pattern from addresses route) before any Stripe call |
| V6 Cryptography | no (delegated) | Never hand-rolled — Stripe owns all card-data cryptography; this store never receives PAN, only Stripe ids |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: shopper A detaches shopper B's saved card by guessing/enumerating a `pm_...` id | Elevation of Privilege | `stripe.paymentMethods.retrieve(id)` then compare `.customer === stripeCustomerId` before `detach`, return 404 (not 403) on mismatch (D-09) |
| Customer Session client secret leaked via logs/telemetry | Information Disclosure | Never pass `customerSessionClientSecret` (or the PaymentIntent `clientSecret`) to `recordTelemetry(...)` calls — the existing route already avoids logging `paymentIntent.client_secret`; follow the same discipline for the new secret |
| Cross-Stripe-customer PaymentIntent misuse — a shopper's checkout somehow gets a different shopper's `stripeCustomerId` | Tampering / Elevation of Privilege | `ensureStripeCustomer` is keyed strictly off the server-derived Clerk `userId` (never a client-supplied value), matching the existing `getCustomer(userId)` pattern one line above it |
| CSRF on the DELETE payment-methods route | Tampering | `hasSameOrigin(request)` check, identical to the addresses `[id]/route.ts` DELETE precedent |

## Sources

### Primary (HIGH confidence)
- `node_modules/stripe/cjs/resources/CustomerSessions.d.ts` — full `CustomerSessionCreateParams`/`Components.PaymentElement.Features` shape, read this session
- `node_modules/stripe/esm/resources/PaymentIntents.d.ts` — `setup_future_usage` field (top-level PaymentIntent object and `PaymentIntentCreateParams`), read this session
- `node_modules/stripe/esm/resources/PaymentMethods.d.ts` — `list`, `detach`, `retrieve`, `Card` fields, read this session
- `node_modules/@stripe/stripe-js/dist/stripe-js/elements-group.d.ts` — `customerSessionClientSecret` field, read this session
- `node_modules/@stripe/react-stripe-js/dist/react-stripe.d.ts` — `<Elements>` options typing, read this session
- `docs.stripe.com/payments/save-during-payment.md?payment-ui=elements` — live-fetched this session, exact server/client code samples and the `setup_future_usage`/`payment_method_save_usage` mutual-exclusion warning
- Context7 `/websites/stripe` — cross-referenced Customer Session component config, Checkout Sessions variant (for contrast), mobile Payment Element changelog entry

### Secondary (MEDIUM confidence)
- `docs.stripe.com/changelog/acacia/2024-09-30/support-payment-element-customer-session` — dates the Payment Element + Customer Session feature's introduction

### Tertiary (LOW confidence)
- None used for any load-bearing claim in this document

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions read directly from installed `package.json` files, not training-data recall
- Architecture (Customer Session flow): HIGH — every param name cross-checked against installed `.d.ts` files AND a live Stripe docs fetch this session; no claim rests on training-data recall alone
- Pitfalls: HIGH — the `setup_future_usage`/`payment_method_save_usage` conflict is a verbatim quote from Stripe's current docs, not inferred
- Runtime-state inventory: N/A — this is a greenfield-additive phase (new table, new routes), not a rename/refactor/migration phase

**Research date:** 2026-09-11
**Valid until:** 30 days (stable, versioned SDKs; Stripe API surface for this feature has been stable since the 2024-09-30 changelog entry)

## RESEARCH COMPLETE
