## Conflict Detection Report

Operation: ingest (mode: new). Sources: 26 classified docs under docs/.
Precedence applied: ADR > SPEC > PRD > DOC; no per-doc overrides present.
Locked sources: docs/database-migrations.md only. No LOCKED-vs-LOCKED pairs exist.
No UNKNOWN classifications. No PRD acceptance-criteria collisions. Cross-ref graph is acyclic (see I1).

### BLOCKERS (0)

(none)

### WARNINGS (3)

[WARNING] W1 MCP checkout: inside or outside the paid inventory boundary
  Found: docs/checkout-trust-boundary.md (ADR, proposed) states "This boundary does not expose trusted MCP payment operations or start fulfillment. MCP checkout remains outside the paid inventory boundary until it performs the same PaymentIntent verification."
  Found: docs/mcp-server-specification.md (SPEC) states create_payment_intent builds a bound PaymentIntent plus durable pending order through the shared checkout pricing service, and place_order "invok[es] the shared idempotent payment finalizer" which "runs the same durable inventory and post-payment effects as the storefront"
  Found: docs/o07-gift-cards-plan.md (PRD) wave 2 status: "MCP uses the same authoritative checkout path."
  Impact: Precedence says ADR wins, but the ADR sentence is conditional and two newer, lower-precedence sources say the condition is now met. Auto-resolving in the ADR's favor would make the roadmapper plan work that may already exist; auto-resolving against it would silently override an ADR. Intel currently records both (ADR-CTB-15 and MCP-06) with cross-notes.
  → Confirm whether MCP place_order now shares the storefront finalizer. If yes, update docs/checkout-trust-boundary.md to remove the exclusion (or mark it superseded). If no, annotate docs/mcp-server-specification.md as target-state. Then re-run ingest.

[WARNING] W2 Admin dashboard specification scope vs "Complete" status
  Found: docs/admin-dashboard-specification.md (SPEC) defines module interfaces including MFA (enableMFA/verifyMFA), WebSocket/SSE real-time updates, React Query, Recharts + D3.js, FulfillmentAutomation (shipping labels, rules), customer segmentation and VIP tiers, PersonalizationAdmin, prompt-version rollback, custom drag-and-drop report builder, GDPR/CCPA export/deletion tools, and a four-phase 8-week roadmap
  Found: docs/ROADMAP.md (PRD) marks "Admin Dashboard (Complete)" with a narrower feature list; docs/CLAUDE.md (DOC) lists only /admin, /admin/products, /admin/categories, /admin/orders, /admin/settings and calls returns management a placeholder
  Impact: The SPEC has no status markers, so it is unclear whether its modules are a backlog or a historical design. The roadmapper cannot tell what admin work remains. Its persona/roadmap sections were not extracted as requirements because the doc is typed SPEC.
  → Decide whether docs/admin-dashboard-specification.md is target-state backlog or historical. If backlog, re-tag the relevant sections as PRD via --manifest (or split the doc) so its features become requirements; if historical, mark it superseded so the roadmapper ignores it.

[WARNING] W3 Admin authentication: enabled or bypassed
  Found: docs/CLAUDE.md (DOC) states "Authentication is temporarily DISABLED for development", lib/auth/admin-middleware.ts "returns { success: true, userId: 'dev-admin' }", and lib/auth/unified-auth.ts "bypasses all checks"; docs/DEPLOYMENT_SETUP.md (DOC) repeats "Authentication temporarily disabled for development"
  Found: docs/admin-authentication.md (DOC) states "The system now runs with full production authentication enabled" with Clerk role / ADMIN_USER_IDS checks and a dev bypass parameter; docs/README.md (DOC) and docs/ROADMAP.md (PRD) describe production-ready multi-layered auth
  Impact: Two DOC-tier sources contradict two other DOC-tier sources at equal precedence, so precedence cannot pick. The PRD claim ("production-ready") speaks to existence, not to whether the bypass is active. Any security-related planning depends on the answer.
  → Check lib/auth/admin-middleware.ts and lib/auth/unified-auth.ts for the bypass. Then fix whichever doc is stale (most likely docs/CLAUDE.md) and re-run ingest, or tell the roadmapper the verified state directly.

### INFO (18)

