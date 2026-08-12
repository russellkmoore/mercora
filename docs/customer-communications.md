# Customer accounts and communications

Mercora provides authenticated account navigation, owner-scoped order history,
saved addresses, and basic profile settings without requiring an email provider.
The legacy `/orders` URL redirects to `/account/orders` and preserves query
parameters so existing review links remain compatible.

## Email delivery policy

Email configuration is runtime-owned. Set the sender, validated reply-to,
optional merchant notification recipient, public site URL, policy URLs, and a
real postal address through environment variables or encrypted bindings. Never
commit provider secrets or merchant values.

All email paths share one provider-neutral sender. Cloudflare Email Sending is
recommended for Workers: onboard the sender domain, configure an `EMAIL`
`send_email` binding, and set `EMAIL_PROVIDER=cloudflare`. Existing Resend
installations remain supported with `EMAIL_PROVIDER=resend` and an encrypted
`RESEND_API_KEY`. When `EMAIL_PROVIDER` is omitted, Mercora selects a provider
only if exactly one is configured; both or neither fail clearly. A failed send
never falls through to the other provider because that could duplicate mail
during durable retries.

Stable delivery keys are recorded in D1 for provider-neutral retry protection.
Cloudflare sends with a stable key therefore require both `EMAIL` and `DB`.
Run migration `0018_add_email_preferences.sql` before enabling the sender.

Transactional messages are order confirmation, shipping confirmation, refund
confirmation, review-status activity, and the optional merchant fulfillment
notification. These remain deliverable after a review-reminder opt-out.
Review reminders are non-transactional and fail closed when preference storage
or unsubscribe-token configuration is unavailable.

Unsubscribe links use versioned HMAC tokens with a bounded lifetime. Mint with
`EMAIL_UNSUBSCRIBE_SECRET_CURRENT`. During rotation, retain the old value in
`EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS` only through the maximum configured token
lifetime, then remove it. `GET` only displays a confirmation and never writes;
rate-limited `POST` records the preference idempotently. Responses are
`Cache-Control: no-store`.

The merchant notification is its own paid-order effect, independent of the
customer confirmation. Without `STORE_MERCHANT_NOTIFICATION_EMAIL` it completes
as a successful no-op. When configured, it includes fulfillment details and a
deep link to the specific admin order; its failure cannot displace the customer
confirmation and is retried independently by the durable effect runner.

## Deferred privacy operations

Account deletion and personal-data export are explicitly deferred. This slice
does not expose placeholder actions or silently archive/delete customer data.
They require a separate retention, authorization, and fulfillment design.
