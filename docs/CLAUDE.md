# Mercora — AI Assistant Context

**Purpose:** Architectural, structural, and stylistic context for an AI assistant working in this
repository. It does not cover setup.
**Status:** Active

Setup, prerequisites, environment variables, and gates live in `AGENTS.md`; this file assumes
you've already read it.

## Project Overview

Mercora is a themeable commerce platform on Cloudflare's edge, fronted by **Volt**, an AI shopping
assistant, and an MCP server that exposes commerce operations to external AI agents. The default
storefront ships an outdoor-gear sample catalogue rendered through one of seven visual presets — see
`docs/theming.md` for the token contract that makes that possible.

**Key features:**
- AI shopping assistant (Volt) with semantic search and anti-hallucination validation
- Checkout via Stripe, behind one idempotent payment finalizer shared by the storefront and MCP
- Admin dashboard with AI-powered analytics
- MCP server: 19 tools for external AI agents (search, cart, checkout, orders, agent management)
- Reviews and ratings, gift cards, subscriptions, CMS pages and blog

## Tech Stack

### Frontend
- Next.js App Router, TypeScript
- Tailwind against a 23-token `--store-*` contract; presets in `themes/*.css` selected server-side
  by a `data-theme` attribute — see `docs/theming.md`
- shadcn/ui + Radix UI primitives, Lucide icons
- Zustand for client state

### Backend & Infrastructure
- Cloudflare Workers via OpenNext; D1 (Drizzle ORM); R2; Vectorize; Workers AI
  (`@cf/openai/gpt-oss-20b` + BGE embeddings); Clerk

Dependency versions live in `package.json`.

## Build, environment, and deployment

The gate list, environment variables, and deploy procedure are documented once — in `AGENTS.md`,
`docs/runtime-configuration.md`, and `docs/DEPLOYMENT_SETUP.md`. This file does not restate them.

## Project Structure

```
mercora/
├── app/                      # Next.js App Router
│   ├── admin/                # Admin dashboard
│   │   ├── categories/       # Category management
│   │   ├── orders/           # Order management
│   │   ├── products/         # Product management
│   │   ├── settings/         # Admin settings
│   │   └── page.tsx          # Admin dashboard home with AI analytics
│   ├── api/                  # API Routes
│   │   ├── admin/            # Admin API endpoints
│   │   │   ├── analytics/    # AI-powered business analytics
│   │   │   └── vectorize/    # Consolidated AI indexing
│   │   ├── agent-chat/       # AI chat endpoint
│   │   ├── mcp/              # MCP (Model Context Protocol) Server
│   │   │   ├── schema/       # MCP server documentation
│   │   │   └── tools/        # MCP tool endpoints (cart, orders, shipping, etc.)
│   │   ├── orders/           # Order API with admin support
│   │   └── products/         # Product API
│   ├── category/[slug]/      # Category pages
│   ├── product/[slug]/       # Product pages
│   ├── checkout/             # Checkout flow
│   └── orders/               # Order history
├── components/               # React components
│   ├── admin/                # Admin dashboard components
│   │   ├── AdminSidebar.tsx  # Admin navigation
│   │   ├── AdminLayoutProvider.tsx  # Admin layout context
│   │   ├── ThemePresetGrid.tsx  # Theme selection grid (Appearance settings)
│   │   └── LayoutSwitches.tsx  # Layout switch radiogroups (Appearance settings)
│   ├── agent/                # AI chat components
│   ├── cart/                 # Shopping cart
│   ├── checkout/             # Complete checkout flow + Stripe payments
│   ├── layout/                # Layout variant components (category grid, home hero, product gallery)
│   └── ui/                   # shadcn/ui components
├── lib/                      # Core logic
│   ├── auth/                 # Authentication & authorization
│   │   ├── admin-middleware.ts  # Admin auth choke point (enforced)
│   │   └── unified-auth.ts   # Service token + Clerk session auth (enforced)
│   ├── db/                   # Database & schema
│   │   └── schema/           # Database schemas
│   │       └── mcp.ts        # MCP-specific tables (agents, sessions, rate limits)
│   ├── layout/               # Layout switch resolution
│   │   ├── settings.ts       # getLayoutSettings(): resolves the three layout switches
│   │   └── variants.ts       # The three enum arrays + defaults (source of truth)
│   ├── mcp/                  # MCP Server Implementation
│   │   ├── auth.ts           # Agent authentication system
│   │   ├── context.ts        # Agent context parsing
│   │   ├── error-handler.ts  # Comprehensive error handling
│   │   ├── session.ts        # Session management
│   │   ├── types.ts          # MCP type definitions
│   │   └── tools/            # MCP tool implementations
│   │       ├── agent.ts      # Agent management
│   │       ├── assess.ts     # Fulfillment assessment
│   │       ├── cart.ts       # Cart operations
│   │       ├── order.ts      # Order processing
│   │       ├── payment.ts    # Payment validation
│   │       ├── recommend.ts  # Recommendations
│   │       ├── search.ts     # Product search
│   │       └── shipping.ts   # Shipping calculations
│   ├── models/               # Data access layer
│   │   └── mach/             # MACH Alliance models
│   ├── stores/               # Zustand state
│   ├── themes/               # Theme resolution + manifest
│   │   ├── active-theme.ts   # getActiveTheme(): D1 -> env default -> manifest default
│   │   ├── tokens.ts         # getThemeTokens() — camelCase access for non-cascade consumers
│   │   └── manifest.generated.ts  # GENERATED — regenerated by scripts/build-themes.mjs
│   ├── types/                # TypeScript definitions
│   │   └── mach/             # MACH Alliance types
│   └── utils/                # Utility functions
├── data/                     # Content
│   ├── products_md/          # Product descriptions (vectorized)
│   └── knowledge_md/         # Support articles (vectorized)
├── docs/                     # Architecture documentation
├── themes/                   # Theme preset CSS files (23-token contract; docs/theming.md)
│   └── index.generated.css   # GENERATED — regenerated by scripts/build-themes.mjs
└── scripts/                  # Build-time validators and QA tooling
    ├── build-themes.mjs      # Theme validator + manifest/barrel codegen
    ├── scan-hardcoded-colors.mjs  # Token-contract scanner (npm run scan:tokens, CI-wired)
    └── screenshot-routes.mjs  # Multi-viewport screenshot QA harness
```

