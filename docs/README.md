# Mercora Documentation Index

> **Complete documentation for the Mercora AI-powered eCommerce platform**

This directory contains comprehensive documentation for all aspects of the Mercora platform. Start here to find the information you need.

## 📚 Documentation Map

### 🚀 **Getting Started**
- **[Main README](../README.md)** - Project overview, features, and quick start
- **[Deployment Guide](DEPLOYMENT_SETUP.md)** - Complete production deployment instructions
- **[Development Roadmap](ROADMAP.md)** - Current status and future plans

### 🏗️ **Technical Architecture**
- **[System Architecture](architecture.md)** - Complete system design with Mermaid diagrams
- **[API Architecture](api-architecture.md)** - RESTful API specifications and flows
- **[Order and Checkout Trust Boundary](checkout-trust-boundary.md)** - Server-owned pricing, pending orders, and verified finalization
- **[AI Processing Pipeline](ai-pipeline.md)** - Deep dive into AI workflows and anti-hallucination
- **[Development Context](CLAUDE.md)** - Essential context for developers and AI assistants

### 💼 **Admin & Business Features**
- **[Admin Dashboard Specification](admin-dashboard-specification.md)** - Complete admin interface specification
- **[Admin Authentication](admin-authentication.md)** - Production-ready authentication and security
- **[Stripe Integration](STRIPE_INTEGRATION.md)** - Payment processing and tax calculation

### 🚀 **Innovation & Future**
- **[MCP Server Integration](mcp-server-specification.md)** - Revolutionary agentic commerce through developer tools

### 📜 **Binding decisions (ADRs)**
All four carry a dated Accepted status and are locked in `gsd-ingest-manifest.yaml`.
- **[Order and Checkout Trust Boundary](checkout-trust-boundary.md)** - Server-owned pricing, pending orders, and verified finalization (see Technical Architecture above)
- **[Webhooks, Refunds, and Inventory Operations](webhooks-refunds-inventory.md)** - Stripe, order state, and variant inventory as durable, retryable transitions
- **[Database Migrations](database-migrations.md)** - Remote D1 migrations are an explicit operator action, never part of `npm run deploy`
- **[Subscriptions](subscriptions.md)** - Optional, disabled-by-default subscription acquisition on an additive migration

### 🛠️ **Operations and runbooks**
- **[Dependency Security Baseline](dependency-security.md)** - Production dependency audit baseline, owned exceptions, and the CI audit gate
- **[Migration Reservations](migration-reservations.md)** - Assigns migration numbers from the current ledger so parallel branches don't reuse one
- **[Shopify Migration Toolkit](shopify-migration.md)** - Operator-only import of catalog, content, media, customers, and historical orders, defaulting to a dry run
- **[Runtime Configuration](runtime-configuration.md)** - Override public, non-secret storefront defaults from `lib/store-config.ts` without editing components

### 📐 **Specs and contracts**
- **[Commerce Observability](observability.md)** - A versioned, bounded, best-effort telemetry envelope for actionable commerce failures
- **[Content Publishing](content-publishing.md)** - Store-neutral CMS pages and Blog publishing, added without seeding merchant content
- **[Customer Accounts and Communications](customer-communications.md)** - Authenticated account navigation, order history, saved addresses, and profile settings
- **[Gift Cards](o07-gift-cards-plan.md)** - Generic stored-value gift cards with a security and ledger foundation, shipped and stacked on subscriptions

### 📈 **Assessments, baselines, and proposals**
- **[Mobile UX Assessment](mobile-ux-assessment.md)** - A September 2025 snapshot of the platform's mobile user experience
- **[Mobile Testing Automation Setup](mobile-testing-automation.md)** - A September 2025 proposal for automated mobile testing and performance monitoring
- **[Mobile UX Improvements - Actionable Guide](mobile-improvements-actionable.md)** - Implementation guide for touch targets, performance, and user flow
- **[Mobile Lighthouse Baseline](mobile-lighthouse-baseline.md)** - Lighthouse scores recorded for four routes against the PRD performance target

## 📋 **Quick Reference**

### **Current Platform Status**
- ✅ **Production Ready**: Complete eCommerce platform deployed and running
- ✅ **AI Assistant**: Volt AI with semantic search and personalization
- ✅ **Admin Dashboard**: Full management interface with AI analytics
- ✅ **CMS System**: Content management for pages and articles  
- ✅ **Authentication**: Multi-layered security with role-based access
- ✅ **MCP Server**: Live at `/api/mcp` with 19 tools for agentic commerce

### **Key Technologies**
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Cloudflare Workers, D1 Database, R2 Storage
- **AI**: Cloudflare AI (`@cf/openai/gpt-oss-20b` + BGE embeddings)
- **Auth**: Clerk with role-based admin access
- **Payments**: Stripe with Stripe Tax integration

### **Live Demo**
🌐 **[voltique.russellkmoore.me](https://voltique.russellkmoore.me)**

## 🔍 **Find What You Need**

### For Developers
- Start with [CLAUDE.md](CLAUDE.md) for development context
- Review [architecture.md](architecture.md) for system understanding
- Check [api-architecture.md](api-architecture.md) for API specifications

### For Business Users
- Review [admin-dashboard-specification.md](admin-dashboard-specification.md) for admin capabilities
- Check [ROADMAP.md](ROADMAP.md) for current status and future plans

### For DevOps/Deployment
- Follow [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md) for complete setup
- Review security sections in [admin-authentication.md](admin-authentication.md)

### For AI Integration
- Study [ai-pipeline.md](ai-pipeline.md) for AI implementation details
- Review [mcp-server-specification.md](mcp-server-specification.md) for the live MCP server's tools and architecture

## 📊 **Documentation Quality**

All documentation has been recently audited and updated to ensure:
- ✅ **Accuracy**: Information matches current implementation
- ✅ **Completeness**: All major features and capabilities documented
- ✅ **Consistency**: Unified terminology and structure
- ✅ **Timeliness**: Recent updates reflect latest developments
- ✅ **Accessibility**: Clear navigation and cross-references

## 🔄 **Documentation Updates**

**Last Updated**: September 2, 2026

**Recent Changes**:
- Updated all docs to reflect current production state
- Added CMS system and admin user management documentation
- Corrected authentication status (now production-ready)
- Updated API architecture with new admin endpoints
- Consolidated roadmap with completed features

---

💡 **Need help?** Start with the [Main README](../README.md) or jump to the specific documentation section you need above.
