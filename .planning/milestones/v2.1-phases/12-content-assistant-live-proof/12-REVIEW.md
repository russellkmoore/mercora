---
phase: 12-content-assistant-live-proof
reviewed: 2026-09-09T23:40:00Z
depth: standard
iteration: 3
files_reviewed: 16
files_reviewed_list:
  - lib/services/gift-card-fulfillment.ts
  - lib/services/checkout-pricing.ts
  - components/product/GiftCardRecipientForm.tsx
  - data/r2/knowledge_md/gift-cards.md
  - tests/integration/lib/services/gift-card-fulfillment.test.ts
  - tests/unit/lib/services/checkout-pricing.test.ts
  - tests/unit/data/knowledge-gift-cards.test.ts
  - tests/unit/components/gift-card-recipient-form-source.test.ts
  - tests/unit/lib/email/sender.test.ts
  - lib/gift-cards/customization.ts
  - lib/observability/telemetry.ts
  - workers/observability-tail/src/core.ts
  - data/d1/seed.sql
  - tests/unit/data/seed-gift-card.test.ts
  - tests/unit/lib/gift-cards/customization.test.ts
  - tests/unit/lib/gift-cards/customization-field-validators.test.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
iteration_1:
  critical: 2
  warning: 7
  info: 4
  total: 13
  resolved: 12
  open: 1
iteration_2_new:
  critical: 1
  warning: 6
  info: 5
  total: 12
iteration_3_new:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-09-09
**Depth:** standard
**Files Reviewed:** 7 (plus `cloudflare-env.d.ts`, generated — not reviewed for content)
**Status:** issues_found

## Summary

The two code fixes in this phase are correct. The fallback-tax change (`3b821f7`) holds up
under every edge case I traced, including the all-nontaxable one. The email-env threading
(`f813499`) fixes the real production failure and does not leak the Resend key.

The defects are in the third change: the gift-card knowledge article. It is the source Volt
quotes back to shoppers as fact, and the rewrite added two promises the code does not keep —
immediate delivery when a delivery date is chosen, and a personal message that is never sent.
The new source-contract test then pins the first of those false promises in place. That test
now blocks the correct wording.

Two more article claims about balance visibility do not match the shipped UI.

### Summary table

| ID | Severity | File | What |
|----|----------|------|------|
| CR-01 | Critical | `data/r2/knowledge_md/gift-cards.md:8,16` | Promises immediate delivery; a chosen delivery date defers it |
| CR-02 | Critical | `data/r2/knowledge_md/gift-cards.md:12` | Promises a personal message that is never persisted or sent |
| WR-01 | Warning | `lib/services/gift-card-fulfillment.ts:26-35` | Partial env object silently disables the sender's context fallback |
| WR-02 | Warning | `lib/services/gift-card-fulfillment.ts:170-174` | Bare `catch {}` discards the failure cause |
| WR-03 | Warning | `lib/services/checkout-pricing.ts:740-742` | Nontaxable guard keys off editable catalogue data, not the gift-card signal |
| WR-04 | Warning | `data/r2/knowledge_md/gift-cards.md:24` | Account dashboard lists purchased cards only, not received ones |
| WR-05 | Warning | `data/r2/knowledge_md/gift-cards.md:24` | Checkout shows no gift-card balance |
| WR-06 | Warning | `wrangler.jsonc:135` | Personal domain hardcoded as the sender for a reference storefront |
| WR-07 | Warning | `lib/services/gift-card-fulfillment.ts:28,33` | `RESEND_API_KEY` forwarded on the Cloudflare path where it is unusable |
| IN-01 | Info | `lib/services/gift-card-fulfillment.ts:30` | Unchecked cast of `unknown` to the `EMAIL` binding type |
| IN-02 | Info | `lib/services/gift-card-fulfillment.ts:27,32` | `EMAIL_PROVIDER` forwarding is redundant with the sender's own fallback |
| IN-03 | Info | `tests/integration/.../gift-card-fulfillment.test.ts:114-127` | Test mocks `sendEmail`, so the fixed path is still unproven |
| IN-04 | Info | `tests/unit/data/knowledge-gift-cards.test.ts:30,50-51` | Assertions too loose to hold the contract they claim |

### Answers to the four questions asked

**1. Fallback `lineTaxes` length/order and the all-zero case — correct, no defect.**
`taxableLineMinor` is `netLineMinor.map(...)`, so it keeps the length. `netLineMinor`,
`taxCodes` and `orderItems` are all `catalog.map(...)` over the same array, so index `i` means
the same line in all four. `allocateLargestRemainder` returns `weights.map(...)`, so the output
length matches too.

When every line is nontaxable, `taxableLineMinor` is all zeros, `taxableMerchandise` is zero,
`applyRate` on zero is zero, and `allocateLargestRemainder(0, [0,...])` hits the
`weightTotal === 0 && total === 0` branch and returns zeros. The `Cannot allocate tax across
zero-value lines` throw is unreachable from here: the total is derived from the same weights, so
a zero weight sum always implies a zero total.

Nontaxable lines can never pick up a stray rounding cent either. A zero weight gives remainder
`0n`, which sorts last, and the leftover count `remaining` equals the number of nonzero
fractional parts — so the `+1` loop never reaches a zero-remainder entry.

Composition stays right: `sum(lineTaxes) === merchandiseTax` and `tax === merchandiseTax +
shippingTax`. And the pre-existing behaviour is unchanged when nothing is nontaxable, because
`discountedMerchandise` already equals `sum(netLineMinor)` (`discounts.merchandise` is the
reduction of `discounts.perLine`).

**2. `emailEnvironmentFrom` leaks — none found.** I traced every path that could serialize it.
`deliverOne`'s catch takes no argument and logs nothing. `sendEmail` only ever puts
`error.message` through `bounded()`. The cron's `console.log` prints `{ attempted }`. The key is
handled as an opaque string and never compared, hashed, or interpolated. See WR-07 for the
hygiene point that it is forwarded where it cannot be used.

**3. Regression risk — the provider path is untouched; the immediate-send path has a latent
hole.** `mapProviderTaxAllocations` and the `try` branch are not modified. `fulfillPaidGiftCards`
works today on both real entry points, because `order-finalization.ts:81,191` pass no
`database`, so `order-effects.ts:300` passes `undefined` and the full env is fetched from
context. But the `{ DB: runtime.database }` branch at that same line is now broken — see WR-01.

**4. The bare `catch {}` — yes, flag it.** Filed as WR-02, Warning rather than Info: it is the
reason a `E_PROVIDER_CONFIG` result was indistinguishable from a transient bounce for eight
attempts, and the codebase already has `recordTelemetry` for exactly this.

## Critical Issues

### CR-01: The article promises immediate delivery; a chosen delivery date defers it

**File:** `data/r2/knowledge_md/gift-cards.md:8,16` (and `tests/unit/data/knowledge-gift-cards.test.ts:63-67`)

**Issue:** Line 16 states, without qualification, "The gift card is delivered by email as soon
as payment completes." Line 8 repeats it in the AI NOTES block that Volt quotes as fact.

The code does not do that when the shopper picks a delivery date. `GiftCardRecipientForm.tsx:232-243`
renders a real `<input type="date" name="deliveryDate">` accepting future dates. That value flows
through `parseGiftCardCustomization` into the order line, and `gift-card-fulfillment.ts:79` turns
it into `deliverAfter` via `scheduledDeliverAfter()` (`:40-44`), which is midnight UTC of that
date. `deliverOne`'s claim query (`:124`) has `AND deliver_after <= ?`, so the row is invisible
to both the immediate send and the cron drain until the date arrives.

So a shopper who schedules a card for a birthday three weeks out is told by the assistant that
it already sent. The order confirmation UI reinforces the wrong story
(`GiftCardRecipientBlock.tsx:44-46` renders "Deliver: {date}").

The new test makes this worse rather than catching it. Lines 63-67 assert the article must NOT
mention a delivery date:

```ts
expect(content).not.toMatch(/delivery date/i);
```

That assertion now blocks the correct wording. Note the in-app helper text
(`GiftCardRecipientForm.tsx:250-252`) claims "This date is shown on the card, not a scheduled
send date" — which is also false against `scheduledDeliverAfter`. Someone needs to decide which
one is the intended product behaviour before the article can be fixed.

**Fix:** Decide first, then make all three agree. If deferred send is intended, correct the
article and invert the test:

