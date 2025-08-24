# Mercora - Claude AI Assistant Reference

This document provides essential context for Claude AI when working on the Mercora eCommerce platform.

## Project Overview

Mercora is an AI-powered outdoor gear eCommerce platform featuring **Volt**, an intelligent shopping assistant. Built on Cloudflare's edge infrastructure with MACH Alliance compliant architecture.

**Key Features:**
- AI shopping assistant with semantic search
- Real-time product recommendations
- Complete eCommerce platform with checkout
- User authentication via Clerk
- Order management and history
- Vector-based product search

## Tech Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with dark theme (`background: #000000`)
- **UI Components**: shadcn/ui + Radix UI primitives
- **Icons**: Lucide React + React Icons
- **State Management**: Zustand stores

### Backend & Infrastructure
- **Runtime**: Cloudflare Workers with OpenNext
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Storage**: Cloudflare R2 for images
- **AI**: Cloudflare AI (Llama 3.1 8B + BGE embeddings)
- **Vector DB**: Cloudflare Vectorize
- **Authentication**: Clerk

### Key Dependencies
```json
{
  "next": "15.3.5",
  "react": "^19.0.0",
  "drizzle-orm": "^0.35.2",
  "@clerk/nextjs": "^6.25.5",
  "@opennextjs/cloudflare": "^1.5.1",
  "zustand": "^5.0.6",
  "@stripe/stripe-js": "^7.8.0",
  "stripe": "^18.4.0"
}
```

## Build Commands

```bash
# Development
npm run dev                    # Start dev server with Turbo
npm run build                  # Build for production
npm start                      # Start production server
npm run lint                   # Run Next.js linter

# Deployment
npm run deploy                 # Clean, build, and deploy to Cloudflare
npm run clean                  # Remove build artifacts
npm run preview               # Build and preview locally

# Cloudflare
npm run cf-typegen            # Generate Cloudflare types
```

**Important**: Always run `npm run lint` after making changes to ensure code quality.

## Project Structure

```
mercora/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── agent-chat/       # AI chat endpoint
│   │   ├── products/         # Product API
│   │   ├── user-orders/      # Order history
│   │   └── vectorize-*/      # AI indexing endpoints
│   ├── category/[slug]/      # Category pages
│   ├── product/[slug]/       # Product pages
│   ├── checkout/             # Checkout flow
│   └── orders/               # Order history
├── components/               # React components
│   ├── agent/                # AI chat components
│   ├── cart/                 # Shopping cart
│   ├── checkout/             # Complete checkout flow + Stripe payments
│   └── ui/                   # shadcn/ui components
├── lib/                      # Core logic
│   ├── db/                   # Database & schema
│   ├── models/               # Data access layer
│   │   └── mach/             # MACH Alliance models
│   ├── stores/               # Zustand state
│   ├── types/                # TypeScript definitions
│   │   └── mach/             # MACH Alliance types
│   └── utils/                # Utility functions
├── data/                     # Content
│   ├── products_md/          # Product descriptions (vectorized)
│   └── knowledge_md/         # Support articles (vectorized)
└── docs/                     # Architecture documentation
```

## Database Schema (MACH Alliance Compliant)

Key tables:
- `products` - Product catalog with pricing and inventory
- `categories` - Product categorization
- `orders` - Order tracking and management
- `addresses` - MACH Alliance address specification
- `customers` - User profiles linked to Clerk

**Migration Commands:**
```bash
npx wrangler d1 migrations apply mercora-db --local  # Local
npx wrangler d1 migrations apply mercora-db          # Production
```

## API Architecture

### Key Endpoints
- `POST /api/agent-chat` - AI chat with context
- `GET /api/products` - Product listing with filters
- `GET /api/orders` - Unified order management (list/create/update)
- `POST /api/vectorize-products` - Index products for AI
- `POST /api/payment-intent` - Create Stripe payment intents
- `POST /api/webhooks/stripe` - Handle Stripe webhook events
- `POST /api/tax` - Calculate tax with Stripe Tax
- `POST /api/validate-discount` - Validate discount codes

### Authentication
All user-specific endpoints use Clerk middleware. User context is available via `auth()` helper.

## AI System (Volt Assistant)

### Architecture
```
User Query → BGE Embeddings → Vector Search → Context → Llama 3.1 → Response + Products
```

### Key Components
- **Vector Database**: 30 products + 8 knowledge articles indexed
- **Embedding Model**: `@cf/baai/bge-base-en-v1.5` (768 dimensions)
- **Language Model**: `@cf/meta/llama-3.1-8b-instruct`
- **Personality**: Cheeky, knowledgeable outdoor gear expert

### Personalization Features
- User context integration via `useEnhancedUserContext`
- Purchase history awareness
- VIP customer detection
- Personalized product recommendations

## State Management

### Zustand Stores
- `cart-store.ts` - Shopping cart state
- `chat-store.ts` - AI chat state
- `server-chat-store.ts` - Server-side chat context

### Key Hooks
- `useEnhancedUserContext` - Comprehensive user data
- `useCartPersistence` - Cart persistence across sessions

## Development Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **Components**: Function components with TypeScript
- **Styling**: Tailwind classes, dark theme by default
- **File naming**: kebab-case for files, PascalCase for components

### Key Patterns
- Server/Client component separation
- Zustand for client state
- Drizzle for database queries
- MACH Alliance data models for commerce entities

