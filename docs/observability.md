# Privacy-safe commerce observability

Mercora emits a versioned, bounded telemetry envelope for actionable commerce
failures. Telemetry is always best effort: logging, Analytics Engine, Tail
processing, cooldown storage, and alert delivery may all fail without changing
payment, webhook, refund, inventory, fulfillment, email, or recommendation
behavior.

## Data contract

The exact machine marker is `commerce.telemetry.v1`. The producer accepts only
a closed event and severity taxonomy. Context is restricted to bounded enum,
count, attempt, HTTP status, duration, retryability, and closed route-template
fields. Dynamic route values are never accepted. Errors become a
low-cardinality error class only.

Never add headers, cookies, authorization values, payment details, customer or
order identifiers, email or postal addresses, raw exceptions, request or
response payloads, or URLs containing queries. The Tail Worker validates and
sanitizes the envelope a second time and ignores ordinary logs and uncaught
exception details.

Analytics Engine is optional. If `COMMERCE_ANALYTICS` is absent or throws, the
structured log remains available and the commerce operation continues.

## Tail Worker design

`workers/observability-tail` is a separate Tail Worker. It:

- scans a bounded number of trace items and log entries;
- accepts only an error-level log containing one exact JSON envelope argument;
- alerts only for the closed critical-event subset;
- deduplicates and caps alert work and email payload size;
- HTML-escapes alert content and includes both HTML and plain text;
- coordinates cooldowns through one SQLite `AlertCooldown` Durable Object per
  closed alert bucket, never a module global or one global object;
- reserves the cooldown atomically before delivery;
- shortens the reservation to a bounded failure backoff if delivery fails; and
- sends through a provider-neutral adapter: Cloudflare Email Sending is the
  recommended default, while Resend remains available for compatibility;
- selects a provider explicitly with `EMAIL_PROVIDER=cloudflare|resend`, or
  infers it only when exactly one provider is configured; and
- never falls back across providers after delivery starts, avoiding duplicates
  when the selected provider returns an ambiguous failure.

The Tail Worker keeps this small adapter inside its standalone package instead
of importing the application sender. It mirrors the same provider selection,
structured Cloudflare binding, and no-fallback rules without pulling Next.js or
application D1 delivery-claim dependencies into the Tail Worker bundle.

The Worker exposes no operator HTTP endpoint. Sender, single recipient, subject
prefix, environment label, operator identity, success cooldown, and failure
backoff are configuration. The generic committed values deliberately fail
runtime validation and cannot send mail.

## Consumer-first deployment order

Tail Workers require a paid Workers plan. A producer deployment fails if a
referenced Tail Worker service does not already exist, so order is load-bearing:

1. Choose an outbound provider. Cloudflare Email Sending is recommended: onboard
   a sender domain and verify the one alert destination in the target account.
   For Resend compatibility, configure `RESEND_API_KEY` as a Wrangler secret.
   Never put the key or any other secret in source control.
2. Copy `workers/observability-tail/wrangler.jsonc` into environment-owned
   deployment configuration. Replace every `configure-*` and
   `example.invalid` value. Keep both `destination_address` and
   `allowed_sender_addresses` restrictions on `ALERT_EMAIL` aligned with
   `ALERT_EMAIL_TO` and `ALERT_EMAIL_FROM` when Cloudflare is selected. For a
   Resend-only deployment, remove the `send_email` binding, set
   `EMAIL_PROVIDER` to `resend`, add the secret with `wrangler secret put`, and
   regenerate types. Omitting `EMAIL_PROVIDER` is permitted only when exactly
   one of the native binding or Resend secret exists; both or neither fail
   closed.
3. Generate and review binding types:

   ```sh
   npx wrangler types --include-runtime=false \
     --config workers/observability-tail/wrangler.jsonc \
     --env-interface ObservabilityTailEnv \
     workers/observability-tail/worker-configuration.d.ts
   ```

4. Deploy the Tail Worker first. This creates its SQLite Durable Object class
   through migration `v1`.
5. Only after that succeeds, copy the desired entries from
   `producer-bindings.example.jsonc` into each producer configuration, generate
   producer types, and deploy producers. The main repository config intentionally
   has no `tail_consumers` entry.
6. Analytics Engine remains independent and optional; omit that example binding
   if metrics are not wanted.

No deployment, Email Sending onboarding, destination verification, binding
creation, or message send is performed by the repository test/build workflow.

## Local validation and non-production canary

The normal gates are:

```sh
npm run lint
npm run typecheck
npm test
npm run test:workers
npm run test:observability-worker
npx wrangler types --check --include-runtime=false \
  --config workers/observability-tail/wrangler.jsonc \
  --env-interface ObservabilityTailEnv \
  workers/observability-tail/worker-configuration.d.ts
npx wrangler deploy --dry-run --config workers/observability-tail/wrangler.jsonc
```

Dry runs bundle locally and do not deploy. Unit tests use fake provider calls,
verify that provider failures never trigger cross-provider fallback, and Workers
tests exercise SQLite cooldown state without delivering mail.

Behavioral tests cover the material failure paths independently of the source
taxonomy contract:

- payment intent creation, order persistence, and provider cancellation;
- webhook claim, ownership, processing, failure-recording, and payment
  verification outcomes;
- post-payment effect and inventory failures after their retry threshold;
- inventory adjustments that require manual review;
- fulfillment transition, delivery, and delivery-audit failures;
- recommendation rebuild and scheduled recovery/analytics failures; and
- both outbound providers, including the rule that a selected provider failure
  never falls back to the other configured provider.

The AST-based source contract additionally ensures that executable telemetry
calls use the closed event taxonomy. It is a wiring guard, not a substitute for
the behavior tests above.

For a canary, use a non-production account and recipient controlled by the
operator. Deploy the configured Tail Worker first, then attach one non-production
producer. From a guarded non-production-only path, temporarily call:

```ts
recordTelemetry(
  "payment.intent_create_failed",
  {
    operation: "create",
    outcome: "failed",
    provider: "stripe",
    path: "/api/payment-intent",
  },
  new Error("canary"),
);
```

Confirm one alert, confirm another invocation is suppressed during the
cooldown, remove the canary, and inspect Workers Logs for only the bounded
envelope. Never use a customer request, real order, production payment, raw
exception, or production recipient for this check.