```markdown
## Delivery

The gift card is delivered by email as soon as payment completes, unless the buyer chose a
delivery date at purchase — in that case it sends on that date. It goes to the recipient email
address entered at purchase, and the delivery email carries the redemption code.
```

```ts
it('states that a chosen delivery date defers the send', () => {
  expect(content).toMatch(/delivery date/i);
  expect(content).toMatch(/sends on that date|on the chosen date/i);
});
```

If immediate send is intended, drop the `deliverAfter` mapping at `gift-card-fulfillment.ts:79`
and keep the article as written. Do not leave the two disagreeing.

### CR-02: The article promises a personal message that is never delivered

**File:** `data/r2/knowledge_md/gift-cards.md:12`

**Issue:** Line 12 says the shopper "can optionally add the recipient's name and a personal
message." The recipient never receives that message.

The trail ends in three places, all verified:

1. `migrations/0022_add_gift_cards.sql:386-412` — `gift_card_deliveries` has `recipient_email`
   and `recipient_name`, and no message column at all.
2. `gift-card-fulfillment.ts:95-104` — `issueLine` builds the `delivery` record with
   `recipientEmail` and `recipientName` only. The message is never passed to the repository.
3. `gift-card-fulfillment.ts:52-63` — `deliveryMessage()` composes greeting, amount, code, and
   a "keep this private" line. There is no slot for the buyer's note.

The field is real in the UI (`GiftCardRecipientForm.tsx:200-227`, 500-char textarea, validated,
counted) and is echoed back in the cart and confirmation. So the buyer types a note, sees it
confirmed on screen, is told by the assistant that it goes to the recipient, and it is dropped.
That is user-entered content silently discarded on a paid purchase.

Line 12 also omits the delivery date, which is the third optional field on that form.

**Fix:** The article is the cheap half of the fix, but it should not stand alone — this reads
as a missing feature, not a wording slip. Short term, stop promising it:

```markdown
On the gift card product page the shopper picks an amount, enters the recipient's email
address, and can optionally add the recipient's name and a delivery date. A gift message can
be added for the buyer's own records; it is not included in the delivery email.
```

Longer term, add a `recipient_message` column in a new expand-only migration, carry it through
`issueLine`, and render it in `deliveryMessage()` through `escapeHtmlText` like the other
untrusted fields.

## Warnings

### WR-01: A partial env object silently disables the sender's context fallback

**File:** `lib/services/gift-card-fulfillment.ts:26-35` (interacts with `lib/email/sender.ts:63-72`)

**Issue:** `emailEnvironmentFrom` builds its result from conditional spreads, so it can return an
object with only some keys. `resolveRuntime` branches on presence, not content:

```ts
let workerEnv = options.env ?? {};
if (!options.env) { /* fall back to getCloudflareContext */ }
```

Any non-empty object turns the fallback off. So handing over `{ DB }` is strictly worse than
handing over nothing: before this change the sender would have found `EMAIL` from the request
context, and now it will not.

That exact shape is constructed at `lib/services/order-effects.ts:300`:

```ts
environment: runtime.giftCardEnvironment ?? (runtime.database ? { DB: runtime.database } : undefined),
```

It is latent today — `order-finalization.ts:81,191` pass no `database`, and `scheduled.ts:37`
passes the full env — so no shipping caller hits it. But the next caller that passes a database
handle without `giftCardEnvironment` gets `E_PROVIDER_CONFIG` on every gift-card delivery, and
WR-02 will hide it the same way it hid this phase's failure.

**Fix:** Only pass `env` when it actually carries a provider, so the fallback stays available:

```ts
function emailEnvironmentFrom(environment: GiftCardFulfillmentEnvironment): EmailSendOptions['env'] | undefined {
  const provider = environment.EMAIL_PROVIDER;
  const resendKey = environment.RESEND_API_KEY;
  if (!environment.EMAIL && typeof resendKey !== 'string') return undefined;
  return { /* as today */ };
}
```

and widen the `deliverOne` arg to `EmailSendOptions['env'] | undefined`. Alternatively fix
`order-effects.ts:300` to pass the full env, but the guard above is what stops it recurring.

### WR-02: The per-delivery catch discards the failure cause

**File:** `lib/services/gift-card-fulfillment.ts:170-174`

**Issue:**

```ts
} catch {
  const status = exhausted ? 'needs_review' : 'pending';
  await args.database.prepare(...).run();
}
```

Nothing records what failed. This catch covers decryption, the account lookup, the D1 write, and
any throw out of `sendEmail`. All of them collapse into "still pending, try again."

This is the finding the phase context asked about, and the production evidence is already in.
Eight attempts burned against a permanent `EMAIL_PROVIDER=cloudflare requires the EMAIL binding`
configuration error, indistinguishable from a bouncing address, until the card was parked in
`needs_review` by attempt exhaustion rather than by diagnosis.

Note that a failed-but-returned `sendEmail` result (the common case) does not even reach this
catch — line 166 reads `result.success` and discards `result.error` and `result.errorCode`
without recording either. So the sender's own diagnosis is thrown away on both paths.

**Fix:** Record the cause on both. `recordTelemetry` is already used for this shape in
`scheduled.ts:47` and `checkout-pricing.ts`:

```ts
} catch (error) {
  const status = exhausted ? 'needs_review' : 'pending';
  recordTelemetry('gift_card.delivery_failed', {
    operation: 'send', outcome: exhausted ? 'needs_review' : 'retry_scheduled',
    attempt: claimed.attempt_count, retryable: !exhausted,
  }, error);
  await args.database.prepare(...).run();
}
```

and in the success branch, when `!result.success`, emit the same envelope with
`result.errorCode`. Never include `code`, `claimed.recipient_email`, or the message body.

### WR-03: The nontaxable guard trusts editable catalogue data, not the gift-card signal

**File:** `lib/services/checkout-pricing.ts:740-742`

**Issue:** The fallback decides a line owes no tax by string-matching its resolved tax code:

```ts
taxCodes[index] === NONTAXABLE_TAX_CODE ? 0 : amount
```

`taxCodes[index]` resolves as `variant.tax_category || product.tax_category || defaultTaxCode`
(`:665-676`). All three inputs are merchant-editable. The seed sets `txcd_00000000` on
`prod_33` and `variant_33`–`variant_36` (`data/d1/seed.sql:390,393-399`), so it works today —
but an admin who clears the tax category on a gift-card variant and product silently falls
through to `store.default_tax_code` (`txcd_99999999`), and the fallback starts charging sales
tax on stored value again. No test or check catches that.

The file already knows structurally which lines are gift cards. Twenty lines below, the tender
guard uses it:

```ts
const giftCardValue = orderItems.reduce((sum, item, index) => isGiftCardOrderLine(item) ? ... );
```

`isGiftCardOrderLine` reads `fulfillment_type === 'digital' && gift_card !== undefined`, both of
which are enforced at `:570-575` and cannot be edited away in the admin.

**Fix:** Zero-rate on either signal, so a mis-tagged card still cannot be taxed:

```ts
const taxableLineMinor = netLineMinor.map((amount, index) =>
  taxCodes[index] === NONTAXABLE_TAX_CODE || isGiftCardOrderLine(orderItems[index]) ? 0 : amount
);
```

`isGiftCardOrderLine` is already imported in this file.

### WR-04: "their gift cards" — the account dashboard only lists cards the shopper bought

**File:** `data/r2/knowledge_md/gift-cards.md:24`

**Issue:** "Signed-in shoppers can see their gift cards and remaining balances under Account,
then Gift Cards."

`components/account/GiftCardDashboard.tsx:70` says otherwise, in its own empty state: "No
purchased gift cards … Gift cards you purchase will appear here. For safety, gift codes are only
delivered to their recipient." The heading on each row is "Gift card purchase" (`:71`).

So the dashboard is a buyer's receipt list, not a wallet. The natural reading of "their gift
cards" is the one a recipient holds, and a recipient sees an empty page. This is the most likely
support question the article will generate.

**Fix:**

```markdown
Shoppers who bought a gift card can see it and its remaining balance under Account, then Gift
cards. A gift card someone received does not appear there — for safety the code is only ever
sent to the recipient's email.
```

Note the nav label is "Gift cards" (`components/account/AccountNav.tsx:12`), not "Gift Cards".

### WR-05: Checkout does not show a gift-card balance

**File:** `data/r2/knowledge_md/gift-cards.md:24`