### Environment Variables
```env
# Development (.env.local)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Production (Cloudflare bindings)
# DB, MEDIA, AI, VECTORIZE handled via wrangler.jsonc
```

## Testing

**Status**: No formal testing framework currently configured.
**Recommendation**: Consider adding Vitest or Jest for unit tests, Playwright for E2E.

## Deployment

### Cloudflare Configuration (wrangler.jsonc)
```json
{
  "d1_databases": [{"binding": "DB", "database_id": "c1ea0c17-14ae-48cc-ade8-4433e9130594"}],
  "r2_buckets": [{"binding": "MEDIA", "bucket_name": "voltique-images"}],
  "vectorize": [{"binding": "VECTORIZE", "index_name": "voltique-index"}],
  "ai": {"binding": "AI"}
}
```

### Deployment Process
1. `npm run clean` - Remove old builds
2. `npm run deploy` - Build and deploy to Cloudflare
3. Monitor via Cloudflare dashboard

## Common Tasks

### Adding New Products
1. Create markdown file in `data/products_md/`
2. Run `POST /api/vectorize-products` to index
3. Products automatically appear in catalog and AI context

### Modifying AI Behavior
- Edit system prompt in `app/api/agent-chat/route.ts`
- Adjust vector search parameters (topK, relevance threshold)
- Update personality traits in prompt

### Database Changes
1. Modify schema in `lib/db/schema/`
2. Generate migration with Drizzle
3. Apply with `wrangler d1 migrations apply`

## Performance Notes

- **Edge deployment**: Sub-100ms response times globally
- **Vector search**: ~50ms semantic queries
- **AI generation**: ~2-3s for contextual responses
- **Image optimization**: Automatic WebP conversion via R2

## Recent Fixes & Issues Resolved

### ✅ **Product Variant Loading Issues (Aug 23, 2025)**
**Problem**: Products from `getProductsByCategory` and `getProductBySlug` were showing $0 prices and "out of stock" status.

**Root Cause**: 
- Functions weren't loading variants properly
- Seed data had inconsistent JSON formats (strings instead of proper JSON objects)
- Parsing logic couldn't handle legacy data formats

**Solution**:
1. **Fixed `getProductsByCategory`**: Added variant loading with robust parsing helpers
2. **Fixed `getProductBySlug`**: Applied same parsing logic for consistency  
3. **Enhanced parsing logic**: Handles both proper JSON and legacy string formats
4. **Backward compatibility**: Works with mixed data formats during migration

**Key Files Modified**:
- `lib/models/mach/products.ts` - Added robust variant parsing
- `lib/db/seed.sql` - Partially fixed JSON formatting

### ✅ **CartDrawer Functionality Issues (Aug 23, 2025)**
**Problem**: Users could add items to cart but couldn't change quantities or remove items.

**Root Cause**: Identifier mismatch between components and store
- Cart store functions expect `variantId` as unique identifier
- CartItemCard was using `item.productId` instead of `item.variantId`
- CartDrawer was using wrong key for React reconciliation

**Solution**:
- **Updated CartItemCard.tsx**: Changed all cart operations to use `variantId`
- **Updated CartDrawer.tsx**: Fixed React key to use `variantId`
- **Preserved data integrity**: `productId` still used for product references

**Key Files Modified**:
- `components/cart/CartItemCard.tsx` - Fixed quantity controls and remove button
- `components/cart/CartDrawer.tsx` - Fixed React keys

### ✅ **Component Cleanup (Aug 23, 2025)**
**Problem**: Duplicate components with inconsistent naming patterns.

**Solution**:
- **Refactored ProductsWithSorting → CategoryDisplay**: Maintained naming consistency with ProductDisplay
- **Enhanced CategoryDisplay**: Ported working variant-based pricing logic
- **Removed redundant files**: Cleaned up ProductsWithSorting.tsx
- **Updated references**: Fixed imports in category page

**Key Files Modified**:
- `app/category/[slug]/CategoryDisplay.tsx` - Enhanced with proper variant logic
- `app/category/[slug]/page.tsx` - Updated to use CategoryDisplay
- Removed: `app/category/[slug]/ProductsWithSorting.tsx`

## Current Git Status

**Branch**: `feature/mach-alliance-implementation`  
**Status**: Clean working directory
**Recent work**: Product variant loading and cart functionality fixes

## Important Files to Reference

- `README.md` - Complete project documentation
- `docs/architecture.md` - System architecture diagrams
- `docs/ai-pipeline.md` - AI implementation details
- `docs/STRIPE_INTEGRATION.md` - Stripe payment setup guide
- `docs/API_STRUCTURE.md` - **NEW**: Clean API architecture (eliminates redundancy)
- `lib/types/mach/` - MACH Alliance type definitions
- `lib/stripe.ts` - Stripe configuration and utilities
- `wrangler.jsonc` - Cloudflare configuration

## Troubleshooting

### Common Issues
1. **Build failures**: Check TypeScript errors with `npm run lint`
2. **Cloudflare binding errors**: Verify wrangler.jsonc configuration
3. **AI responses**: Check vector index status and prompt formatting
4. **Authentication**: Ensure Clerk keys are properly configured

### Debug Commands
```bash
npx wrangler d1 execute mercora-db --command "SELECT * FROM products LIMIT 5"
npx wrangler tail  # View live logs
```

---

**Last Updated**: Auto-generated for Claude AI context
**Live Demo**: https://voltique.russellkmoore.me