# Synthesis Summary

Entry point for `gsd-roadmapper`. Produced by `gsd-doc-synthesizer` from
26 classification files in `.planning/intel/classifications/` (mode: new,
no existing PROJECT.md / ROADMAP.md / REQUIREMENTS.md / CONTEXT.md).

## Inputs consumed

| Type | Count | Sources |
| --- | ---: | --- |
| ADR | 4 | checkout-trust-boundary.md, database-migrations.md (locked), subscriptions.md, webhooks-refunds-inventory.md |
| SPEC | 6 | admin-dashboard-specification.md, api-architecture.md, content-publishing.md, mcp-server-specification.md, observability.md, runtime-configuration.md |
| PRD | 3 | mobile-improvements-actionable.md, o07-gift-cards-plan.md, ROADMAP.md |
| DOC | 13 | admin-authentication.md, ai-pipeline.md, architecture.md, CLAUDE.md, customer-communications.md, dependency-security.md, DEPLOYMENT_SETUP.md, migration-reservations.md, mobile-testing-automation.md, mobile-ux-assessment.md, README.md, shopify-migration.md, STRIPE_INTEGRATION.md |
| UNKNOWN | 0 | — |

All 26 classifications carry `manifest_override: true` and `confidence: high`.
All source paths are under `/Users/rmoore/Workspaces/mercora/docs/`.

Cross-ref graph: 20 internal edges, max depth 3, no cycles (see
INGEST-CONFLICTS.md I1 for the one path-resolution judgement made).

## Outputs

| File | Contents |
| --- | --- |
| `.planning/intel/decisions.md` | 45 decisions from 4 ADRs (CTB 16, DBM 5, SUB 10, WRI 14) |
| `.planning/intel/requirements.md` | 29 requirements from 3 PRDs (mobile 9, gift cards 8, roadmap 12) |
| `.planning/intel/constraints.md` | 52 constraints from 6 SPECs (ADS 16, API 7, CP 3, MCP 9, OBS 8, RC 9) |
| `.planning/intel/context.md` | 17 topic entries from 13 DOCs |
| `.planning/INGEST-CONFLICTS.md` | 0 blockers, 3 warnings, 18 info |

## Decisions

- Locked: 5 — all from `docs/database-migrations.md` (ADR-DBM-01..05): no
  migrations on deploy; local-only `db:prepare:local`; preview requires
  `preview_database_id`; production requires confirmation plus
  `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1`; additive expand/contract only.
- Proposed: 40 — the other three ADR sources lack a Status field, so the
  classifier left `locked: false` (INGEST-CONFLICTS.md I17). Their content is
  prescriptive and internally consistent with each other; treat as strong
  intent pending an explicit lock.
- One ADR statement (ADR-CTB-15, MCP checkout outside the paid boundary) is
  contradicted by a SPEC and a PRD and is held as WARNING W1 rather than
  auto-resolved.

## Requirements (IDs)

Mobile (PRD mobile-improvements-actionable.md): REQ-mobile-touch-targets,
REQ-mobile-cart-quantity-controls, REQ-mobile-menu-animation,
REQ-mobile-category-indentation, REQ-mobile-product-card-spacing,
REQ-web-vitals-tracking-hook (marked completed in source),
REQ-web-vitals-api-route, REQ-mobile-form-inputs, REQ-mobile-css.

Gift cards (PRD o07-gift-cards-plan.md; all waves reported Implemented,
external PR handoff pending as of 2026-08-21): REQ-gift-cards-invariants,
REQ-gift-cards-mixed-cart-pricing, REQ-gift-cards-tender-lifecycle,
REQ-gift-cards-issuance-delivery, REQ-gift-cards-refund-convergence,
REQ-gift-cards-presentation-surfaces, REQ-gift-cards-runtime-composition,
REQ-gift-cards-stack-handoff.

Roadmap planned items (PRD ROADMAP.md; no acceptance criteria in source):
REQ-pwa-features, REQ-touch-interactions, REQ-reviews-ratings (status
ambiguous), REQ-wishlist, REQ-social-features, REQ-visual-search,
REQ-predictive-analytics, REQ-multi-language, REQ-advanced-security,
REQ-email-marketing, REQ-advanced-analytics, REQ-performance-image-caching.

No competing acceptance variants were found.

## Constraints by type

| type | count |
| --- | ---: |
| api-contract | 25 |
| nfr | 13 |
| protocol | 9 |
| schema | 5 |

(ADS 16: nfr 3, api-contract 13. API 7: api-contract 3, protocol 3, nfr 1.
CP 3: api-contract 1, nfr 1, schema 1. MCP 9: api-contract 7, schema 1,
protocol 1. OBS 8: nfr 4, schema 1, protocol 3. RC 9: nfr 4, api-contract 1,
schema 2, protocol 2.)

## Context topics (17)

Platform overview and tech stack; project structure; admin authentication
(contested); admin dashboard (as documented in DOCs); AI pipeline; architecture
diagrams and documented schema; deployment runbook; Stripe integration guide;
customer accounts and email delivery; dependency security baseline; migration
number ledger; Shopify migration toolkit; mobile UX assessment; mobile testing
automation; documentation index and status claims; completed-feature inventory;
gift-card plan provenance.

## Conflicts

- Blockers: 0
- Warnings (need a user answer before routing): 3
  - W1 MCP checkout inside/outside the paid inventory boundary (ADR vs SPEC+PRD)
  - W2 Admin dashboard specification: backlog or historical? (SPEC vs PRD "Complete")
  - W3 Admin authentication enabled vs bypassed (DOC vs DOC; verify in code)
- Auto-resolved / informational: 18 (migration command, webhook events, test
  tooling, Node version, stale "mock Stripe" note, stale ER diagram, LLM
  identity, MCP tool count, MCP status, button size, PageSpeed target, /media/
  scoping, dependency versions, literal credentials in docs, extraction gaps,
  ADR lock status, injection scan, cross-ref resolution).

Detail: `/Users/rmoore/Workspaces/mercora/.planning/INGEST-CONFLICTS.md`

## Notes for the roadmapper

- The 2025-dated docs (CLAUDE.md, README.md, ROADMAP.md, architecture.md,
  ai-pipeline.md, api-architecture.md, DEPLOYMENT_SETUP.md, STRIPE_INTEGRATION.md,
  admin-*.md, mobile-*.md) describe an earlier state; the 2026-dated operational
  docs (ADRs, observability, runtime-configuration, content-publishing,
  customer-communications, dependency-security, shopify-migration,
  migration-reservations, o07 plan) are newer and more specific. Where they
  disagree, precedence already favored the newer set except in W1-W3.
- Much of the PRD content is already implemented per its own status markers
  (gift-card waves 1-7, web-vitals hook, reviews sub-items). Do not re-plan
  those without checking the status notes carried in requirements.md.
- Migration numbering: next free schema-bearing migration is `0023`
  (context.md, migration ledger).