**Issue:** "Anyone holding a gift card code can also see its remaining balance by entering the
code at checkout."

The checkout gift-card block (`components/checkout/CheckoutClient.tsx:474-492`) is an input and
one line of helper text — "Applied securely when the checkout quote is created." There is no
balance readout. What the shopper sees afterwards is the tender applied to this order, which
`priceCheckout` caps at `tenderEligible` (`:801`). On a $200 card against a $50 order they see
$50, not $200, and a card with no balance left is indistinguishable from a card that simply
covered nothing.

**Fix:** Drop the second sentence, or replace it with what actually happens:

```markdown
Anyone holding a code can enter it at checkout to apply it; the amount taken off this order
appears in the order summary. Checkout does not display the card's full remaining balance.
```

### WR-06: A personal domain is the committed sender for a reference storefront

**File:** `wrangler.jsonc:133-135`

**Issue:**

```jsonc
"EMAIL_PROVIDER": "cloudflare",
"STORE_SENDER_EMAIL": "Voltique <orders@russellkmoore.me>"
```

`AGENTS.md` opens by describing this repo as "a themeable reference storefront … built to render
any catalogue," with the shipped content as sample data. A personal domain in the committed
public vars does not fit that.

Two consequences. Anyone who clones and deploys inherits a sender on a domain they do not own;
Cloudflare Email Sending rejects that, and because `EMAIL_PROVIDER` is pinned to `cloudflare` the
sender throws at `sender.ts:83` rather than falling through — every gift card and order
confirmation fails, diagnosed only through WR-02's silent catch. Separately, it publishes a
maintainer's personal domain in a public repo as a mail target.

This does not break the "no secrets in wrangler.jsonc" rule — the value is public config, and
`docs/runtime-configuration.md:18,26` documents both keys. It is a deployability and
appropriateness problem, not a secrets one.

**Fix:** Put a neutral placeholder in the committed file and set the real value as a Build
variable in the Cloudflare dashboard, the way `MERCORA_ALLOW_PRODUCTION_MIGRATIONS` is handled:

```jsonc
// Override per deployment; must be on a domain onboarded to Cloudflare Email Sending.
"STORE_SENDER_EMAIL": "Voltique <orders@example.com>"
```

### WR-07: `RESEND_API_KEY` is forwarded on the Cloudflare path, where it cannot be used

**File:** `lib/services/gift-card-fulfillment.ts:28,33`

**Issue:** `emailEnvironmentFrom` always copies `RESEND_API_KEY` when it is a string, regardless
of `EMAIL_PROVIDER`. On this deployment `EMAIL_PROVIDER` is `cloudflare` (`wrangler.jsonc:133`),
so the key is never usable — but it still gets copied into an object that is built once per
drain (`:205`, `:227`) and passed through every `deliverOne` call in the loop.

`sender.ts:75-76` then constructs a client from it on every send, before the provider is even
checked:

```ts
const resendKey = stringValue(workerEnv.RESEND_API_KEY) ?? stringValue(process.env.RESEND_API_KEY);
const resend = options.resendClient ?? (resendKey ? new Resend(resendKey) : undefined);
```

I found no path that logs or serializes it — `deliverOne`'s catch takes no argument, `sendEmail`
only bounds `error.message`, and the cron logs `{ attempted }`. So this is not a proven leak. It
is a secret carried through a call tree that swallows everything, for no benefit, on a
configuration where it can never be used.

**Fix:** Forward only what the configured provider needs:

```ts
const provider = typeof environment.EMAIL_PROVIDER === 'string' ? environment.EMAIL_PROVIDER : undefined;
const resendKey = provider === 'resend' && typeof environment.RESEND_API_KEY === 'string'
  ? environment.RESEND_API_KEY
  : undefined;
```

## Info

### IN-01: Unchecked cast of `unknown` to the `EMAIL` binding type

**File:** `lib/services/gift-card-fulfillment.ts:30`

**Issue:** `environment.EMAIL as CloudflareEnv['EMAIL']` casts out of
`Record<string, unknown>` on nothing but a truthiness check. A misconfigured `EMAIL` var (a
string rather than a binding) would pass, then throw `send is not a function` inside `deliver()`,
where it is caught and returned as a generic failure and finally swallowed by WR-02 — an
indefinite pending loop from a config typo.

**Fix:** Check the shape, not the truthiness:

```ts
const emailBinding = environment.EMAIL;
const hasSend = typeof (emailBinding as { send?: unknown } | undefined)?.send === 'function';
...(hasSend ? { EMAIL: emailBinding as CloudflareEnv['EMAIL'] } : {}),
```

### IN-02: `EMAIL_PROVIDER` forwarding is redundant, and the env sources are inconsistent

**File:** `lib/services/gift-card-fulfillment.ts:27,32`

**Issue:** `sender.ts:77` already falls back to `process.env.EMAIL_PROVIDER`, which
`nodejs_compat_populate_process_env` populates from the same `wrangler.jsonc` vars block. So
forwarding it changes nothing in production. Meanwhile `deliveryMessage()` at `:53` reaches for
`getStoreConfig()`, which reads `process.env` directly (`lib/store-config.ts:470`). One function
threads the worker env explicitly and the one beside it reads a global.

Not a bug — worth a comment so the next reader does not assume the threading is load-bearing for
`from` as well as for `EMAIL`.

**Fix:** Keep the forwarding (it is correct and explicit) and note why the sender address does
not need it:

```ts
// EMAIL_PROVIDER is also readable from process.env; forwarded here so the
// sender's provider choice matches the env this drain actually holds.
```

### IN-03: The integration test mocks `sendEmail`, so the fixed path is still unproven

**File:** `tests/integration/lib/services/gift-card-fulfillment.test.ts:114-127`

**Issue:** The suite mocks the whole module at line 8:

```ts
vi.mock('@/lib/email/sender', () => ({ sendEmail: mocks.send }));
```

So the new assertion proves the env object is handed over, but never that `resolveRuntime`
accepts it. The production failure was inside `resolveRuntime` — it would still pass this test
if, say, the key names drifted from `EmailSendOptions['env']`. TypeScript covers the names, so
the test is not worthless, but it does not cover the failure it was written for.

`toMatchObject` also matches partially on the nested `env`, so it would not notice
`RESEND_API_KEY` being forwarded (WR-07).

**Fix:** Add one focused unit test against the real `resolveRuntime` path:

```ts
const binding = { send: vi.fn().mockResolvedValue({ messageId: 'm1' }) };
const result = await sendEmail(message, { env: { EMAIL: binding, DB: env.DB, EMAIL_PROVIDER: 'cloudflare' } });
expect(result).toMatchObject({ success: true, provider: 'cloudflare' });
```

and assert the negative that actually bit: `{ DB }` alone with `EMAIL_PROVIDER=cloudflare`
returns `errorCode: 'E_PROVIDER_CONFIG'`.

### IN-04: Knowledge-article assertions are looser than the contract they claim

**File:** `tests/unit/data/knowledge-gift-cards.test.ts:30-31,50-51`

**Issue:** The file's header comment argues, correctly, that the committed bytes are the
contract. Several assertions do not hold that line:

- `:30` — `expect(content).toMatch(/cash/i)` passes on any occurrence of "cash". It would pass on
  "can be redeemed for cash," the inverse of the intended promise.
- `:50-51` — `toContain("Account")` and `toContain("Gift Cards")` match anywhere in the file,
  independently. Two unrelated words in two unrelated paragraphs satisfy the "names Account ->
  Gift Cards as where a balance is visible" test.

**Fix:** Assert the sentence, not the vocabulary:

```ts
it('states the card is not redeemable for cash', () => {
  expect(content).toMatch(/cannot be redeemed for cash/i);
});

it('names Account -> Gift cards as where a purchased balance is visible', () => {
  expect(content).toMatch(/under Account, then Gift cards/i);
});
```

Also fix the label casing to match `AccountNav.tsx:12` ("Gift cards").

---

## Iteration 2

**Reviewed:** 2026-09-09 (re-review after `12-REVIEW-FIX.md`)
**Depth:** standard, scoped to the seven fix commits (`5045b58`, `48b2e42`, `09c376f`,
`09b291b`, `0539897`, `dc8cf6d`, `127a0bc`)
**Status:** issues_found — **1 new Critical, 6 new Warnings, 5 new Info**

### What the fixes got right

I traced the four things the re-review brief asked about. Most of them hold.

