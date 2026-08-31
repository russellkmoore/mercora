# Technology Stack

**Analysis Date:** 2026-08-31

## Languages

**Primary:**
- TypeScript 6.0.3 - Core application language for type-safe development across frontend and backend
- JavaScript (Node.js) - Build scripts and utility tooling

**Secondary:**
- CSS - Styling with Tailwind CSS
- SQL - D1 SQLite queries via Drizzle ORM

## Runtime

**Environment:**
- Node.js 24.18.1 (required engine: >=24.18.1 <25)
- Cloudflare Workers (via OpenNext adapter for deployment)

**Package Manager:**
- npm (with package-lock.json)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.3.1 - Full-stack React framework with App Router
- React 19.0.0 - UI component library

**UI & Components:**
- Radix UI (multiple components) - Unstyled, accessible component primitives
  - Alert Dialog, Checkbox, Dialog, Dropdown Menu, Label, Navigation Menu, Select, Separator, Slot, Switch, Toggle, Toggle Group, Visually Hidden
- shadcn/ui 0.0.4 - Component library built on Radix UI
- Lucide React 1.31.0 - Icon library
- React Icons 5.7.0 - Icon library

**Styling:**
- Tailwind CSS 4.3.3 - Utility-first CSS framework
- @tailwindcss/postcss 4.3.3 - Tailwind CSS PostCSS plugin
- @tailwindcss/typography 0.5.20 - Typography plugin for prose styling
- Tailwind Merge 3.6.0 - Utility for merging Tailwind CSS classes
- clsx 2.1.1 - Utility for conditional CSS class names

**Build/Dev:**
- Turbopack - Fast bundler for development (`next dev --turbopack`)
- Webpack - Used for production build (`next build --webpack`)
- OpenNext (@opennextjs/cloudflare) 1.20.2 - Cloudflare Workers adapter for Next.js
- Wrangler 4.120.0 - Cloudflare Workers CLI
- PostCSS 8.5.26 - CSS processing framework
- Autoprefixer 10.5.4 - CSS vendor prefix tool

**Testing:**
- Vitest 4.1.10 - Unit test framework (Node environment)
  - Config: `vitest.config.mts`, `vitest.workers.config.mts`, `vitest.observability.config.mts`
  - @cloudflare/vitest-pool-workers 0.21.3 - Vitest pool for Cloudflare Workers tests

**Type Checking:**
- TypeScript 6.0.3 (`tsc --noEmit`)
- Wrangler type generation (`cf-typegen` script)

**Linting:**
- ESLint 9.36.0 - JavaScript linter
- eslint-config-next 16.3.1 - Next.js ESLint config with React Compiler rules

## Key Dependencies

**Critical:**
- drizzle-orm 0.45.2 - SQL ORM for type-safe database operations (supports D1)
- drizzle-kit 0.31.10 - Schema management and migration tool for Drizzle

**Payments & Subscriptions:**
- stripe 22.5.0 - Stripe API server library
- @stripe/stripe-js 9.13.0 - Stripe client library for browsers
- @stripe/react-stripe-js 6.8.1 - React components for Stripe.js

**Authentication:**
- @clerk/nextjs 7.7.6 - Clerk authentication provider for Next.js
- @clerk/themes 2.4.57 - Clerk theme system

**Email:**
- resend 6.20.0 - Email API client (alternative to Cloudflare Email Service)
- @react-email/components 1.0.12 - React email component library
- @react-email/render 2.1.0 - Email rendering engine

**Data Handling:**
- big.js 7.0.1 - Arbitrary-precision arithmetic (used for money/pricing calculations)
- isomorphic-dompurify 3.22.0 - XSS protection (works in Node and browser)
- sanitize-html 2.17.7 - HTML sanitization
- marked 18.0.9 - Markdown parser

**UI/UX:**
- sonner 2.0.8 - Toast notification library
- class-variance-authority 0.7.1 - Component variant system

**Utilities:**
- zustand 5.0.15 - Lightweight state management
- web-vitals 6.1.1 - Core Web Vitals metrics
- tldts 7.4.10 - Top-level domain parsing
- server-only 0.0.1 - Ensure server-only code import safety

**Development & Scripting:**
- tsx 4.23.12 - TypeScript executor for scripts
- @types/* - TypeScript type definitions for Node, React, Sanitize HTML, Big.js
- @cloudflare/workers-types 5.20260809.1 - Cloudflare Workers API types
- @smithy/node-http-handler 4.9.13 - AWS SDK HTTP handler
- @aws-sdk/client-s3 3.984.0 - AWS S3 client (used for R2 operations)
- csv-parse 6.1.0 - CSV parsing library
- tw-animate-css 1.3.5 - Tailwind animation utilities

## Configuration

**Build & Environment:**
- `wrangler.jsonc` - Cloudflare Workers configuration with bindings, environment variables, and cron triggers
- `next.config.ts` - Next.js configuration (custom image loader, security headers, caching)
- `open-next.config.ts` - OpenNext configuration (R2 incremental cache)
- `tsconfig.json` - TypeScript compiler options (target: ES2017, jsx: react-jsx, path alias: @/*)
- `tailwind.config.ts` - Tailwind CSS configuration with custom color system and typography plugin
- `eslint.config.mjs` - ESLint configuration (ESM format, Next 16 compatible)
- `cloudflare-env.d.ts` - Auto-generated Cloudflare runtime bindings types

**Runtime Compatibility:**
- Cloudflare compatibility_date: 2026-08-01
- Compatibility flags: nodejs_compat, nodejs_compat_populate_process_env, global_fetch_strictly_public

**Environment Variables (Public):**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk test key (pk_test_*)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe test key (pk_test_*)
- `NEXT_PUBLIC_IMAGE_CDN` - Image CDN URL for R2 bucket

**Environment Variables (Server-Side Secrets):**
- `STRIPE_SECRET_KEY` - Stripe API secret
- `CLERK_SECRET_KEY` - Clerk authentication secret
- `RESEND_API_KEY` - Resend email API key (conditional, only if EMAIL_PROVIDER=resend)
- `EMAIL_PROVIDER` - Set to "cloudflare" or "resend" to select email service
- `EMAIL_UNSUBSCRIBE_SECRET_CURRENT` - Current email unsubscribe token secret
- `EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS` - Previous email unsubscribe token secret (rotation)
- `EMAIL_UNSUBSCRIBE_TTL_SECONDS` - Token expiration time

## Platform Requirements

**Development:**
- Node.js 24.18.1+ (via .nvmrc)
- npm package manager
- Cloudflare account with:
  - D1 database (mercora-db)
  - R2 bucket (voltique-images) for image storage
  - Vectorize index (voltique-index) for embeddings and search
  - Workers AI access for embeddings and inference
  - Email Service configured
  - Rate Limiting API namespace configured

**Production:**
- Cloudflare Workers platform (deployed via OpenNext adapter)
- Stripe account with API keys
- Clerk account with API keys
- Email service (Cloudflare Email Service or Resend account)
- Custom domain (CDN: https://voltique-images.russellkmoore.me)

**Build Scripts:**
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production with Webpack
- `npm run build:worker` - Build Worker with public env vars
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run deploy:ci` - CI deployment with database migrations
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run Vitest unit tests
- `npm run test:workers` - Run Workers-specific tests
- `npm run test:observability-worker` - Run observability tests
- `npm run test:watch` - Watch mode for tests

---

*Stack analysis: 2026-08-31*
