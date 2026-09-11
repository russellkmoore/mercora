# Phase 17: Saved Payment Methods - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 13 (2 new/existing schema+migration, 1 new lib module, 4 checkout-flow files, 4 account UI/route files, 2+ test files, AccountNav)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `migrations/0025_add_payment_customers.sql` | migration | CRUD | `migrations/` file that created `subscription_provider_customers` (schema shape in `lib/db/schema/subscriptions.ts:117-129`) | exact (schema shape) |
| `lib/db/schema/payments.ts` (`paymentCustomers`) | model | CRUD | `lib/db/schema/subscriptions.ts` `subscriptionProviderCustomers` (lines 117-129) | exact |
| `lib/payments/customer-binding.ts` (`ensureStripeCustomer`) | service | CRUD (idempotent find-or-create) | `lib/subscriptions/acquisition-service.ts` `establishProviderCustomer` (241-289) + `stableId` (123-128) + `lib/subscriptions/repository.ts` find/bind SQL (272-286) + `lib/subscriptions/stripe-provider.ts` `createProviderCustomer` (206-221) | exact (mirror, not import) |
| `app/api/payment-intent/route.ts` (Customer Session addition) | route/controller | request-response | itself — existing signed-in customer-provisioning block (~213-238) and PaymentIntent creation branch (~242-264) | exact (same file, new block) |
| `components/checkout/StripeProvider.tsx` | component/provider | request-response | itself — existing `elementsOptions` conditional-spread convention (fonts/locale) | exact |
| `components/checkout/PaymentForm.tsx` (comment update only) | component | request-response | itself — `wallets.link: 'never'` line + comment (~80-87) | exact |
| `components/checkout/CheckoutClient.tsx` | component | request-response | itself — `clientSecret` state/response-handling (130, 283-301, 533) | exact |
| `app/api/account/payment-methods/route.ts` (GET) | route/controller | CRUD (read) | `app/api/account/addresses/route.ts` GET (lines 8-13) | exact |
| `app/api/account/payment-methods/[id]/route.ts` (DELETE) | route/controller | CRUD (delete) | `app/api/account/addresses/[id]/route.ts` DELETE (lines 34-53) | exact |
| `app/account/payment-methods/page.tsx` | route (server component) | request-response | `app/account/addresses/page.tsx` (auth gate + render pattern) | exact |
| `components/account/PaymentMethodList.tsx` | component | CRUD (list/remove) | `components/account/AddressManager.tsx` (full file, esp. `remove()` at 20-33) | exact |
| `components/account/AccountNav.tsx` | component/config | request-response | itself — `accountLinks()` (lines 4-14) | exact |
| `tests/unit/lib/payments/customer-binding.test.ts` | test | unit | `tests/unit/lib/subscriptions/acquisition-service.test.ts` (`mocks()` shape, 51-80+) | exact |
| migration-ordering test for `0025` | test | integration | `tests/integration/gift-cards-migration.test.ts` (full file) | exact |
| `tests/unit/app/api/account-payment-methods.test.ts` | test | unit | none direct — closest is `payment-intent-authority.test.ts`'s hoisted-mock style combined with addresses route's own behavior (no existing test file for addresses routes was found; use the mock/vi.hoisted pattern from `payment-intent-authority.test.ts`) | role-match |
| `tests/unit/app/account-security-source.test.ts` (extend) | test | unit | itself (full file, 25 lines) | exact |
| `tests/unit/app/api/payment-intent-authority.test.ts` (extend) | test | unit | itself (hoisted-mock block, lines 1-40+) | exact |

## Pattern Assignments

### `migrations/0025_add_payment_customers.sql` (migration)

**Analog:** `lib/db/schema/subscriptions.ts:117-129` (`subscriptionProviderCustomers` — describes the table `0025` must mirror; also see `tests/integration/gift-cards-migration.test.ts` for the migration-ordering test convention).