**The message path is safe against injection.** `escapeHtmlText`
(`lib/utils/maintenance-html.ts:5-12`) covers `& < > " '`, and every line of the note goes
through it (`gift-card-fulfillment.ts:161-164`). The subject is a fixed
`` `${store.identity.name} gift card` `` (`:156`) with no shopper input in it. `to` comes from
the delivery row, `from` from `getStoreConfig()`. The Cloudflare `EMAIL` binding and Resend both
take a structured object and build the MIME themselves (`lib/email/sender.ts:167-170,183`), so
there is no raw header assembly for the note to break out of. Newlines cannot reach a header.

**Length is bounded twice.** `normalizedMessage` caps at 500 and rejects control characters
(`lib/gift-cards/customization.ts:41-57`); `giftMessageFor` re-clamps to
`GIFT_CARD_MESSAGE_MAX_LENGTH` on the way back out of storage (`:142`). Worst-case HTML
expansion is bounded (250 non-empty lines max, each escaped).

**The bearer code is still contained.** `giftMessageFor` reads only `orders.items`, which never
holds a code. `logDeliveryFailure` carries no body and no code. The `finally { code = undefined }`
is untouched. The integration test's `not.toMatch(/GC-[A-Z0-9]{4}/)` assertion holds.

**The order-snapshot read is correctly scoped and cannot cross orders.**
`gift_card_deliveries.order_id` / `order_line_id` are written from `issuedOrderId` /
`issuedLineId` (`lib/gift-cards/repository.ts:278-297`), which are `order.id` / `line.id`, and
`orders.items[].id` is the same value (`checkout-pricing.ts:592`). The lookup is parameterized.
The order row always exists before effects run — `finalizeZeroCashGiftOrder` and
`finalizeOrderPayment` both `select().from(orders)` first, so the immediate-send path finds the
snapshot.

**The tax change cannot zero-rate a non-gift line, and `lineTaxes` stays aligned.**
`isGiftCardOrderLine` needs `fulfillment_type === 'digital'` **and** a `gift_card` block
(`lib/gift-cards/checkout.ts:21-23`), and `gift_card` is only set when
`checkoutGiftCardCustomization` returned a value, which itself requires `product.type ===
'gift_card'` (`checkout-pricing.ts:565-575`). A plain digital product has no `gift_card` block.
Alignment holds because `catalog`, `orderItems`, `pricedCatalog` and `netLineMinor` are all
`.map()` over the same array, so `orderItems[index]` is never undefined and
`allocateLargestRemainder` returns a same-length array. The new unit test
(`checkout-pricing.test.ts:427-476`) exercises the real mis-tagged case.

**Article claims I checked against the shipped UI and found accurate:** the "Gift card" field
label (`CheckoutClient.tsx:476-478`), the "Other tender" summary line (`OrderSummary.tsx:141-146`),
the Account → "Gift cards" wording, the four denominations (`seed.sql:390`), guest purchase, and
the one-year date bound (`GiftCardRecipientForm.tsx:105,236-237`).

Now the defects.

### Iteration 2 summary table

| ID | Severity | File | What |
|----|----------|------|------|
| CR-03 | Critical | `data/d1/seed.sql:390` | CR-01's fix missed the product copy, which Volt also retrieves |
| WR-08 | Warning | `lib/services/gift-card-fulfillment.ts:159-165` | The note makes the delivery email a buyer-authored channel on the store's domain |
| WR-09 | Warning | `lib/services/gift-card-fulfillment.ts:87-96` | The new log bypasses the project's telemetry contract, so nothing alerts and free text reaches logs |
| WR-10 | Warning | `lib/services/gift-card-fulfillment.ts:249-254` | The corrupted-material park is still silent — the one terminal failure WR-02 didn't cover |
| WR-11 | Warning | `lib/services/checkout-pricing.ts:744-746` | WR-03 hardened only the fallback; the provider path still taxes a mis-tagged card |
| WR-12 | Warning | `tests/unit/data/knowledge-gift-cards.test.ts:86` | Dead assertion — `\\d` matches a literal backslash, not a digit |
| WR-13 | Warning | `data/r2/knowledge_md/gift-cards.md:16` | "sent on that date" is a day early for every shopper west of UTC |
| IN-05 | Info | `lib/services/gift-card-fulfillment.ts:143-145` | `giftMessageFor` fails soft in silence while every other path now logs |
| IN-06 | Info | `tests/integration/.../gift-card-fulfillment.test.ts:207-236` | The fail-soft branch the fix report describes has no test |
| IN-07 | Info | `components/product/GiftCardRecipientForm.tsx:200-227` | The form never tells the buyer the note is emailed; the change is retroactive |
| IN-08 | Info | `lib/services/gift-card-fulfillment.ts:290,303-305` | `boundedDetail` evaluated twice per log, behind non-null assertions |
| IN-09 | Info | `lib/services/gift-card-fulfillment.ts:50-52` | The Resend-key guard reads the handed env only, not the effective provider |

### Answers to the four questions asked

**1. The message path — safe on injection, but it opens a new outbound channel.** Escaping,
bounding, header isolation, code containment and fail-soft all check out (detail above). The
finding is WR-08: the content itself is now attacker-authorable. IN-05 and IN-06 cover the
silence and the missing test on the fail-soft branch.

**2. The failure logging — no code, no secret; the recipient is not guaranteed.** `giftCardId`,
`attempt`, `outcome` and `errorName` are all safe. `detail` is not: it is up to 200 characters of
whatever the email provider returned, unfiltered. This project has a purpose-built mechanism for
exactly that problem — `sanitizeTelemetryFields` drops anything outside a closed enum and reduces
throwables to an `error_class` from an allowlist — and the fix went around it. See WR-09. WR-10
covers the failure path that still logs nothing at all.

**3. The tax change cannot zero-rate a non-gift line and keeps `lineTaxes` aligned — verified.**
Both properties hold, for the reasons above. But the fix is half of the fix: WR-11.

**4. The article now matches the code on three of four surfaces.** Delivery date, message,
balance visibility and the checkout field all check out against the shipped code. Two things
remain: the same immediacy claim survives in the product description (CR-03), and "sent on that
date" is wrong by a day for US shoppers (WR-13).

## Critical Issues (Iteration 2)

### CR-03: CR-01's fix corrected three surfaces and missed the fourth — the product copy

**File:** `data/d1/seed.sql:390`

**Issue:** CR-01 was raised because the article promised unconditional immediate delivery. The fix
corrected the article, the in-app helper text, and the test. It did not correct the product
description, which still says:

> The Voltique Gift Card **arrives by email as soon as payment clears** and never expires…

That string is not decoration. `app/api/admin/vectorize/route.ts:186-187` reads
`product.description.en` into the embedded text, and `:439-441` writes it into the indexed
markdown under `## Description`. So it is retrieved by the same assistant, for the same shopper
question, alongside the article that now says the opposite. It is also the copy on the product
page itself, which is where the shopper is standing when they pick a delivery date.

The result is worse than before the fix, not better: the knowledge article and the catalogue now
disagree, and product search generally outranks an FAQ article for "gift card" queries. A shopper
who schedules a card for a birthday three weeks out can be told, by the same assistant in the
same conversation, both that it sends now and that it sends on the date.

By the severity bar iteration 1 set for CR-01, this is the same finding in a more prominent place.

**Fix:** Change the description and re-index. Migrations are expand-only, so this is a seed edit
plus a data update against the live D1 row, then a re-run of the product indexer — the same
two-step the article fix already went through.

```sql
-- data/d1/seed.sql:390, description.en
"Give the gear, skip the guesswork. The Voltique Gift Card arrives by email as soon as payment
clears — or on the delivery date you choose — and never expires, so your recipient can spend it
on anything in the shop…"
```

Check `meta_description` on the same line while you are in there; "deliver by email after
payment" is vague enough to survive, but it reads as immediate.

Add the seed to the article contract test's reach, or add a sibling test, so the two cannot drift
again:

```ts
it('the catalogue copy does not promise an unconditional immediate send', () => {
  const seed = readRepoFile('data/d1/seed.sql');
  const giftRow = seed.split('\n').find((line) => line.startsWith("('prod_33'"))!;
  expect(giftRow).not.toMatch(/as soon as payment clears(?![^"]*delivery date)/i);
});
```

## Warnings (Iteration 2)

### WR-08: The gift message turns the delivery email into a buyer-authored channel on the store's sending domain

