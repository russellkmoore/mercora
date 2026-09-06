# Documentation Index

One-line purpose: get a reader to the right document quickly.

**Status:** Living index — regenerated in phase 08.2 over the document set that survived plans 01
through 03.

## Setup

- [AGENTS.md](../AGENTS.md) - Prerequisites, ordered setup commands, and the CI gate list for a coding assistant or contributor.
- [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md) - The setup-and-deploy runbook: Cloudflare, Clerk and Stripe accounts through going live.
- [README.md](../README.md) - Project overview, quick start, and the preset and layout showcase.
- [runtime-configuration.md](runtime-configuration.md) - The env-var contract for overriding public, non-secret storefront defaults.
- [theming.md](theming.md) - The frozen token contract, preset switching, and the three layout switches.

## Architecture

- [ai-pipeline.md](ai-pipeline.md) - Volt's AI request flow: embeddings, vector search, and response generation.
- [architecture.md](architecture.md) - System diagrams for request flow, the AI pipeline, and deployment.
- [content-publishing.md](content-publishing.md) - Store-neutral CMS pages and blog publishing.
- [mcp-server-specification.md](mcp-server-specification.md) - The authenticated MCP HTTP API an external agent uses to shop.
- [observability.md](observability.md) - The versioned, bounded telemetry envelope for commerce failures.

## Operations

- [admin-authentication.md](admin-authentication.md) - The multi-layered authentication and role-based access control protecting admin routes.
- [customer-communications.md](customer-communications.md) - Authenticated account navigation, order history, and profile settings.
- [dependency-security.md](dependency-security.md) - The production dependency audit baseline and its owned exceptions.
- [mobile-lighthouse-baseline.md](mobile-lighthouse-baseline.md) - Measured Lighthouse scores against the PRD's mobile performance target.
- [shopify-migration.md](shopify-migration.md) - The operator-only Shopify import toolkit, defaulting to a dry run.

## Reference

The checkout, webhook, migrations and subscriptions documents below are ADRs: all four carry a
dated Accepted status and are locked in `gsd-ingest-manifest.yaml`.

- [CHANGELOG-docs.md](CHANGELOG-docs.md) - The running log of documentation retirements and merges.
- [checkout-trust-boundary.md](checkout-trust-boundary.md) - ADR: server-owned pricing, pending orders, and verified finalization.
- [CLAUDE.md](CLAUDE.md) - AI-assistant context not already owned by AGENTS.md or another doc.
- [database-migrations.md](database-migrations.md) - ADR: remote D1 migrations are an explicit operator action, never automatic.
- [subscriptions.md](subscriptions.md) - ADR: optional, disabled-by-default subscription acquisition.
- [webhooks-refunds-inventory.md](webhooks-refunds-inventory.md) - ADR: Stripe webhooks, order state, and inventory as durable transitions.