**Table shape to mirror** (from schema, translate to raw SQL per D-01 — no extra `uniqueIndex` per Assumptions Log A1):
```sql
CREATE TABLE payment_customers (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(stripe_customer_id) BETWEEN 5 AND 255 AND stripe_customer_id GLOB 'cus_*')
);
```
(Verified against RESEARCH.md's Code Examples section; `subscription_provider_customers`'s Drizzle definition has an extra `uniqueIndex("...pair_unique")` that D-01 does not ask for — omit it.)

---

### `lib/db/schema/payments.ts` (`paymentCustomers`)

**Analog:** `lib/db/schema/subscriptions.ts:117-129`
```typescript
export const subscriptionProviderCustomers = sqliteTable("subscription_provider_customers", {
  customerId: text("customer_id").primaryKey().references(() => customers.id, { onDelete: "restrict" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (table) => [
  uniqueIndex("subscription_provider_customers_pair_unique")
    .on(table.customerId, table.stripeCustomerId),
  check("subscription_provider_customers_stripe_id_check", sql`
    length(${table.stripeCustomerId}) BETWEEN 5 AND 255
    AND ${table.stripeCustomerId} GLOB 'cus_*'
  `),
]);
```
Mirror this into `paymentCustomers` targeting `payment_customers`, table name and check-constraint name updated, dropping the pair-unique index (not requested by D-01). Import `customers` from `lib/db/schema/customer.ts` the same way subscriptions.ts does.

---

### `lib/payments/customer-binding.ts` (`ensureStripeCustomer`)

**Analog:** `lib/subscriptions/acquisition-service.ts:241-289` (algorithm), `:123-128` (`stableId`, duplicate locally — not exported/shared), `lib/subscriptions/repository.ts:272-286` (SQL shape), `lib/subscriptions/stripe-provider.ts:206-221` (Stripe call shape).

**Core find-or-create/conflict pattern** (mirror exactly, re-target new table, own function names e.g. `findPaymentCustomer`/`bindPaymentCustomer`):
```typescript
async function establishProviderCustomer(args: {...}): Promise<string> {
  const existing = await args.repository.findProviderCustomer(args.input.customerId);
  if (existing) {
    const verified = await args.provider.retrieveProviderCustomer({...});
    if (verified.customerId !== args.input.customerId || verified.stripeCustomerId !== existing.stripeCustomerId) {
      throw new SubscriptionProviderConflictError("Provider customer ownership changed");
    }
    return existing.stripeCustomerId;
  }
  const idempotencyKey = await stableId("subscription-customer", args.input.customerId);
  const created = await args.provider.createProviderCustomer({...idempotencyKey});
  if (created.customerId !== args.input.customerId) throw new SubscriptionProviderConflictError(...);
  const result = await args.repository.bindProviderCustomer({...});
  if (result === "conflict") {
    const winner = await args.repository.findProviderCustomer(args.input.customerId);
    if (!winner) throw new SubscriptionProviderConflictError("Provider customer mapping did not converge");
    const verified = await args.provider.retrieveProviderCustomer({...});
    if (verified.customerId !== args.input.customerId || verified.stripeCustomerId !== winner.stripeCustomerId) {
      throw new SubscriptionProviderConflictError("Provider customer ownership changed");
    }
    return verified.stripeCustomerId;
  }
  return created.stripeCustomerId;
}
```

**`stableId` — duplicate locally, unexported, do not import:**
```typescript
async function stableId(prefix: string, ...parts: string[]): Promise<string> {
  const encoded = new TextEncoder().encode(parts.join(" "));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 48)}`;
}
```

**SQL to mirror (D1 `INSERT OR IGNORE` + re-read-on-conflict):**
```sql
SELECT customer_id AS customerId, stripe_customer_id AS stripeCustomerId
  FROM payment_customers WHERE customer_id = ? LIMIT 1

INSERT OR IGNORE INTO payment_customers
  (customer_id, stripe_customer_id) VALUES (?, ?)