**File:** `lib/services/gift-card-fulfillment.ts:159-165,170`

**Issue:** Before `48b2e42`, every byte of this email was written by the store. Now up to 500
characters of it are written by whoever paid for the card, and sent to an address that same
person chose, from `orders@` on a domain with passing SPF and DKIM.

The HTML side is escaped, so no markup and no clickable anchor. The **text** side is not, and
does not need to be:

```ts
text: `${greeting}\n\nYou received a ${args.amount.format()} gift card.${noteText}\n\nCode: ${args.code}\n\nKeep this code private.`,
```

Almost every mail client autolinks a bare URL in `text/plain`. So the deliverable is a
transactional email from a real storefront, containing an attacker-chosen link, immediately above
a line that says "Keep this code private" — which is exactly the frame a credential-phishing
message wants. The note is also unattributed: nothing in the email says the quoted block came
from the buyer rather than from Voltique.

The integration test at `:207-221` pins this open. It asserts
`expect(sent.text).toContain('<script>alert(1)</script>')` — correct for a `text/plain` part, but
it means the suite now guarantees raw shopper markup reaches the wire on that side.

What holds this down is cost: one paid gift card, minimum $25, per message, with a Stripe trail.
That is why this is a Warning and not a Blocker. It is not a hole in the application; it is a new
reputational and phishing surface with no moderation, no rate limit, and no attribution.

**Fix:** Two cheap mitigations, either of which changes the economics:

```ts
// 1. Attribute the block so it never reads as store copy.
const noteText = args.giftMessage
  ? `\n\nA message from the sender:\n\n"${args.giftMessage}"`
  : '';

// 2. Neutralize URL-like tokens in the note on both sides.
const withoutLinks = args.giftMessage?.replace(/\b(?:https?:\/\/|www\.)\S+/giu, '[link removed]');
```

Longer term this belongs behind the moderation path the project already has for AI output
(`lib/ai/moderation.ts`), and behind `PUBLIC_RATE_LIMITER`.

### WR-09: The new failure log bypasses the project's telemetry contract

**File:** `lib/services/gift-card-fulfillment.ts:87-96` (and its two call sites, `:285-291`,
`:298-306`)

**Issue:** WR-02 asked for `recordTelemetry`, naming `scheduled.ts:47` and `checkout-pricing.ts`
as the existing shape. The fix instead wrote a bespoke `console.error(JSON.stringify(...))`.

That is not a style difference. `lib/observability/telemetry.ts` is a closed contract with three
jobs, and this log does none of them:

1. **Nothing alerts.** The envelope carries no `marker: 'commerce.telemetry.v1'`
   (`telemetry.ts:3`), and `gift_card.delivery_failed` is not in `TELEMETRY_EVENTS`
   (`:25-78`) or in `TAIL_CRITICAL_EVENTS` (`workers/observability-tail/src/core.ts:9`). The tail
   consumer filters on both (`core.ts:178-186`). So the exact scenario this fix was written for —
   eight attempts burned against a permanent `E_PROVIDER_CONFIG` — still pages nobody. It is now
   diagnosable *after* you go looking, which is a real improvement, but the operational half of
   WR-02 is not done.

2. **Free text reaches the log.** `detail` is `boundedDetail(result.error)`, which is whatever the
   provider returned, clipped to 200 characters and passed through verbatim.
   `sanitizeTelemetryFields` (`telemetry.ts:181-...`) exists precisely so this cannot happen: it
   keeps only values inside `ALLOWED_FIELD_ENUMS` and reduces throwables to an `error_class` drawn
   from `ALLOWED_ERROR_CLASSES` (`:83-102`). Every throw I traced inside the `try` has a static
   message (`GiftCardDecryptionError` and friends at `lib/gift-cards/encryption.ts:55-81`,
   `'Gift-card account is missing'`), so the **catch** path is clean today. The **success** path is
   not: `result.error` on a provider rejection is third-party text, and a rejection for a bad
   address is the single most likely one. The header comment on `logDeliveryFailure` promises
   "never the recipient". Nothing in the code enforces that promise.

3. **No severity and no sampling**, so this line is indistinguishable from noise in the log stream
   and there is no rate control on a drain loop that can log 25 times per cron tick.

**Fix:** Register the event and route it through the existing helper. Every field the review asked
for is already in the allowlist — `operation: 'send'`, `outcome: 'retry_scheduled' | 'needs_review'`,
`provider: 'gift_card'`, `attempt`, `retryable` all validate as-is:

```ts
// lib/observability/telemetry.ts, TELEMETRY_EVENTS
'gift_card.delivery_failed': { severity: 'error', sampleRate: 1 },
'gift_card.delivery_needs_review': { severity: 'critical', sampleRate: 1 },
```

```ts
recordTelemetry('gift_card.delivery_failed', {
  operation: 'send',
  outcome: exhausted ? 'needs_review' : 'retry_scheduled',
  provider: 'gift_card',
  attempt: claimed.attempt_count,
  retryable: !exhausted,
}, error);
```

If the provider's own diagnosis is genuinely needed, map `result.errorCode` onto a small closed
set (`E_PROVIDER_CONFIG`, `E_DELIVERY_INDETERMINATE`, `other`) rather than logging its message.
Add `gift_card.delivery_needs_review` to `TAIL_CRITICAL_EVENTS` so exhaustion pages someone.

### WR-10: The corrupted-material path still parks to `needs_review` with no log

**File:** `lib/services/gift-card-fulfillment.ts:249-254`

**Issue:** WR-02 named two paths and the fix covered both. There is a third:

```ts
if (!claimed.code_ciphertext || !claimed.code_nonce || !claimed.code_key_version) {
  await args.database.prepare(`UPDATE gift_card_deliveries SET status = 'needs_review', ...`)
  return;
}
```

No log, no telemetry, no counter. This is the most alarming outcome in the whole function — a
delivery row whose encrypted code material is missing or corrupt, meaning a paid gift card that
can never be delivered and needs a human to reissue it. It is also terminal on the first attempt,
so it never reaches the retry budget that would eventually surface it. The integration test
"moves corrupted retry material to review without rendering or sending a bearer code" proves the
row is parked; nothing proves anyone finds out.

**Fix:** Log it at the same severity as exhaustion, before the update:

```ts
logDeliveryFailure({           // or recordTelemetry per WR-09
  giftCardId: args.giftCardId,
  attempt: claimed.attempt_count,
  outcome: 'needs_review',
  errorName: 'GiftCardDeliveryMaterialMissing',
});
```

### WR-11: The tax fix hardens the fallback only; the provider path still taxes a mis-tagged card

**File:** `lib/services/checkout-pricing.ts:744-746` (compare `:710-719`)

**Issue:** The code change is correct. The comment above it is not:

> …`isGiftCardOrderLine` reads `fulfillment_type` and the `gift_card` block, both enforced at line
> construction and not editable in the admin, **so a mis-tagged card still cannot be taxed.**

It can. `NONTAXABLE_TAX_CODE` and `isGiftCardOrderLine` appear together in exactly one place in
this file — the `catch` branch. The `try` branch sends `tax_code: taxCodes[index]` straight to
Stripe (`:697`) and applies whatever comes back (`:715-717`). So the admin action WR-03 was raised
about — clearing `tax_category` on the gift-card variant and product, dropping the line through to
`store.default_tax_code` (`txcd_99999999`) — still charges sales tax on stored value on the path
that runs every time the tax provider is up. The fallback is the rare path, and it is the only one
that is now safe.

The new test reinforces the gap: it forces `calculateTax` to throw, so it only ever exercises the
branch that was fixed.

**Fix:** Zero-rate at classification, so both paths inherit it:

```ts
const taxCodes = catalog.map(({ product, variant }, index) => {
  if (isGiftCardOrderLine(orderItems[index])) return NONTAXABLE_TAX_CODE;
  const code = variant.tax_category || product.tax_category || defaultTaxCode;
  ...
});
```

That needs `orderItems` built before `taxCodes`, which it already is (`:585` vs `:667`). The
fallback line then reduces back to the single tax-code check, and the guarantee in the comment
becomes true. Add the mirror test with a working `calculateTax` stub asserting the gift line's
allocation is zero even when Stripe returns tax for it.

### WR-12: A new assertion in the article contract test can never fire

**File:** `tests/unit/data/knowledge-gift-cards.test.ts:86`

**Issue:**

```ts
expect(content).not.toMatch(/within \\d+ (minute|hour|day)/i);
```

