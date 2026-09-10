# Runtime configuration

**Status:** Current (2026-09-09).

Mercora has neutral demo defaults in `lib/store-config.ts`. A storefront can
override public, non-secret values without editing components. The configuration
is resolved when a request/render needs it; it is not captured at module import
time.

| Purpose | Variable |
| --- | --- |
| Store identity | `NEXT_PUBLIC_STORE_NAME`, `NEXT_PUBLIC_STORE_TAGLINE`, `NEXT_PUBLIC_STORE_DESCRIPTION` |
| Assistant/MCP | `NEXT_PUBLIC_ASSISTANT_NAME`, `MCP_CAPABILITIES`, `MCP_DESCRIPTION` |
| Public host and SEO | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ROBOTS_INDEX=true` |
| Images | `NEXT_PUBLIC_IMAGE_CDN`, `NEXT_PUBLIC_IMAGE_TRANSFORMS=false` |
| Browser persistence | `NEXT_PUBLIC_STORAGE_NAMESPACE`, `NEXT_PUBLIC_CART_STORAGE_KEY`, `NEXT_PUBLIC_CHAT_STORAGE_KEY` |
| Theme | `NEXT_PUBLIC_STORE_LOGO_PATH`, `NEXT_PUBLIC_THEME_DEFAULT` (deploy-time theme fallback; see `docs/theming.md`) |
| Contact and legal links | `STORE_SUPPORT_EMAIL`, `STORE_SENDER_EMAIL`, `STORE_REPLY_TO_EMAIL`, `STORE_MERCHANT_NOTIFICATION_EMAIL`, `STORE_POSTAL_ADDRESS`, `STORE_SUPPORT_HOURS`, `NEXT_PUBLIC_PRIVACY_URL`, `NEXT_PUBLIC_TERMS_URL`, `NEXT_PUBLIC_RETURNS_URL` |
| Commerce formatting | `STORE_LOCALE` (canonical BCP 47 locale, defaults to `en-US`), `STORE_CURRENCY` (must match active catalog variant currency; Mercora checkout is single-currency per cart) |
| Gift-card honor (redeem, settle, refund existing cards) | `STORE_FEATURE_GIFT_CARD_RECONCILIATION=true` (defaults off; keep enabled while any card balance or reservation exists — see the four-state table below) |
| Gift-card sell (new purchases) | `STORE_FEATURE_GIFT_CARD_ACQUISITION=true` (defaults off; requires honor enabled — see the four-state table below) |
| Gift-card bearer lookup secrets | Server-only `GIFT_CARD_CODE_HMAC_CURRENT_VERSION` plus `GIFT_CARD_CODE_HMAC_KEYS_JSON` (at most four versioned keys; never `NEXT_PUBLIC_*`) |
| Gift-card delivery encryption secrets | Server-only `GIFT_CARD_DELIVERY_CURRENT_VERSION` plus `GIFT_CARD_DELIVERY_KEYS_JSON` (at most four versioned AES-256 keys, base64-encoded, `base64:`-prefixed; never `NEXT_PUBLIC_*`) |
| Subscription reconciliation | `STORE_FEATURE_SUBSCRIPTION_RECONCILIATION=true` (defaults off; keep enabled after the first subscription is sold) |
| Optional subscription acquisition | `STORE_FEATURE_SUBSCRIPTION_ACQUISITION=true` plus a bounded `STORE_SUBSCRIPTION_TERMS_VERSION` matching the published recurring terms (defaults off and requires reconciliation enabled) |
| Outbound email | `EMAIL_PROVIDER=cloudflare\|resend`; Cloudflare `EMAIL` binding (recommended) or encrypted `RESEND_API_KEY`. `STORE_SENDER_EMAIL` must be an address on a domain onboarded to Email Sending in *your own* Cloudflare account (or verified in Resend) — the committed value is the reference deployment's and will be rejected on any other account |

`NEXT_PUBLIC_*` values are intentionally public. Store credentials (Stripe
secrets, Clerk secrets, Cloudflare API tokens) belong in `.dev.vars` locally or
Cloudflare secrets remotely, never in this file or `wrangler.jsonc`.

`NEXT_PUBLIC_*` values are inlined at **build** time. `build:worker` injects them from
`wrangler.jsonc` `vars` via `scripts/build-with-public-env.mjs`, and that copy overrides a
Cloudflare Dashboard Build variable of the same name; see `docs/DEPLOYMENT_SETUP.md`
§6 Step 1b for the full precedence and checklist.

Storefront colours no longer come from an environment variable. The active
look is selected by the `data-theme` attribute on `<html>` and resolves
through the matching `themes/*.css` file in the CSS cascade.

`STORE_CURRENCY` currently supports `USD`, `EUR`, `GBP`, `CAD`, `AUD`, `CHF`,
`CNY`, `INR`, `BRL`, `JPY`, `BHD`, and `KWD`. Unsupported values fall back to
`USD`; extend `lib/money/currencies.ts` before enabling another currency.

Optional money features resolve lazily. Before a store has subscription state,
leaving both acquisition and reconciliation disabled creates no subscription
provider or persistence adapter. Once subscriptions are installed,
reconciliation is an independent runtime responsibility: turning off new
acquisition/UI must not turn off lifecycle webhooks, paid-invoice orders,
cancellation, payment recovery, or retryable notifications for existing
subscriptions. Enabling acquisition without installed reconciliation is a
configuration error. Deploy the additive schema first, install reconciliation,
then enable the acquisition flag.

## Gift-card sell and honor flags

Two independent flags gate gift cards. Code, tests, and this doc call them **sell**
(`STORE_FEATURE_GIFT_CARD_ACQUISITION`) — can a shopper buy a new card — and **honor**
(`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) — are existing cards redeemed, settled, and refunded.
The env var names never change; only the words used to describe them do. Enable honor first, then
sell.

Leaving both flags off does not mean the deploy is inert. The recovery cron measures outstanding
gift-card balances on every five-minute tick regardless of either flag, by design (D-05): the
measurement is what tells the runtime whether it is safe to *stop* honoring, so a cron that only ran
while honoring was on could never produce the reading that turns honoring off. The measurement is
also the only thing that would notice a balance nobody remembered. Two consequences worth knowing
before you deploy:

- The gift-card tables must exist before that tick runs. On a deploy that has not yet applied the
  additive gift-card migrations, the tick logs `[cron] gift-card honor guard unavailable` every five
  minutes and carries on — the three recovery drains still run, and honoring stays wherever the flag
  left it. It is noise, not damage, and it stops as soon as the migrations are applied.
- The request path is a different story, and is genuinely inert with both flags off: it opens no D1
  connection for gift cards and parses no bearer-code keys.

The four states:

| Sell | Honor | What a shopper sees | What an operator should know |
| --- | --- | --- | --- |
| on | on | Normal. Gift cards are for sale; existing cards redeem, settle, and refund. | — |
| off | on | Stopped selling, still honoring. The product is hidden from every listing (home, category, search, `/api/products`, Volt's results); a direct link to `/product/gift-card` still renders, with "Gift cards are not available right now" in place of the purchase form. Checkout refuses any gift-card line. | This is the rollback state — see below. |
| off | off | Gift cards do not exist. Every surface is absent or 404s: no listing entry, no product page, no checkout panel, no admin nav entry, no public balance endpoint. | If a balance or open reservation still exists, the runtime keeps honoring it anyway (see below) even though every surface is hidden — hiding is presentation, honoring is money. |
| on | off | Invalid. Capability resolution throws `CommerceCapabilityConfigurationError` on the first request or cron tick after a deploy in this state. | Never deploy this combination. Selling a card the runtime cannot redeem is a configuration bug, not a rollback strategy. |

**Honor off does not always mean honor off.** Turning honor off while a balance or open
reservation exists is ignored: redemption, settlement, and refunds keep running exactly as if
honor were on. The measurement counts committed reservations whose redemption ledger entry has not
landed yet, so an order that is mid-settlement when the flag flips keeps honoring rather than
stranding. This is measured once every five minutes by the recovery cron, never per request,
and the measurement is written to `admin_settings` under the key `gift_cards.honor_guard`. A
missing or stale record — older than 15 minutes, three missed cron ticks, `HONOR_GUARD_STALE_SECONDS`
= 900 seconds — is treated as "balances may exist," so the runtime never guesses that honoring is
safe to stop. Every cron tick this condition holds fires the critical telemetry event
`gift_card.honor_disabled_with_balances`; the admin gift-card page shows a banner naming the
outstanding total and open-reservation count for the same condition — that banner is the
operator-facing view of the same measurement the cron writes.

Both flags are deploy-time Worker variables, so changing one is a deploy. That is what keeps the
hour-long ISR window on the home page from ever serving a stale visibility decision: a new deploy
invalidates the incremental cache, so the first render after a flag change is a fresh one. There is
no path by which a flag flips without a deploy, and so none by which a cached page outlives the
decision it was rendered under.

**Rollback recipe:** set sell (`STORE_FEATURE_GIFT_CARD_ACQUISITION`) to `false` and deploy to stop
new sales. Leave honor (`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) on until every card balance is
zero and every reservation is released or refunded. Turning honor off while balances remain does
not make the liability disappear — the runtime keeps honoring, the cron keeps alarming, and the
admin banner keeps naming the total, every five minutes, until the balance is actually zero. See
`docs/DEPLOYMENT_SETUP.md` §9 for the exact commands.

The HMAC key ring is read from the request-scoped Workers environment only when a nonempty bearer
token is being resolved. Honor-only calls (redemption, settlement, release) do not require those
lookup keys.

`GIFT_CARD_CODE_HMAC_KEYS_JSON` is a JSON object whose canonical positive
integer property names are key versions, for example `{"1":"<32+ byte
secret>","2":"<32+ byte secret>"}`. The current version must be present,
and the ring is bounded to four keys. Store these values in local `.dev.vars`
or encrypted Cloudflare secrets. They are intentionally absent from
`StoreConfig`, browser configuration, committed deployment files, telemetry,
and errors.

`GIFT_CARD_DELIVERY_KEYS_JSON` is a JSON object whose canonical positive
integer property names are key versions. Unlike the HMAC ring, every value
carries the literal `base64:` prefix, and the remainder must decode to
exactly 32 bytes — the AES-256 key length exported as
`GIFT_CARD_DELIVERY_KEY_BYTES` from `lib/gift-cards/encryption.ts`. This ring
is versioned independently of the HMAC ring. The current version must be
present, and the ring is bounded to four keys. Store these values in local
`.dev.vars` or encrypted Cloudflare secrets, never in `wrangler.jsonc`. They
are intentionally absent from `StoreConfig`, browser configuration,
committed deployment files, telemetry, and errors. Unlike the HMAC ring, the
delivery ring is parsed on every scheduled delivery drain once reconciliation
is enabled — immediately after the pending-deliveries query and before any
row is processed, regardless of how many rows came back — so a malformed
value fails the recovery cron every five minutes rather than failing one
request when someone finally buys a card.

Core one-time checkout never interprets catalog products as subscription
acquisition. Products that also have subscription plans remain available for a
one-time purchase while acquisition is off. Only the dedicated subscription
route consults the acquisition flag and selected recurring plan.

## Gift-card code reveal

Unlike the sell/honor pair above, this is not a Worker variable. `gift_cards.code_reveal_enabled`
is a boolean `admin_settings` row in category `gift_cards`, flipped through the admin settings
screen like any other setting — changing it is not a deploy. It ships off.

The neighbouring `gift_cards.honor_guard` key lives in the same `gift_cards` settings category but
is still refused when submitted there: the five-minute recovery cron owns that key, and the admin
settings writer rejects it regardless of who asks.

Turning code reveal on lets a database super admin, in a browser session, reveal one gift card's
full bearer code after a confirm step. A service token cannot reveal a code, and neither can the
`x-dev-admin` development bypass — reveal checks `isSuperAdminActor`, not `checkAdminPermissions`
alone, so both of those normally-privileged paths are refused.

A reveal is not free: it writes a permanent `gift_card_events` row naming the admin who asked and
when, and that row is written *before* the code is returned — if the write fails, no code comes
back. Reveal does not change anything else. Codes stay absent from every list, every card detail
view, every other API response, and every log line, whether or not the setting is on.

Recommendation: leave code reveal off. Turn it on only for the duration of a specific
investigation, and turn it back off when the investigation is done.

## Search indexing and images

Robots defaults to `noindex`. Production must opt in with
`NEXT_PUBLIC_ROBOTS_INDEX=true`; previews remain safe even though Workers sets
`NODE_ENV=production` during a production-mode build.

When `NEXT_PUBLIC_IMAGE_CDN` is absent, store-object images use the same-origin
`/media/` route. Set `NEXT_PUBLIC_IMAGE_TRANSFORMS=false` to bypass Cloudflare
Image Transformations and serve raw CDN objects during an outage.