[INFO] I1 Cross-ref graph resolution and cycle check
  Note: 20 internal edges, max DFS depth 3, no cycles. docs/CLAUDE.md lists "README.md" in a repo-root-relative file list (alongside docs/architecture.md, lib/types/mach/, wrangler.jsonc), so it was resolved to the root README.md, which is outside the ingest set. Had it been resolved as docs/README.md, two DOC-only cycles would appear (CLAUDE.md <-> README.md; CLAUDE.md -> README.md -> admin-authentication.md -> CLAUDE.md). 26 refs point to files outside the set (SQL migrations, wrangler configs, source files, and a nonexistent docs/API_STRUCTURE.md referenced by CLAUDE.md and STRIPE_INTEGRATION.md).

[INFO] I2 Auto-resolved: LOCKED ADR > DOC on production migration command
  Note: docs/database-migrations.md (ADR, locked) requires MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production and states deploy never applies remote migrations. docs/CLAUDE.md and docs/DEPLOYMENT_SETUP.md (DOC) show npx wrangler d1 migrations apply mercora-db for production with no guard. Locked ADR wins; intel records ADR-DBM-01..05. The two DOCs should be corrected.

[INFO] I3 Auto-resolved: ADR > DOC on Stripe webhook event list
  Note: docs/webhooks-refunds-inventory.md (ADR) requires payment_intent.succeeded, charge.refunded, refund.updated, refund.failed (plus legacy charge.refund.updated). docs/DEPLOYMENT_SETUP.md and docs/STRIPE_INTEGRATION.md (DOC) additionally list payment_intent.payment_failed and checkout.session.completed, which no ADR/SPEC handler describes. ADR list recorded as ADR-WRI-02.

[INFO] I4 Auto-resolved: ADR/SPEC/PRD > DOC on test tooling
  Note: docs/CLAUDE.md (DOC) says "No formal testing framework currently configured." docs/webhooks-refunds-inventory.md (ADR) mandates npm test, npm run test:workers, typecheck, lint; docs/observability.md (SPEC) adds test:observability-worker; docs/o07-gift-cards-plan.md (PRD) reports 230 unit files / 27 Worker files passing. Higher tiers win; CLAUDE.md is stale.

[INFO] I5 Auto-resolved: ADR > DOC on Node version
  Note: docs/DEPLOYMENT_SETUP.md (DOC) lists "Node.js 18+". docs/webhooks-refunds-inventory.md (ADR) states "the project's Node 24 standard"; docs/shopify-migration.md and docs/dependency-security.md (DOC) also say Node 24 / 24.18.1. Node 24 recorded (ADR-WRI-14).

[INFO] I6 Auto-resolved: ADR > SPEC on "mock" Stripe note
  Note: docs/api-architecture.md (SPEC) order-processing diagram carries the note "Stripe integration (mock implementation)". docs/checkout-trust-boundary.md (ADR) and docs/STRIPE_INTEGRATION.md describe real PaymentIntent verification. ADR wins; the diagram note is treated as stale (API-06 annotated).

[INFO] I7 Auto-resolved: ADR/SPEC > DOC on data model
  Note: docs/architecture.md (DOC) ER diagram shows a PRODUCT_INVENTORY table with quantityInStock and ORDERS.totalAmount as decimal. docs/webhooks-refunds-inventory.md (ADR-WRI-07) makes product_variants.inventory JSON the authority and calls the MACH inventory table a compatibility surface; docs/mcp-server-specification.md (MCP-05) states persisted money is integer minor units. ADR/SPEC win; the ER diagram is recorded in context.md as historical.

[INFO] I8 Auto-resolved: SPEC > DOC on LLM identity (verify in code)
  Note: docs/api-architecture.md (SPEC) and docs/ai-pipeline.md, docs/architecture.md, docs/README.md, docs/DEPLOYMENT_SETUP.md, docs/ROADMAP.md name Llama 3.1 8B. docs/CLAUDE.md (DOC) names @cf/openai/gpt-oss-20b "centrally configured in /lib/ai/config.ts" while also naming Llama elsewhere in the same file. SPEC wins per precedence, but the CLAUDE.md line is the more specific and possibly newer claim; downstream should confirm against lib/ai/config.ts before writing the model name into PROJECT.md.

[INFO] I9 Auto-resolved: SPEC > PRD/DOC on MCP tool count
  Note: docs/mcp-server-specification.md (SPEC) enumerates 19 tools including create_payment_intent and rotate_agent_key. docs/ROADMAP.md (PRD) and docs/CLAUDE.md (DOC) say 17 tools and omit those two. SPEC list recorded (MCP-07).