-- changes > 0 -> "created"; else re-SELECT and compare -> "identical" | "conflict"
```

**Stripe create call shape (idempotency key + metadata, no unneeded fields):**
```typescript
const customer = await this.#client.customers.create({
  metadata: { mercora_customer_id: customerId },
  ...(email === undefined ? {} : { email }),
  ...(name === undefined ? {} : { name }),
}, { idempotencyKey });
```

**Note (D-06c / RESEARCH Pitfall 5):** `lib/payments/` already contains `refund-email.ts`, `refund-idempotency.ts`, `refund-ledger-store.ts`, `refund-ledger.ts`, `refund-lifecycle.ts`, `refund-tender.ts` — no `customer-binding.ts` or barrel file exists yet, so no literal collision, but double-check no shared export name clashes.

---

### `app/api/payment-intent/route.ts` (Customer Session addition)

**Analog:** itself — existing signed-in customer-provisioning block.

**Current signed-in provisioning block to extend** (verified this session, ~213-238 region):
```typescript
if (userId) {
  try {
    const existingCustomer = await getCustomer(userId);
    if (!existingCustomer) {
      const user = await currentUser();
      await createCustomer({ id: userId, type: 'person', person: {...} });
    }
  } catch (error) {
    recordTelemetry('payment.customer_prepare_failed', {
      operation: 'persist', outcome: 'failed', provider: 'd1',
      retryable: true, path: '/api/payment-intent',
    }, error);
    return NextResponse.json({ error: 'Could not prepare authenticated checkout' }, { status: 503 });
  }
}
```
`ensureStripeCustomer(...)` call slots in right after this block, still inside `if (userId)`, but per D-04/Pitfall 2 its failure must NOT 503 — catch locally, `recordTelemetry` with a **new**, distinctly-named event (per Assumptions Log A2 — do not reuse `payment.customer_prepare_failed`), and fall through with `stripeCustomerId = undefined`.

**PaymentIntent creation branch to extend** (non-zero-cash branch, ~242+):
```typescript
if (total.gt(Money.zero(total.currency))) try {
  paymentIntent = await createPaymentIntent({
    amount: total.toMinorUnits(),
    currency: total.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: { orderId, expectedAmount: String(total.toMinorUnits()), currency: total.currency },
    shipping: { address: {...}, name: shippingAddress.recipient || 'Customer' },
    description: `Order ${orderId}`,
    // ADD: ...(stripeCustomerId ? { customer: stripeCustomerId } : {})
    // DO NOT add setup_future_usage — integration error per D-06a/Pitfall 1
  });
} catch (error) { ... }
```

**Customer Session creation (new, best-effort, only when `stripeCustomerId` obtained — RESEARCH Pattern 2):**
```typescript
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
// customerSession.client_secret -> response field customerSessionClientSecret
```
Must live strictly inside the `if (userId)` gate and only fire when `stripeCustomerId` was actually obtained (Pitfall 3). Never pass either client secret to `recordTelemetry` (Security Domain — Information Disclosure).

---

### `components/checkout/StripeProvider.tsx`

**Analog:** itself.

**Current signature/conditional-spread convention (verified):**
```typescript
interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
  options?: StripeElementsOptions;
}
export default function StripeProvider({ children, clientSecret, options = {} }: StripeProviderProps) {
  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: { /* theme tokens */ },
    ...(options.fonts && { fonts: options.fonts }),
    ...(options.locale && { locale: options.locale }),
  };
  return <Elements stripe={stripePromise} options={elementsOptions}>{children}</Elements>;
}
```
Add `customerSessionClientSecret?: string` prop + one spread line following the same convention:
`...(customerSessionClientSecret ? { customerSessionClientSecret } : {})`.

---

### `components/checkout/CheckoutClient.tsx`

**Analog:** itself.
```typescript
const [clientSecret, setClientSecret] = useState<string>('');
// response handling:
const data = await res.json() as { noCash?: boolean; clientSecret: string; paymentIntentId: string; orderId: string; quote: AuthoritativeCheckoutQuote };
setClientSecret(data.clientSecret);
// remount:
<StripeProvider key={clientSecret} clientSecret={clientSecret}>
```
Add `customerSessionClientSecret?: string` to the response type, a new paired `useState`, set alongside `setClientSecret`, and thread onto `<StripeProvider ... customerSessionClientSecret={customerSessionClientSecret}>`. Existing `key={clientSecret}` remount is sufficient — no new remount key.

---

### `components/checkout/PaymentForm.tsx` (comment only)

**Analog:** itself, `~80-87` — `wallets.link: 'never'` line stays byte-identical; only the adjacent comment explaining *why* changes (store now has its own saved-card feature; Link deliberately still disabled).

---

### `app/api/account/payment-methods/route.ts` (GET)

**Analog:** `app/api/account/addresses/route.ts:8-13`
```typescript
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const customer = await getCustomer(userId);
  return NextResponse.json({ addresses: customer?.addresses ?? [] });
}
```
No `hasSameOrigin` on GET (non-mutating) — same asymmetry as addresses. Replace body with the payment-customer lookup + `stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' })`, returning `{ paymentMethods: [] }` when no binding exists (D-08 — empty list, not 404).