In a regex literal, `\\` is an escaped backslash. This pattern matches a literal backslash
followed by one or more `d` characters — `within \ddd hour`. It cannot match `within 24 hours`.
Verified:

```
> /within \\d+ (minute|hour|day)/i.test('delivered within 24 hours')
false
```

So the guard against re-promising a send window is decorative. Its sibling on line 87
(`/instantl?y|immediately/i`) is fine, which is what makes this easy to miss — the test passes and
looks like it has two teeth.

**Fix:**

```ts
expect(content).not.toMatch(/within \d+ (minute|hour|day)/i);
```

Sanity-check it by temporarily adding "within 24 hours" to the article and confirming the test
goes red.

### WR-13: "sent on that date" is a day early for every shopper west of UTC

**File:** `data/r2/knowledge_md/gift-cards.md:16` (behaviour at
`lib/services/gift-card-fulfillment.ts:98-103`)

**Issue:** The article now says:

> If the buyer chose a delivery date at purchase — any date up to a year ahead — it is sent on
> that date instead.

The date the shopper picks is a **local** calendar date: the `<input type="date">` is bounded by
`computeDeliveryDateBounds()`, and `localIsoDate` (`customization.ts:181-186`) is explicitly
written to use local components rather than `toISOString()`. But `scheduledDeliverAfter` converts
it to **midnight UTC**:

```ts
return Math.floor(Date.UTC(year, month - 1, day) / 1_000);
```

The cron runs every five minutes (`wrangler.jsonc:11`) and claims any row with
`deliver_after <= now`. So a shopper in US Pacific who picks December 25 gets the card delivered
at 16:00 on December 24 local — the birthday email lands the evening before the birthday. Every US
time zone is affected, all year. The store's own default sender is US-facing.

This is pre-existing behaviour, but the article claim asserting it is new in `5045b58`, and the
test at `:80-83` now pins the claim.

**Fix:** Pick one. Either make the words survive the timezone:

```markdown
…it is sent on that date instead, on UTC time — so a card scheduled for the 25th can arrive
late on the 24th where you are.
```

or, better, offset the schedule so the card lands during the recipient's morning. There is no
recipient timezone available, but the store has one:

```ts
/** Local-morning-ish epoch second: midnight UTC of the chosen date plus the store's UTC offset. */
function scheduledDeliverAfter(deliveryDate: string | undefined, utcOffsetHours = 0): number {
  if (!deliveryDate) return 0;
  const [year, month, day] = deliveryDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 1_000) - utcOffsetHours * 3_600;
}
```

Whichever way it goes, do not leave the article asserting a calendar guarantee the scheduler does
not make.

## Info (Iteration 2)

### IN-05: `giftMessageFor` fails soft in silence

**File:** `lib/services/gift-card-fulfillment.ts:143-145`

**Issue:** `catch { return undefined; }` covers the `orders` read, `JSON.parse`, and the line
lookup. Fail-soft is the right call — a card without its note beats no card. But the article now
states as fact that "The personal message is included in the delivery email", so a silent drop is
a broken published promise with zero signal, in the one function in this file that no longer logs
anything. A schema drift on `orders.items`, or an order row purged by a retention job before a
scheduled send comes due, would quietly stop delivering notes forever.

**Fix:** Log the miss without changing the behaviour:

```ts
} catch (error) {
  logDeliveryFailure({ giftCardId, attempt, outcome: 'retry_scheduled',
    errorName: error instanceof Error ? error.name : 'GiftMessageUnavailable' });
  return undefined;
}
```

(or the `recordTelemetry` equivalent per WR-09). It needs the gift-card id threaded in.

### IN-06: The fail-soft branch has no test

**File:** `tests/integration/lib/services/gift-card-fulfillment.test.ts:207-236`

**Issue:** The two new tests cover message-present and message-absent. `12-REVIEW-FIX.md` claims
"a missing order, unparseable items JSON, missing line, or absent message sends the card without
the note rather than failing the delivery" — three of those four are unproven. Every test in the
file calls `insertOrder` first.

**Fix:** One test that never inserts the order:

```ts
it('still delivers the card when the order snapshot is gone', async () => {
  const order = giftOrder('Happy birthday!');
  await insertOrder(order);
  await fulfillPaidGiftCards(order, { environment: runtimeEnvironment(), now });
  await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(order.id).run();
  mocks.send.mockResolvedValueOnce({ success: true, id: 'no-snapshot' });
  await drainGiftCardDeliveries({ environment: runtimeEnvironment(), now: now + 1 });
  const sent = mocks.send.mock.calls.at(-1)?.[0] as { text: string; html: string };
  expect(sent.text).toContain('Code: ');
  expect(sent.html).not.toContain('<blockquote>');
});
```

### IN-07: The form never tells the buyer the note is emailed, and the change is retroactive

**File:** `components/product/GiftCardRecipientForm.tsx:200-227`

**Issue:** Two small things worth a decision rather than a fix.

The field is labelled "Gift message (optional)" with placeholder "Add a personal note" and no
helper text. Every other optional field on this form got a helper sentence; this one did not, and
it is now the field whose contents leave the building. The delivery-date field got its copy
corrected in the same commit — this one is the same class of gap.

Separately, `48b2e42` reads the note out of the order snapshot at *send* time, not at issue time.
Any delivery still sitting in `pending` from an order placed before this commit — including every
card scheduled for a future date — will pick up its buyer's note on the next drain. Those buyers
wrote the note when it was never sent. Almost certainly fine and arguably an improvement, but it
is a retroactive change to already-paid orders and should be a deliberate call, not a side effect.

**Fix:** Add the sentence:

```tsx
<p className="mt-1 text-xs text-muted-foreground">
  Included in the delivery email the recipient receives.
</p>
```

### IN-08: `boundedDetail` is evaluated twice per log, behind non-null assertions

**File:** `lib/services/gift-card-fulfillment.ts:290`, `:303-305`

**Issue:**

```ts
...(boundedDetail(error instanceof Error ? error.message : error)
  ? { detail: boundedDetail(error instanceof Error ? error.message : error)! }
  : {}),
```

The same expression is written twice and the `!` re-asserts what the test already established. It
is correct, just hard to read and easy to desynchronize on the next edit.

**Fix:**

```ts
const detail = boundedDetail(error instanceof Error ? error.message : error);
logDeliveryFailure({ ..., ...(detail ? { detail } : {}) });
```

### IN-09: The Resend-key guard reads the handed env, not the effective provider

**File:** `lib/services/gift-card-fulfillment.ts:40,50-52`

**Issue:** `provider` is read only from `environment.EMAIL_PROVIDER`. The sender resolves the
provider as `workerEnv.EMAIL_PROVIDER ?? process.env.EMAIL_PROVIDER` (`sender.ts:77`). So an
environment object that carries `RESEND_API_KEY` but no `EMAIL_PROVIDER`, on a worker where
`process.env.EMAIL_PROVIDER === 'cloudflare'`, still forwards the key — the case WR-07 was raised
to prevent. Narrow today, because the only real caller hands over the full worker env from
`getCloudflareContext()`, which always carries the `vars` block. Worth closing while the reasoning
is fresh.

**Fix:**

```ts
const provider = typeof environment.EMAIL_PROVIDER === 'string'
  ? environment.EMAIL_PROVIDER
  : process.env.EMAIL_PROVIDER;
```

### Still open from Iteration 1

**WR-06** (`wrangler.jsonc:135`, personal domain as the committed sender) was skipped by explicit
instruction, not fixed. It remains open by decision. Nothing in iteration 2 changes the analysis.

## REVIEW COMPLETE

**Iteration 2 findings:** 12 new — **1 Critical, 6 Warning, 5 Info**
**Carried from Iteration 1:** 1 open (WR-06, Warning, skipped by decision)
**Total open:** 13 — 1 Critical, 7 Warning, 5 Info

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard — iteration 2, scoped to the fix commits_

---

## Iteration 3

**Reviewed:** 2026-09-09 (final pass before deploy)
**Depth:** standard, scoped to the five iteration-2 fix commits (`5353af9`, `518e1c0`,
`ebba508`, `9075943`, `84bd958`)
**Status:** **no new Critical.** 3 new Warnings, 2 new Info — **none of them blocks the
deploy.** Ship it.

### Verdict

I ran every gate myself rather than taking the fix report's numbers:

| Gate | Result |
|------|--------|
| `npm run typecheck` | clean |
| `npx eslint` on the five touched source files | 0 output |
| `npm test` | 279 files, 2366 tests passed |
| `npm run test:workers` | 27 files, 157 tests passed |
| `npm run test:observability-worker` | 1 file, 3 tests passed |

All five focus areas hold. The three Warnings below are all in the telemetry envelope and
in one cart edge case. None of them changes what a shopper is charged, what an email
contains, or whether a card gets delivered.

### The five things the brief asked about

**1. URL rejection — no false positives found, error shape unchanged.**

I ran the three live patterns from `lib/gift-cards/customization.ts:35-39` against twenty
realistic gift messages. Zero false positives, including every shape the brief named:

```
"see you at 5.30"            allowed    "Love, Mom & Dad"            allowed
"Happy Birthday! 🎉🎂🎁"      allowed    "Enjoy — from all of us ❤️"   allowed
"Meet me at 7 p.m./8 p.m."   allowed    "U.S./Canada trip fund"      allowed
"3.5/5 stars, buy the boots" allowed    "see p.34/35 of the guide"   allowed
"c/o Jane Doe, Apt. 4B"      allowed    "Спасибо! 🎿"                 allowed
"half price = $12.50/night"  allowed    "and/or whatever you like"   allowed
```

Pattern 3 (`/\b[a-z0-9][a-z0-9-]*\.[a-z]{2,}\//iu`) is the only one that could catch prose,
and it needs **two or more letters immediately after the dot and then a slash**. That is
what keeps `p.m./`, `p.34/`, `U.S./` and `5.30` out: in each case the character after the
dot is a digit, or only one letter precedes the slash. Emoji and Cyrillic do not interact
with it — `\b` and the character classes are ASCII, and `u` does not change that.

The blocking cases all fire: `https://…`, `HTTP://EVIL.TEST`, `www.evil.test`,
`evil.test/claim`, `EVIL.TEST/x`, `evil.co.uk/x`.

Error shape is unchanged for the form. `normalizedMessage` still throws the same
`GiftCardCustomizationValidationError` with the same message, so nothing downstream sees a
new type. `validateGiftCardMessage` returns the existing `invalid_format` code, which
already had a slot in `GiftCardFieldError`, and `messageErrorCopy`
(`GiftCardRecipientForm.tsx:43-48`) now has copy for it. `messageError !== null` still feeds
`isDisabled` at line 111, so the Add-to-Cart button gates on it exactly as before.

**2. Telemetry envelope — passes `sanitizeTelemetryFields` intact; the tail worker sees it.**

Every field survives the closed taxonomy. Checked each against
`lib/observability/telemetry.ts:108-129`: `operation: 'send'` ✓, `outcome: 'failed'` ✓,
`provider: 'cloudflare_email' | 'resend' | 'd1'` ✓ (all three in the set),
`trigger: 'recovery'` ✓, `retryable` is a boolean ✓, `attempt` is a bounded integer ✓.
Nothing is dropped. `gift_card.delivery_failed` is registered `{ severity: 'critical',
sampleRate: 1 }` and is in `TAIL_CRITICAL_EVENTS`, so the marker check and the event filter
in `workers/observability-tail/src/core.ts` both pass. `recordTelemetry` is fully
try/catch-wrapped and fails open, so a telemetry problem can never fail a delivery.
`ALLOWED_FIELD_ENUMS` was not touched, so the byte-parity test with the tail worker still
holds — and it passes.

The *values* are another matter; see WR-15.

**3. `taxCodes` override cannot throw for a gift line — verified.**

`orderItems` is built at `checkout-pricing.ts:585`, `taxCodes` at `:679`, both
`catalog.map(...)` over the same array, so `orderItems[index]` is never `undefined`. The
short-circuit `if (isGiftCardOrderLine(orderItems[index])) return NONTAXABLE_TAX_CODE;` is
the **first** statement in the callback, before `code` is computed and before the
`requireTaxCategory` throw. There is no path from a gift-card line to
`Checkout line N has no valid tax classification`. `NONTAXABLE_TAX_CODE` is
`'txcd_00000000'`, which satisfies the `/^txcd_\d{8}$/` shape the provider call expects, so
skipping the validation does not send Stripe anything malformed. Non-gift lines are
untouched: `isGiftCardOrderLine` needs `fulfillment_type === 'digital'` **and** a
`gift_card` block, and the block is only set when `product.type === 'gift_card'` (`:565-575`).

**4. Email layout after moving the note below the code — correct on both sides.**

Text: greeting → amount → `Code: …` → `Keep this code private.` → `Message from the sender:`
→ quoted note. HTML: the same order, with the note in
`<p>Message from the sender:</p><blockquote>…</blockquote>` after the keep-private
paragraph. Blank lines are filtered out of the HTML, so an all-whitespace note produces no
empty `<blockquote>`; and `giftMessageFor` returns `undefined` for a message that trims to
empty, so `noteText`/`noteHtml` are both `''` and the email ends cleanly at
"Keep this code private." with no dangling separator. The integration test asserts the
ordering with `indexOf` on both bodies, which is the right assertion.

**5. `seed.sql` — statement order and INSERT syntax intact.**

The change is a single-line edit **inside** one already-quoted JSON string on the `prod_33`
row. No statement was added, removed, or reordered, so the "exactly three statements, each
an `INSERT OR IGNORE INTO`" assertion is untouched (and passes). The inserted text
introduces no `'` (which would need SQL doubling) and no `"` (which would break the JSON),
so both the SQL string literal and the embedded JSON stay well-formed. The two em dashes
are non-ASCII, but `data/d1/seed.sql` already carried non-ASCII on lines 13, 21, 23, 84, 98
and 170 before this change, so nothing new is being asked of the pipeline. Both new seed
contract tests pass, including the load-bearing negative
`/as soon as payment clears(?![^"]*delivery date)/i`.

### Iteration 3 summary table

| ID | Severity | Blocks deploy | File | What |
|----|----------|---------------|------|------|
| WR-14 | Warning | No | `lib/services/gift-card-fulfillment.ts:166-169` | A critical, tail-paging event fires on a delivery that **succeeded** |
| WR-15 | Warning | No | `lib/services/gift-card-fulfillment.ts:103-117` | `provider` and `trigger` are wrong in the two cases that matter, and the new test pins a fixture `sendEmail` never returns |
| WR-16 | Warning | No | `lib/gift-cards/customization.ts:82-88` | A persisted cart line with a URL in its note is silently dropped on rehydrate |
| IN-10 | Info | No | `lib/gift-cards/customization.ts:38` | A bare host with no path still passes, and several clients autolink it |
| IN-11 | Info | No | `lib/gift-cards/customization.ts:203` | The validator and the parser run the URL check over two different strings |

## Warnings (Iteration 3)

### WR-14: A critical, tail-paging event fires on a delivery that succeeded

**File:** `lib/services/gift-card-fulfillment.ts:166-169` (via `:99-111`)

**Issue:** IN-05's fix put `recordDeliveryFailure` in `giftMessageFor`'s catch. That catch
covers the `orders` read, `JSON.parse`, and the line lookup — none of which is a delivery
failure. When it fires, the card is still sent, the row still reaches `sent`, and the buyer
still gets what they paid for. The only thing lost is the note.

The envelope says otherwise, three times over:

- the event is literally named `gift_card.delivery_failed`, and `outcome: 'failed'`;
- it is registered `severity: 'critical'` and listed in `TAIL_CRITICAL_EVENTS`, so the tail
  worker emails an alert;
- `retryable: true`, when nothing is retried — `deliverOne` proceeds straight to a
  successful send and marks the row `sent`.

The new integration test pins exactly this. `still delivers the card when the order snapshot
cannot be read` asserts `status: 'sent'` **and** one `gift_card.delivery_failed` envelope
from the same run. So the suite now guarantees a critical page on a successful delivery.

It is rare (it needs an unreadable order snapshot), which is why it is a Warning and not a
blocker. But it makes the alert semantically untrustworthy: the one event you want on-call
to react to without thinking now sometimes means "everything worked, minus a nicety."

**Fix:** Give the note-drop its own event, or at minimum stop calling it a delivery failure.
The cheapest correct version reuses the existing `email.delivery_failed`-style shape at a
non-critical severity:

```ts
// lib/observability/telemetry.ts
'gift_card.message_unavailable': { severity: 'warning', sampleRate: 1 },
```

