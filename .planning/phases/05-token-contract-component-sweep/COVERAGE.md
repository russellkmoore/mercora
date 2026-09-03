# Phase 5 — API Capability Coverage

**Detector result:** `api-coverage.cjs --json` over the phase scope returned
`{"detected": false, "signals": []}` (run 2026-09-03).

No external API integration: Phase 5 adds no new external service, SDK, endpoint, webhook, or
protocol surface. It restyles surfaces of SDKs the storefront already integrates.

The three third-party surfaces this phase touches are **styling inputs to already-integrated
SDKs**, not new capability integrations:

| Surface | What Phase 5 changes | Why this is not an integration |
|---|---|---|
| Stripe Elements (`@stripe/react-stripe-js`) | `appearance.variables` and `appearance.rules` hex values sourced from `getThemeTokens()` | The Elements integration, payment intents, and webhooks all shipped in v1. Only the colour literals in an existing options object change. No new Stripe API call, scope, or event. |
| Clerk (`@clerk/nextjs`, `@clerk/themes`) | adds `appearance.variables` alongside the existing `theme: dark` | Auth, session, and middleware integration shipped in v1. `appearance` is a client-side presentation prop. No new Clerk API, org feature, or webhook. |
| Sonner toaster | `toastOptions.className` becomes token classes | A local UI library rendering in the client bundle. No network surface at all. |
| Resend transactional email (`lib/email/sender.ts`) | hex literals inside the HTML body strings | The send path, templates, and unsubscribe handling shipped in v1. Only the inline style colours in the generated HTML change. |

Playwright is added as a devDependency for screenshot capture. It is build/CI tooling that
never enters the Worker bundle or the `build:worker` / `deploy` path, so it is not an
integrated capability either.

Nothing in this phase is a capability whose surface could be under-integrated, so a capability
coverage matrix would have no rows to fill.
