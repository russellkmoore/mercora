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

## Deferred privacy operations

Account deletion and personal-data export are explicitly deferred. This slice
does not expose placeholder actions or silently archive/delete customer data.
They require a separate retention, authorization, and fulfillment design.