```ts
// giftMessageFor's catch
recordTelemetry('gift_card.message_unavailable', {
  operation: 'read', outcome: 'degraded', provider: 'd1', retryable: false,
}, error);
```

`'read'`, `'degraded'` and `'d1'` are all already in `ALLOWED_FIELD_ENUMS`, so this needs no
change to the taxonomy contract or its byte-parity test — only the one new event line and
the tail worker left alone (a warning-severity event is not in `TAIL_CRITICAL_EVENTS`, which
is the point). Update the IN-06 test's `.filter((entry) => entry.event === …)` accordingly.

### WR-15: The envelope's `provider` and `trigger` are wrong in the two cases that matter

**File:** `lib/services/gift-card-fulfillment.ts:103-117`, `:324-328`
(and `tests/integration/lib/services/gift-card-fulfillment.test.ts:192-195`)

**Issue:** Two closed-enum fields carry confident, wrong values.

**`provider`.** `telemetryProvider` falls through to `'d1'` for anything it does not
recognise:

```ts
function telemetryProvider(provider: unknown): 'cloudflare_email' | 'resend' | 'd1' {
  if (provider === 'cloudflare') return 'cloudflare_email';
  if (provider === 'resend') return 'resend';
  return 'd1';
}
```

`sendEmail` returns `provider` **undefined** on the `E_PROVIDER_CONFIG` path, because
`resolveRuntime` threw before a provider was chosen (`lib/email/sender.ts:195-196`):

```ts
catch (error) { return { success: false, error: …, errorCode: PROVIDER_CONFIG_ERROR }; }
```

So the exact production incident this whole phase was raised about — `EMAIL_PROVIDER=cloudflare
requires the EMAIL binding` — now pages on-call with `provider: 'd1'`. The envelope carries no
`errorCode` and no `error_class` (the success-branch call passes no error), so `provider` is
the only subsystem hint in it, and it points at the database. That is worse than omitting the
field, and the field is optional.

**The new test hides this.** `84bd958` changed the mock fixture from the real shape to:

```ts
mocks.send.mockResolvedValue({
  success: false, provider: 'cloudflare', error: 'permanent bounce',
  errorCode: 'E_PROVIDER_CONFIG',
});
```

`sendEmail` never returns `provider` alongside `E_PROVIDER_CONFIG`. The fixture was adjusted
to make `provider: 'cloudflare_email'` assert green, so the suite now proves a shape that
cannot occur and does not exercise the one that can.

**`trigger`.** It is hardcoded `'recovery'` at all four sites. But `deliverOne` runs from
`fulfillPaidGiftCards` (`:374`) as well as from the cron drain (`:396`), and
`fulfillPaidGiftCards` is the immediate post-payment path. So a first-attempt failure on a
just-paid card is labelled as cron recovery, sending whoever reads the alert to the wrong
place. `'webhook'` and `'request'` are both already in the allowlist.

**Fix:** Stop asserting what is not known, and thread the trigger.

```ts
function telemetryProvider(provider: unknown): 'cloudflare_email' | 'resend' | undefined {
  if (provider === 'cloudflare') return 'cloudflare_email';
  if (provider === 'resend') return 'resend';
  return undefined; // sanitizeTelemetryFields simply omits it
}
```

Widen `recordDeliveryFailure`'s `provider` to `… | undefined` and spread it conditionally,
the way `attempt` already is. Add a `trigger: 'webhook' | 'recovery'` argument to
`deliverOne`, set from its two callers. Then restore the test fixture to the real
`E_PROVIDER_CONFIG` shape (no `provider` key) and assert the field is **absent**.

### WR-16: A persisted cart line with a URL in its note is silently dropped

**File:** `lib/gift-cards/customization.ts:82-88` (effect at `lib/stores/cart-store.ts:377-394`)

**Issue:** The URL rejection was added to `normalizedMessage`, which is inside
`parseGiftCardCustomization` — and that function does not only run on new form input. It also
runs over **already-persisted cart state** on every rehydrate:

```ts
// lib/stores/cart-store.ts, migrateCartState — runs on every localStorage rehydrate
normalized = normalizeCartItemForStore({ …cartItem, … });
…
if (!normalized) return items;   // line silently dropped
```

`normalizeCartItemForStore` (`line-identity.ts:87-94`) catches the throw and returns `null`,
and the reducer then omits the line. No error, no toast, no console message — the gift card
just is not in the cart any more. The same tightening also makes
`projectCartLineForCheckout` throw `Cart contains an invalid line` at checkout submit for the
same data.

So on the deploy, any browser holding a cart whose gift-card note contains `http://`, `www.`
or `host/path` loses that line without being told why. Nothing is charged and no placed order
is affected — `giftMessageFor` reads the order snapshot and never re-parses, so paid orders
are untouched.

The blast radius on this storefront is small enough that it does not justify holding the
deploy. It is filed because it is a *silent* drop of shopper-entered data introduced by
tightening a validator that runs over persisted state, which is the kind of thing that is
much harder to diagnose later than to note now.

**Fix:** Nothing before this deploy. If it recurs on a busier catalogue, drop the offending
field rather than the whole line during migration, since the note is optional:

```ts
// in migrateCartState only — never in the form path
try { normalized = normalizeCartItemForStore(cartItem); }
catch { /* retry once without the message */ }
```

## Info (Iteration 3)

### IN-10: A bare host with no path still passes the URL filter

**File:** `lib/gift-cards/customization.ts:38`

**Issue:** `evil.test` is allowed by design — pattern 3 requires a trailing slash, and the
comment explains why (it keeps `5.30pm` and `U.S./Canada` out of the net). The stated reason
for the allowance is that "without a path most clients do not autolink it." That is only
partly true: Gmail and Apple Mail both linkify a bare host with a recognised TLD in a
`text/plain` part in common cases. So the shape most likely to be tried
(`voltique-rewards.test`) is also the shape that gets through.

This is not a hole the fix opened — it is the deliberate edge of a defence-in-depth measure,
and two other mitigations sit behind it (the note is attributed, and it now sits below the
code and the keep-private line). Worth revisiting only if a real abuse attempt shows up.

**Fix:** If it ever matters, tighten pattern 3 to a TLD allowlist rather than a trailing
slash — `\.(?:com|net|org|io|co|xyz|link|click|top|shop)\b` catches the bare-host case
without touching `5.30pm` or `p.m./8`.

### IN-11: The validator and the parser run the URL check over two different strings

**File:** `lib/gift-cards/customization.ts:203` (compare `:85`)

**Issue:** `normalizedMessage` calls `containsUrlLike(normalized)`; `validateGiftCardMessage`
calls `containsUrlLike(value)` on the raw input. I traced this and found no case where they
disagree today — normalization only removes characters (per-line trim, whitespace collapse)
and NFC cannot produce an ASCII `.` or `/` — so the form's error code always matches the
reason the parser threw. It is a latent desynchronisation, not a live one: a future
normalization step that *rewrites* rather than removes would let the parser throw for a URL
while the form reports `too_long`.

**Fix:** Normalize once and check the same string:

```ts
export function validateGiftCardMessage(value: string): GiftCardFieldError | null {
  if (value.trim().length === 0) return null;
  try { normalizedMessage(value); return null; }
  catch {
    if (CONTROL_CHARACTERS.test(value)) return 'control_characters';
    if (containsUrlLike(normalizeMessageText(value))) return 'invalid_format';
    return 'too_long';
  }
}
```

extracting the normalization body of `normalizedMessage` into a shared `normalizeMessageText`.

### Still open from earlier iterations

**WR-06** (`wrangler.jsonc:135`, personal domain as the committed sender) — open by decision,
unchanged.

Not re-raised, as instructed: the single critical `gift_card.delivery_failed` event covering
both transient and terminal failures, and the retroactive pickup of notes on pre-`48b2e42`
pending deliveries. Both are recorded debt. Note that WR-14 above is a *different* problem
from the accepted one — it is not about a failure being over-severe, it is about the event
firing when nothing failed.

## REVIEW COMPLETE

**Iteration 3 findings:** 5 new — **0 Critical, 3 Warning, 2 Info**
**Deploy blockers:** **0.** Nothing in these five commits justifies holding the deploy.
**Carried open:** WR-06 (Warning, by decision) plus two accepted debt items.
**Total open after iteration 3:** 9 — 0 Critical, 4 Warning, 2 Info, 3 accepted debt.

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard — iteration 3, scoped to the iteration-2 fix commits_