**Core list/project pattern (RESEARCH Pattern 5):**
```typescript
const methods = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' });
// project: methods.data.map(pm => ({
//   id: pm.id, brand: pm.card!.brand, last4: pm.card!.last4,
//   expMonth: pm.card!.exp_month, expYear: pm.card!.exp_year,
// }))
```

---

### `app/api/account/payment-methods/[id]/route.ts` (DELETE)

**Analog:** `app/api/account/addresses/[id]/route.ts:34-53`
```typescript
function denial() {
  return NextResponse.json({ error: "Payment method not found" }, { status: 404 }); // rename message
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 });
  const { id } = await context.params;
  if (!id || id.length > 80) return denial();
  try {
    // lookup stripeCustomerId for userId; if none -> denial()
    // stripe.paymentMethods.retrieve(id); if pm.customer !== stripeCustomerId -> denial() [404, not 403 — D-09]
    // await stripe.paymentMethods.detach(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment method could not be removed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```
Error-code convention identical to addresses: 401 unauthenticated, 403 same-origin failure, 404 for both "not found" and "not yours" (don't leak, D-09), no 403 for ownership mismatch.

---

### `app/account/payment-methods/page.tsx`

**Analog:** `app/account/addresses/page.tsx` — server component, `auth()` gate, renders client list component. Follow that file's exact shape (fetch/derive data server-side or let the client component self-fetch — match whichever `addresses/page.tsx` does), with `<PaymentMethodList />` in place of `<AddressManager initial={...} />`.

---

### `components/account/PaymentMethodList.tsx`

**Analog:** `components/account/AddressManager.tsx` (full file read).

**Remove pattern to mirror (lines 20-33):**
```typescript
async function remove(id: string) {
  setBusy(true); setMessage("");
  try {
    const response = await fetch(`/api/account/addresses/${encodeURIComponent(id)}`, {
      method: "DELETE", credentials: "same-origin",
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) throw new Error(body.error || "Address could not be removed");
    setAddresses((current) => current.filter((entry) => entry.id !== id));
    setMessage("Address removed.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Address could not be removed");
  } finally { setBusy(false); }
}
```
Mirror this exact shape against `/api/account/payment-methods/${id}`, list state instead of addresses, and per D-14/discretion a native `confirm()` before calling `remove()` (no Dialog component). Row rendering follows the same `<article className="rounded-lg border border-border bg-surface-elevated p-4">` token-class pattern, showing brand + last4 + expiry text (no icons per D-08) instead of address lines, with a single "Remove" button (no "Edit" — read/remove only per D-10). No add-card form section (unlike AddressManager's `<AddressForm>` block) — payment methods are added only at checkout.

---

### `components/account/AccountNav.tsx`

**Analog:** itself, `accountLinks()` (lines 4-14):
```typescript
export function accountLinks(subscriptionReconciliation: boolean) {
  return [
    ["Overview", "/account"],
    ["Orders", "/account/orders"],
    ...(subscriptionReconciliation ? [["Subscriptions", "/account/subscriptions"] as const] : []),
    ["Addresses", "/account/addresses"],
    ["Settings", "/account/settings"],
  ] as const;
}
```
Add `["Payment methods", "/account/payment-methods"]` unconditionally (D-11 — no feature flag), placed alongside `["Addresses", ...]` in the array (order is Claude's discretion but adjacent to Addresses is the obvious fit).

---

### Test files

**`tests/unit/lib/payments/customer-binding.test.ts`** — analog `tests/unit/lib/subscriptions/acquisition-service.test.ts`, `mocks()` shape (lines 51-80+):
```typescript
function mocks() {
  const repository = {
    findProviderCustomer: vi.fn().mockResolvedValue(undefined),
    bindProviderCustomer: vi.fn().mockResolvedValue("created"),
    // ...
  };
  const provider = {
    createProviderCustomer: vi.fn().mockResolvedValue({ customerId: "user_one", stripeCustomerId: "cus_one", livemode: false }),
    retrieveProviderCustomer: vi.fn().mockResolvedValue({ customerId: "user_one", stripeCustomerId: "cus_one", livemode: false }),
    // ...
  };
}
```
Mirror `vi.hoisted`/mock-factory conventions from this file for `findPaymentCustomer`/`bindPaymentCustomer`/Stripe `customers.create`/`retrieve`, covering find-existing, create-new, bind-conflict-reconcile paths.

**Migration-ordering test for `0025`** — analog `tests/integration/gift-cards-migration.test.ts` (full file read). Exact shape to copy:
```typescript
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

it("adds payment_customers without disturbing a populated <N-1> baseline", async () => {
  const index = env.TEST_MIGRATIONS.findIndex(({ name }) => name === "0025_add_payment_customers.sql");
  expect(index).toBeGreaterThan(0);
  const before = env.TEST_MIGRATIONS.slice(0, index);
  const only0025 = env.TEST_MIGRATIONS.slice(index, index + 1);
  await applyD1Migrations(env.DB, before);
  // insert a baseline customer row, snapshot, applyD1Migrations(env.DB, only0025), assert snapshot unchanged
  // assert `SELECT count(*) AS count FROM payment_customers` === { count: 0 }
});
```

**`tests/unit/app/api/account-payment-methods.test.ts`** — no existing test file covers the addresses routes directly; use the `vi.hoisted`/`vi.mock` structure from `tests/unit/app/api/payment-intent-authority.test.ts` (lines 1-40+):
```typescript
const mocks = vi.hoisted(() => ({ auth: vi.fn(), /* ...stripe client, payment-customer lookup... */ }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
```
Cover: 401 unauthenticated, empty-list when no binding, list projection shape `{id, brand, last4, expMonth, expYear}`, DELETE 403 on cross-origin, DELETE 404 on ownership mismatch, DELETE success path.

**`tests/unit/app/account-security-source.test.ts`** (extend) — analog itself, full 25-line file:
```typescript
const addressCollection = readFileSync("app/api/account/addresses/route.ts", "utf8");
const addressItem = readFileSync("app/api/account/addresses/[id]/route.ts", "utf8");
// ...
it("requires Clerk ownership and same-origin mutation guards", () => {
  for (const source of [addressCollection, addressItem, settings]) {
    expect(source).toContain("await auth()");
    expect(source).toContain("hasSameOrigin(request)");
  }
});
```
Add `readFileSync("app/api/account/payment-methods/route.ts", ...)` and `.../[id]/route.ts`; assert `await auth()` on both, `hasSameOrigin(request)` on the DELETE route only (GET route is exempt, matching addresses precedent — do not put the GET source in the `hasSameOrigin` loop).

**`tests/unit/app/api/payment-intent-authority.test.ts`** (extend) — analog itself, hoisted-mock block (lines 1-40+):
```typescript
const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(), createPaymentIntent: vi.fn(), auth: vi.fn(),
  getCustomer: vi.fn(), createCustomer: vi.fn(), /* ADD: ensureStripeCustomer, customerSessions.create-equivalent */
}));
vi.mock('@/lib/models/mach/customer', () => ({ getCustomer: mocks.getCustomer, createCustomer: mocks.createCustomer }));
```
Add a mocked `ensureStripeCustomer` (mock `@/lib/payments/customer-binding`) and a mocked Stripe client's `customerSessions.create`. Cover: signed-in-with-existing-binding, signed-in-first-save, signed-in-binding-failure-falls-through (still gets PaymentIntent, no `customer`/`customerSessionClientSecret`), guest-unaffected (no binding call attempted).

## Shared Patterns

### Account route auth/same-origin/error shape
**Source:** `app/api/account/addresses/route.ts` (GET) and `app/api/account/addresses/[id]/route.ts` (PUT/DELETE)
**Apply to:** `app/api/account/payment-methods/route.ts`, `app/api/account/payment-methods/[id]/route.ts`
```typescript
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
if (!hasSameOrigin(request)) return NextResponse.json({ error: "Origin validation failed" }, { status: 403 }); // mutation only
```

### D1 idempotent-binding table (CAS pattern)
**Source:** `lib/subscriptions/repository.ts:272-286`, `lib/db/schema/subscriptions.ts:117-129`
**Apply to:** `lib/db/schema/payments.ts`, `migrations/0025_add_payment_customers.sql`, `lib/payments/customer-binding.ts`
`PRIMARY KEY` on the Mercora-side id, `UNIQUE` + `GLOB` CHECK on the provider id, `INSERT OR IGNORE` + re-read-on-conflict.

### Account list/remove client component
**Source:** `components/account/AddressManager.tsx`
**Apply to:** `components/account/PaymentMethodList.tsx`
Local `useState` list + `busy`/`message` state, `fetch(..., { method: 'DELETE', credentials: 'same-origin' })`, optimistic local filter on success, error message surfaced via `role="status"` paragraph.

### Never log Stripe client secrets
**Source:** existing `app/api/payment-intent/route.ts` discipline (never logs `paymentIntent.client_secret`)
**Apply to:** the new Customer Session block in `app/api/payment-intent/route.ts`
Never pass `customerSessionClientSecret` or `clientSecret` to `recordTelemetry(...)`.

## No Analog Found

None — every file in scope has a strong (mostly exact) analog in the existing codebase.

## Metadata

**Analog search scope:** `lib/subscriptions/`, `lib/db/schema/`, `app/api/account/addresses/`, `app/account/addresses/`, `components/account/`, `components/checkout/`, `app/api/payment-intent/`, `lib/payments/`, `tests/integration/`, `tests/unit/lib/subscriptions/`, `tests/unit/app/api/`, `tests/unit/app/`
**Files scanned:** 17-CONTEXT.md, 17-RESEARCH.md, `lib/db/schema/subscriptions.ts`, `app/api/account/addresses/route.ts`, `app/api/account/addresses/[id]/route.ts`, `components/account/AccountNav.tsx`, `components/account/AddressManager.tsx`, `lib/payments/*.ts` (directory listing), `tests/integration/gift-cards-migration.test.ts`, `tests/unit/lib/subscriptions/acquisition-service.test.ts`, `tests/unit/app/account-security-source.test.ts`, `tests/unit/app/api/payment-intent-authority.test.ts`, `app/api/payment-intent/route.ts` (signed-in block + PaymentIntent creation branch)
**Pattern extraction date:** 2026-09-11

## PATTERN MAPPING COMPLETE
