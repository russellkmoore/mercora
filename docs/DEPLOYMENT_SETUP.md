# Mercora Production Deployment Guide

The complete setup-and-deploy runbook: Cloudflare, Clerk, and Stripe accounts, resource creation, environment configuration, migrations, build variables, and going live.

**Status:** Active — this is Mercora's single deployment runbook; the former Stripe setup guide is retired into it.

## Infrastructure Overview

Mercora runs on Cloudflare's edge infrastructure with integrated services:

- **Hosting**: Cloudflare Workers + Next.js 15 with App Router
- **Database**: Cloudflare D1 (distributed SQLite with Drizzle ORM)
- **Storage**: Cloudflare R2 Object Storage for images and content
- **AI Platform**: Cloudflare AI (`@cf/openai/gpt-oss-20b` + BGE embeddings)
- **Vector Database**: Cloudflare Vectorize (38-item index)
- **Authentication**: Clerk Authentication (with admin role support)
- **Payments**: Stripe with Stripe Tax for global tax calculation
- **Admin Dashboard**: Complete admin interface with AI analytics

## Prerequisites

### Required Service Accounts
1. **Cloudflare Account** - Workers paid plan required ($5/month minimum)
2. **Clerk Account** - Authentication service (free tier available)
3. **Stripe Account** - Payment processing with Stripe Tax enabled
4. **GitHub Account** - Repository hosting and optional CI/CD

### Local Development Environment
- **Node.js 24.18.1** (pinned in `.nvmrc` and `engines` in `package.json`) and npm/yarn/pnpm
- **Git** for version control
- **Wrangler CLI**: `npm install -g wrangler`
- **Terminal/Command Line** access

### Domain Requirements (Optional)
- **Custom Domain** for production deployment
- **DNS Management** access for custom domains

---

## 1. Cloudflare Setup

### **Step 1: Create Cloudflare Account**
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Upgrade to Workers paid plan ($5/month minimum)
3. Note your Account ID from the dashboard

### **Step 2: Create Cloudflare Resources**

#### **D1 Database**
```bash
# Create production database
npx wrangler d1 create mercora-db

# Note the database ID from output
# Example: your-d1-database-id-here
```

#### **R2 Bucket**
```bash
# Create storage bucket
npx wrangler r2 bucket create voltique-images

# Configure public access for images (optional)
npx wrangler r2 bucket notification create voltique-images \
  --event-type object-create \
  --prefix images/
```

#### **Vectorize Index**
```bash
# Create vector database for AI
npx wrangler vectorize create voltique-index \
  --dimensions=768 \
  --metric=cosine
```

#### **AI Binding**
AI binding is automatically available on Workers paid plans.

### **Step 3: Configure wrangler.jsonc**
Update your `wrangler.jsonc` with the created resource IDs:

```json
{
  "name": "mercora-production",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "mercora-db",
      "database_id": "your-d1-database-id-here"
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA",
      "bucket_name": "voltique-images"
    }
  ],
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "voltique-index"
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "ratelimits": [
    {
      "name": "AI_RATE_LIMITER",
      "namespace_id": "1001",
      "simple": { "limit": 20, "period": 60 }
    },
    {
      "name": "PUBLIC_RATE_LIMITER",
      "namespace_id": "1002",
      "simple": { "limit": 60, "period": 60 }
    }
  ],
  "vars": {
    "NODE_ENV": "production"
  }
}
```

`AI_RATE_LIMITER` allows 20 requests per 60 seconds in namespace `1001`.
`PUBLIC_RATE_LIMITER` allows 60 requests per 60 seconds in namespace `1002`.
Runtime checks fail open when a binding is unavailable or the rate-limit service
returns an error, so the request continues instead of being rejected.

---

## 2. Clerk Authentication Setup

### **Step 1: Create Clerk Application**
1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Choose authentication methods (email, Google, GitHub, etc.)
4. Configure branding and themes to match your design

### **Step 2: Get API Keys**
From your Clerk Dashboard:
1. Go to **API Keys**
2. Copy **Publishable key** (starts with `pk_test_`)
3. Copy **Secret key** (starts with `sk_test_`)

### **Step 3: Configure Environment Variables**

#### **Local Development (`.dev.vars`)**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

#### **Production (Cloudflare Secrets)**
```bash
# Add Clerk secret to Cloudflare
echo "sk_test_your_secret_key_here" | npx wrangler secret put CLERK_SECRET_KEY

# Add public key to wrangler.jsonc vars
```

Update `wrangler.jsonc` vars:
```json
{
  "vars": {
    "NODE_ENV": "production",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_your_publishable_key_here"
  }
}
```