[INFO] I10 Auto-resolved: PRD > DOC on MCP server status
  Note: docs/ROADMAP.md (PRD) marks the MCP server complete and live at /api/mcp. docs/README.md (DOC) says "MCP Server: Under development." PRD wins; README.md is stale.

[INFO] I11 Auto-resolved: PRD > DOC on button touch-target size
  Note: docs/mobile-improvements-actionable.md (PRD) sets default h-11 (44px), sm h-10 (40px), lg h-12 (48px), icon size-11 (44px). docs/mobile-ux-assessment.md (DOC) recommends "Increase button minimum height to 48px" and is internally inconsistent (summary says 44px+ implemented; button analysis says 36px). PRD values recorded in REQ-mobile-touch-targets.

[INFO] I12 Auto-resolved: PRD > DOC on mobile PageSpeed target
  Note: docs/mobile-improvements-actionable.md (PRD) sets Mobile PageSpeed > 85 (target 90+). docs/mobile-ux-assessment.md (DOC) and docs/mobile-testing-automation.md (DOC) use > 90 / >= 0.85 respectively. PRD wins; DOC targets kept in context.md.

[INFO] I13 Not a conflict: /media/ route scoping
  Note: docs/content-publishing.md (SPEC, migration 0019) says "A storefront /media/ proxy is not part of this feature." docs/runtime-configuration.md (SPEC) says images fall back to the same-origin /media/ route, and docs/shopify-migration.md (DOC) ships "/media/* object serving" with migration 0020. Read as feature scoping at different points in time, not a contradiction. Both recorded (CP-02, RC-09).

[INFO] I14 DOC-vs-DOC divergence with no precedence winner: dependency versions
  Note: docs/CLAUDE.md pins next 15.3.5, drizzle-orm ^0.35.2, @clerk/nextjs ^6.25.5, @opennextjs/cloudflare ^1.5.1. docs/dependency-security.md (dated 2026-08-11) reports next 15.5.22, drizzle-orm 0.45.2, @clerk/nextjs 6.39.6, @opennextjs/cloudflare 1.20.2, wrangler 4.118.0. Equal tier; not planning-relevant. package.json/package-lock.json are the authority. Both recorded in context.md.

[INFO] I15 Finding: literal credentials in documentation
  Note: docs/CLAUDE.md publishes a literal admin token value under "Live Environment > Admin Token" and a D1 database_id; docs/admin-authentication.md publishes a literal dev-bypass query value (?dev=...). These are recorded as data only. If the token value is real, treat it as exposed and rotate it; consider removing literal values from docs.

[INFO] I16 Extraction gaps by design (not fabricated)
  Note: (a) docs/admin-dashboard-specification.md (SPEC) contains user personas, a vision statement, a 4-phase roadmap, and success metrics; not extracted as requirements because the doc is typed SPEC (see W2). (b) docs/ROADMAP.md "Reviews & Ratings" carries a planned marker while every sub-item is marked complete; recorded as REQ-reviews-ratings with status ambiguous. (c) docs/ROADMAP.md "Advanced Security: rate limiting" overlaps with rate limiters already documented in docs/DEPLOYMENT_SETUP.md; recorded as-is with a note. (d) docs/ROADMAP.md success metrics have no numeric targets; acceptance marked absent throughout. (e) docs/mobile-improvements-actionable.md attaches success metrics at document level only; recorded as doc-level acceptance on each REQ-mobile-* entry.

[INFO] I17 Lock status of ADR-typed sources
  Note: Only docs/database-migrations.md is locked (manifest). docs/checkout-trust-boundary.md, docs/subscriptions.md, and docs/webhooks-refunds-inventory.md have no Status field, so their 40 decisions are recorded as proposed even though the prose is prescriptive (must/never/only). The checkout-trust-boundary classifier note suggests the manifest may intend it locked. If these should be binding, set locked in --manifest and re-run; downstream will otherwise treat them as overridable by user direction.

[INFO] I18 Untrusted-input scan
  Note: No embedded instructions, role overrides, or directives were found in any of the 26 sources. Hook-level low-confidence hits (emoji/unicode glyphs in diagram docs; a ?token= query pattern in setup docs) are documentation content and were treated as data.