Theme resolution lives in `lib/themes/`; layout switch resolution lives in `lib/layout/`; the
named-variant components each switch renders live in `components/layout/`. See `docs/theming.md`
for the full mechanism.

## Admin Dashboard

**Routes:** `/admin` (AI analytics home), `/admin/products`, `/admin/categories`, `/admin/orders`,
`/admin/settings`, `/admin/gift-cards`, `/admin/promotions`, `/admin/reviews`, `/admin/blog`,
`/admin/knowledge`, `/admin/pages`, `/admin/subscription-plans`.

**Key components:** `AdminSidebar.tsx` (navigation), `AdminLayoutProvider.tsx` (layout context),
`ThemePresetGrid.tsx` and `LayoutSwitches.tsx` (Appearance settings).

**Admin API:** `/api/admin/analytics` (AI business insights), `/api/admin/vectorize` (consolidated
AI content indexing).

Admin authentication is enforced in production. See `docs/admin-authentication.md` for the full
mechanism, including the deployment safety guard.

## Authentication System

Two entry points enforce admin authentication: `checkAdminPermissions` in
`lib/auth/admin-middleware.ts` and `authenticateRequest` in `lib/auth/unified-auth.ts`.
Server-to-server calls authenticate with an `Authorization: Bearer` or `X-API-Key` header carrying
`<ADMIN_VECTORIZE_TOKEN>`. Interactive access requires a Clerk session where
`sessionClaims.metadata.role` is `admin`, or an active row in the `adminUsers` table (`isUserAdmin`
in `lib/models/admin.ts`). Mutating requests must also match the request's own origin. The only
bypass is the `x-dev-admin` header, honored only when `NODE_ENV` is `development`.

See `docs/admin-authentication.md` for the full mechanism, including the deployment safety guard.

## Database Schema

Schema modules live in `lib/db/schema/`; applied migrations live in `migrations/`. See
`docs/database-migrations.md` for the migration policy — expand-only, and never applied to a
remote database by the normal deploy.

## MCP Server

19 tools across discovery, cart, checkout, orders, and agent management, exposed at `/api/mcp`
(`GET` for capabilities and discovery, `POST` for tool execution, `GET /api/mcp/schema` for the
generated API documentation). See `docs/mcp-server-specification.md` for the full tool list,
discovery mechanism, and authentication model.

## AI System (Volt Assistant)

```
User Query → BGE Embeddings → Vector Search → Context → @cf/openai/gpt-oss-20b → Response + Products
```

- **Embedding model:** `@cf/baai/bge-base-en-v1.5` (768 dimensions)
- **Language model:** `@cf/openai/gpt-oss-20b`, centrally configured in `lib/ai/config.ts`
- **Personalization:** `useEnhancedUserContext` (purchase history, VIP detection, recommendations)

## State Management

**Zustand stores:** `cart-store.ts`, `chat-store.ts`, `server-chat-store.ts`.

**Key hooks:** `useEnhancedUserContext` (user data), `useCartPersistence` (cart persistence across
sessions).

## Development Guidelines

### Code Style
- TypeScript strict mode; function components with TypeScript
- Token-driven Tailwind classes against the `--store-*` contract, never a hardcoded palette; 4
  light presets (`luxe`, `clinical`, `atelier`, `market`), 3 dark (`volt-dark`, `midnight`, `retro`)
- kebab-case for files, PascalCase for components

### Key Patterns
- Server/Client component separation
- Zustand for client state, Drizzle for database queries
- MACH Alliance data models for commerce entities

## Testing

- **Unit tests:** `vitest.config.mts`, run with `npm test`
- **Workers integration tests:** `vitest.workers.config.mts`, run with `npm run test:workers`
- **Observability Durable Object tests:** `vitest.observability.config.mts`, run with
  `npm run test:observability-worker`

See `AGENTS.md` for the full gate order these run inside.

## Important Files to Reference

- `AGENTS.md` — setup, prerequisites, gates, rules, do-not-edit paths
- `docs/architecture.md` — system architecture
- `docs/DEPLOYMENT_SETUP.md` — setup and deploy runbook
- `docs/mcp-server-specification.md` — MCP server documentation and planning
- `docs/theming.md` — theme/token contract, duplication recipe, resolution order, layout switches
- `lib/types/mach/` — MACH Alliance type definitions
- `lib/mcp/` — MCP server implementation
- `lib/stripe.ts` — Stripe configuration and utilities
- `wrangler.jsonc` — Cloudflare configuration

## Troubleshooting

1. **Build failures** — check TypeScript errors with `npm run typecheck`
2. **Cloudflare binding errors** — verify `wrangler.jsonc` configuration
3. **AI responses** — check vector index status and prompt formatting in `lib/ai/config.ts`
4. **Authentication** — confirm Clerk keys are set in `.dev.vars`; see `docs/admin-authentication.md`

**Debug commands:**
```bash
npx wrangler d1 execute mercora-db --command "SELECT * FROM products LIMIT 5"
npx wrangler tail
```

---
**Last Updated:** 2026-09-05, Phase 8.2 (Documentation Overhaul & Agent Onboarding)
