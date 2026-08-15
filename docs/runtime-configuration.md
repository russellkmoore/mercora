# Runtime configuration

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
| Theme | `NEXT_PUBLIC_THEME_PRIMARY`, `NEXT_PUBLIC_STORE_LOGO_PATH` |
| Contact and legal links | `STORE_SUPPORT_EMAIL`, `STORE_SENDER_EMAIL`, `STORE_REPLY_TO_EMAIL`, `STORE_MERCHANT_NOTIFICATION_EMAIL`, `STORE_POSTAL_ADDRESS`, `STORE_SUPPORT_HOURS`, `NEXT_PUBLIC_PRIVACY_URL`, `NEXT_PUBLIC_TERMS_URL`, `NEXT_PUBLIC_RETURNS_URL` |
| Commerce formatting | `STORE_LOCALE` (canonical BCP 47 locale, defaults to `en-US`), `STORE_CURRENCY` (must match active catalog variant currency; Mercora checkout is single-currency per cart) |
| Optional subscription acquisition | `STORE_FEATURE_SUBSCRIPTION_ACQUISITION=true` (defaults off and requires installed subscription reconciliation) |
| Outbound email | `EMAIL_PROVIDER=cloudflare\|resend`; Cloudflare `EMAIL` binding (recommended) or encrypted `RESEND_API_KEY` |

`NEXT_PUBLIC_*` values are intentionally public. Store credentials (Stripe
secrets, Clerk secrets, Cloudflare API tokens) belong in `.dev.vars` locally or
Cloudflare secrets remotely, never in this file or `wrangler.jsonc`.

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

## Search indexing and images

Robots defaults to `noindex`. Production must opt in with
`NEXT_PUBLIC_ROBOTS_INDEX=true`; previews remain safe even though Workers sets
`NODE_ENV=production` during a production-mode build.

When `NEXT_PUBLIC_IMAGE_CDN` is absent, store-object images use the same-origin
`/media/` route. Set `NEXT_PUBLIC_IMAGE_TRANSFORMS=false` to bypass Cloudflare
Image Transformations and serve raw CDN objects during an outage.