These are the only two variables this runbook lists for Clerk. Every other
public or optional configuration value — store identity, images, email
provider, gift cards, subscriptions, and the rest — is documented once in
`docs/runtime-configuration.md`; this runbook does not duplicate that list.

### **Step 4: Configure Domains**
In Clerk Dashboard:
1. Go to **Domains**
2. Add your production domain (e.g., `voltique.russellkmoore.me`)
3. Configure redirect URLs for authentication

---

## 3. Stripe Payment & Tax Setup

### **Step 1: Create Stripe Account**
1. Sign up at [stripe.com](https://stripe.com)
2. Complete business verification
3. Enable **Stripe Tax** in the dashboard

### **Step 2: Configure Stripe Tax**
1. Go to **Products > Tax** in Stripe Dashboard
2. Enable tax calculation
3. Configure your business location
4. Set up tax registration for required states/regions

### **Step 3: Get API Keys**
From Stripe Dashboard > **Developers > API Keys**:
1. Copy **Publishable key** (starts with `pk_test_`)
2. Copy **Secret key** (starts with `sk_test_`)

### **Step 4: Configure Webhooks**
1. Go to **Developers > Webhooks**
2. Click **+ Add endpoint**
3. Set endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select the events. `docs/webhooks-refunds-inventory.md` is the binding
   source for the required event set and the reasoning behind it — select
   events from that document, not from memory or this runbook.
5. Copy the **Signing secret** (starts with `whsec_`)

### **Step 5: Configure Environment Variables**

#### **Local Development (`.dev.vars`)**
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

#### **Production (Cloudflare Secrets)**
```bash
# Add Stripe secrets to Cloudflare
echo "sk_test_your_secret_key_here" | npx wrangler secret put STRIPE_SECRET_KEY
echo "whsec_your_webhook_secret_here" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Update `wrangler.jsonc` vars:
```json
{
  "vars": {
    "NODE_ENV": "production",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_your_clerk_key",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_your_stripe_key"
  }
}
```

### **Step 6: Test Payments and Tax**
Use Stripe's published test values during development. These are documentation
values, not credentials.

**Test cards:**
- **Successful payment**: `4242424242424242`
- **Declined payment**: `4000000000000002`
- **3D Secure**: `4000002500003155`

**Test tax addresses** (US, for Stripe Tax):
- **California**: High tax rate (~10%)
- **Montana**: No state sales tax
- **New York**: Moderate tax rate (~8%)

---

## 4. Database Setup

### **Step 1: Run Migrations**
Mercora never applies remote migrations as part of a deploy — every remote
schema change is an explicit, gated operator action. See
`docs/database-migrations.md` for the binding policy.

```bash
# Local (development)
npx wrangler d1 migrations apply mercora-db --local

# Preview - check, then apply
npm run db:migrate:status:preview
npm run db:migrate:apply:preview

# Production - check, then apply behind the gate
npm run db:migrate:status:production
MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1 npm run db:migrate:apply:production
```
See `docs/database-migrations.md` for the binding migration policy.

### **Step 2: Seed Data (Optional)**
```bash
# Local: apply the full sample catalogue to a local D1 database
npx wrangler d1 execute mercora-db --local --file=data/d1/seed.sql
```

**Applying one catalogue addition to production.** `data/d1/seed.sql`'s
earlier bulk inserts are plain `INSERT` statements, not `INSERT OR IGNORE` —
a whole-file `--remote` apply stops at the first row that already exists in
production and never reaches a newer addition appended to the end of the
file. To add a single new catalogue block without touching anything already
live, slice out just that block and apply the slice:

```bash
# Slice the sentinel-delimited block out of the seed file
sed -n '/^-- BEGIN gift-card-block (Phase 9)$/,/^-- END gift-card-block (Phase 9)$/p' \
  data/d1/seed.sql > /tmp/gift-card-block.sql

# Apply only that slice to production
npx wrangler d1 execute mercora-db --remote --file=/tmp/gift-card-block.sql
```

Each catalogue addition since Phase 9 is wrapped in its own
`-- BEGIN <name> (Phase N)` / `-- END <name> (Phase N)` sentinel pair inside
`data/d1/seed.sql` for exactly this reason — find the boundary by its
sentinel comment, never by line number.

### **Step 3: Verify Database**
```bash
# Check tables were created
npx wrangler d1 execute mercora-db --command="SELECT name FROM sqlite_master WHERE type='table';"

# Check product count
npx wrangler d1 execute mercora-db --command="SELECT COUNT(*) FROM products;"
```

---

## 5. AI Content Indexing

### **Step 1: Content Preparation**
Ensure your content is properly organized:
- `data/r2/products_md/` - Product descriptions (30 files)
- `data/r2/knowledge_md/` - Support articles (8 files)
- Content should be uploaded to R2 bucket before indexing

### **Step 2: Deploy and Index Content**

**Deploy paths:** `npm run deploy` builds and uploads the Worker and never applies remote migrations.
`npm run deploy:ci` (used by Cloudflare Workers Builds) applies production migrations before upload.
Apply migrations yourself with the guarded `db:migrate:*` scripts; `docs/database-migrations.md` is the binding source.
```bash
# Deploy the application first
npm run deploy

# Index both products and knowledge articles (consolidated endpoint)
# The admin token is a Cloudflare Worker secret (ADMIN_VECTORIZE_TOKEN)
curl -X POST "https://yourdomain.com/api/admin/vectorize" \
  -H "Authorization: Bearer <ADMIN_VECTORIZE_TOKEN>"
```

A build deployed with a development `NODE_ENV` locks every admin route with HTTP 503 instead of
opening the development bypasses. See `docs/admin-authentication.md` for what trips this guard
and how to recover.

### **Step 3: Verify AI System**
1. Test the AI assistant via the chat interface
2. Verify semantic search is working with product queries
3. Check admin dashboard AI analytics section
4. Ensure 38 items are indexed (30 products + 8 knowledge articles)

### **Step 4: Admin Dashboard Verification**
1. Access admin dashboard at `/admin`
2. Check AI analytics section for indexing status
3. Verify vector search performance metrics
4. Test AI-powered business intelligence features

---

## 6. Deployment Process

### **Step 1: Final Configuration Check**
Verify all environment variables and secrets are configured:

```bash
# Check Cloudflare secrets
npx wrangler secret list

# Verify wrangler.jsonc configuration
cat wrangler.jsonc
```

### Step 1b: Workers Builds variables (Dashboard > Settings > Builds > Variables and secrets)

Two kinds of values matter at **build** time, and they are resolved differently:

| Variable | Where it must live | Why |
|---|---|---|
| `NEXT_PUBLIC_*` (e.g. `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_THEME_DEFAULT`, `NEXT_PUBLIC_IMAGE_CDN`) | `wrangler.jsonc` → `vars` (source of truth). Optionally also as a Dashboard Build variable. | Next.js inlines `NEXT_PUBLIC_*` when the bundle is built. `build:worker` runs `scripts/build-with-public-env.mjs`, which copies every `NEXT_PUBLIC_*` key from `wrangler.jsonc` into the build environment and **overrides** any Dashboard Build variable with the same name. A Dashboard value is only used if the key is absent from `wrangler.jsonc`, or if a build command bypasses `build:worker`. |
| `MERCORA_ALLOW_PRODUCTION_MIGRATIONS=1` | Dashboard Build variable only | `npm run deploy:ci` (the Workers Builds deploy command) applies production D1 migrations before upload and refuses without this gate (ADR-DBM-04). Never put it in `wrangler.jsonc`. |

Checklist when adding or changing a public value:

1. Set it in `wrangler.jsonc` `vars` (and the matching `env.*` block if you use environments).
2. If you also set it in the Dashboard, keep the two identical — the `wrangler.jsonc` copy wins.
3. Redeploy. Build-time values only change on the next build; a runtime var change alone does not re-inline them.

The theme fallback specifically: `NEXT_PUBLIC_THEME_DEFAULT` must be one of the names in
`lib/themes/manifest.generated.ts` (today: `atelier`, `clinical`, `luxe`, `market`, `midnight`,
`retro`, `volt-dark`). It is only step 2 of the resolution order in `docs/theming.md`; an admin
selection saved in D1 always wins over it.

### **Step 2: Build and Deploy**
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### **Step 3: Deploy Verification**
1. Check deployment logs for errors
2. Visit your deployed site
3. Test core functionality:
   - User registration/login
   - Product browsing and filtering
   - AI chat with Volt assistant
   - Shopping cart and checkout flow (with test cards)
4. Test admin dashboard:
   - Access admin dashboard at `/admin`
   - Verify product management interface
   - Test order management functionality
   - Check AI analytics dashboard
   - Ensure settings management works

---

## 7. Post-Deployment Configuration

### **Step 1: Update Webhook URLs**
Update webhook endpoints in third-party services to point to production:

#### **Stripe Webhooks**
1. Go to Stripe Dashboard > **Developers > Webhooks**
2. Update endpoint URL to: `https://yourdomain.com/api/webhooks/stripe`

#### **Clerk Webhooks (if any)**
Update Clerk webhook URLs to production domain.

### **Step 2: Configure Custom Domain (Optional)**
If using a custom domain:
1. Add domain to Cloudflare Workers
2. Configure DNS records
3. Update authentication redirect URLs

### **Step 3: Enable Analytics (Optional)**
Consider adding:
- Cloudflare Analytics
- Google Analytics
- Error tracking (Sentry)

---

## 8. Going Live (Production Keys)

When ready for real payments, switch to live Stripe keys:

### **Step 1: Get Live Stripe Keys**
From Stripe Dashboard (toggle to "Live" mode):
1. Copy live **Publishable key** (starts with `pk_live_`)
2. Copy live **Secret key** (starts with `sk_live_`)

### **Step 2: Update Production Secrets**
```bash
# Update to live Stripe keys
echo "sk_live_your_live_secret_key" | npx wrangler secret put STRIPE_SECRET_KEY
echo "whsec_your_live_webhook_secret" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

### **Step 3: Update Public Variables**
Update `wrangler.jsonc`:
```json
{
  "vars": {
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_your_live_publishable_key"
  }
}
```

### **Step 4: Redeploy**
```bash
npm run deploy
```

---

## 9. Gift Card Enablement

Gift cards ship disabled. Enabling them is four secrets and two feature flags applied in a
fixed order. `docs/runtime-configuration.md` owns the variable contract for both key rings.

### **Step 1: Generate and Store the Four Secrets**

Each value is generated and piped straight into Cloudflare in a single command, so it is
never printed, never held in a shell variable, and never written to a file.

```bash
# Code HMAC lookup ring
printf '1' | npx wrangler secret put GIFT_CARD_CODE_HMAC_CURRENT_VERSION
printf '{"1":"%s"}' "$(openssl rand -base64 32)" \
  | npx wrangler secret put GIFT_CARD_CODE_HMAC_KEYS_JSON

# Delivery encryption ring
printf '1' | npx wrangler secret put GIFT_CARD_DELIVERY_CURRENT_VERSION
printf '{"1":"base64:%s"}' "$(openssl rand -base64 32)" \
  | npx wrangler secret put GIFT_CARD_DELIVERY_KEYS_JSON
```

The HMAC ring uses the generated string's raw bytes directly as key material, so it takes no
prefix. The delivery ring is an AES-256 key, so it must carry the `base64:` prefix in front of
a payload that decodes to exactly 32 bytes.

Confirm only the names landed:

```bash
npx wrangler secret list
```

The proof is the four names — never a value.

If the command reports that the latest version of the Worker is not currently deployed,
deploy the current `main` first, then retry the four commands above.

### **Step 2: Enable Reconciliation**

Add one entry to `wrangler.jsonc` `vars`, next to the subscription flags:

```jsonc
"STORE_FEATURE_GIFT_CARD_RECONCILIATION": "true",
```

Regenerate the generated Cloudflare types and confirm they match:

```bash
npm run cf-typegen
npm run cf-typecheck
```

One non-obvious requirement: `wrangler types` reads local env files, including `.dev.vars`
and `.env.local`. Move both out of the working tree before either command runs, and move them
back afterward — otherwise the generated file picks up local-only names that CI does not have.

Commit `wrangler.jsonc` and the regenerated types together and push to `main`. Cloudflare
Workers Builds deploys the push.

### **Step 3: Verify Reconciliation**

Do not proceed to Step 4 until all three checks pass.

1. The new version appears in `npx wrangler deployments list`.
2. One five-minute recovery cron cycle completes cleanly: watch the Worker's tail and expect
   the recovery-drain success log, with no `cron.recovery_failed` telemetry event in the same
   window. This is the sharp check — the delivery ring is parsed immediately after the
   pending-deliveries query and before any row is processed, regardless of how many rows came
   back, so a malformed ring still fails the cycle even with zero deliveries queued.
3. The public balance endpoint (`POST /api/gift-cards/balance`) answers a made-up code with
   `{"valid": false}` and HTTP 200. It answers identically for a bad code, an unknown card, and a
   broken ring, by design — it proves availability and nothing about ring health; check #2
   above is what catches a malformed ring.

### **Step 4: Enable Acquisition**

Only after Step 3 passes. Same entry shape, same regenerate-commit-push cycle:

```jsonc
"STORE_FEATURE_GIFT_CARD_ACQUISITION": "true",
```

The order is not advisory: acquisition enabled without reconciliation throws at capability
resolution, on the first request or cron tick after such a deploy.

### **Step 5: Rolling Back**

Set acquisition back to `"false"` and push, to stop new gift-card sales. Leave reconciliation
enabled for as long as any balance or reservation exists, so existing cards can still be
verified, settled, and released.

To rotate a ring, add a second version to the JSON object and move the current-version
pointer. Never remove a key version that has issued cards under it.

---

**Your Mercora platform is now ready for production.**
