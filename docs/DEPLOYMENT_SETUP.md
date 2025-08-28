# Complete Deployment Setup Guide

This guide covers the complete setup process for deploying Mercora to production, including all third-party services, infrastructure configuration, and security considerations.

## 🏗️ Infrastructure Overview

Mercora runs on Cloudflare's edge infrastructure with integrated third-party services:

- **Hosting**: Cloudflare Workers + Next.js
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 Object Storage
- **AI**: Cloudflare AI (Llama 3.1 + BGE embeddings)
- **Vector DB**: Cloudflare Vectorize
- **Authentication**: Clerk
- **Payments**: Stripe (with Stripe Tax)

## 📋 Prerequisites

### Required Accounts
1. **Cloudflare Account** (Workers paid plan required)
2. **Clerk Account** (for authentication)
3. **Stripe Account** (for payments and tax)
4. **GitHub Account** (for repository and deployment)

### Local Development Tools
- Node.js 18+ and npm/yarn/pnpm
- Git
- Wrangler CLI: `npm install -g wrangler`

---

## 1️⃣ Cloudflare Setup

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
# Example: c1ea0c17-14ae-48cc-ade8-4433e9130594
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
  "compatibility_date": "2024-01-01",
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
  "vars": {
    "NODE_ENV": "production"
  }
}
```

---

## 2️⃣ Clerk Authentication Setup

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

#### **Local Development (.env.local)**
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

### **Step 4: Configure Domains**
In Clerk Dashboard:
1. Go to **Domains**
2. Add your production domain (e.g., `voltique.russellkmoore.me`)
3. Configure redirect URLs for authentication

---

## 3️⃣ Stripe Payment & Tax Setup

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
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`)

### **Step 5: Configure Environment Variables**

#### **Local Development (.env.local)**
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

---

## 4️⃣ Database Setup

### **Step 1: Run Migrations**
```bash
# Apply migrations to local database (for development)
npx wrangler d1 migrations apply mercora-db --local

# Apply migrations to production database
npx wrangler d1 migrations apply mercora-db
```

### **Step 2: Seed Data (Optional)**
```bash
# Execute seed data if you have any
npx wrangler d1 execute mercora-db --file=./lib/db/seed.sql
```

### **Step 3: Verify Database**
```bash
# Check tables were created
npx wrangler d1 execute mercora-db --command="SELECT name FROM sqlite_master WHERE type='table';"

# Check product count
npx wrangler d1 execute mercora-db --command="SELECT COUNT(*) FROM products;"
```

---

## 5️⃣ AI Content Indexing

### **Step 1: Prepare Content**
Ensure you have content in:
- `data/products_md/` - Product descriptions
- `data/knowledge_md/` - Support articles

### **Step 2: Index Content for AI**
```bash
# Deploy first, then index
npm run deploy

# Index both products and knowledge articles (consolidated endpoint)
curl -X GET "https://yourdomain.com/api/admin/vectorize?token=voltique-admin"
```

### **Step 3: Verify AI Setup**
Test the AI assistant to ensure it can access vectorized content.

---

## 6️⃣ Deployment Process

### **Step 1: Final Configuration Check**
Verify all environment variables and secrets are configured:

```bash
# Check Cloudflare secrets
npx wrangler secret list

# Verify wrangler.jsonc configuration
cat wrangler.jsonc
```

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
3. Test key functionality:
   - User registration/login
   - Product browsing
   - AI chat
   - Checkout flow (with test cards)

---

## 7️⃣ Post-Deployment Configuration

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

## 8️⃣ Going Live (Production Keys)

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

## 9️⃣ Monitoring & Maintenance

### **Cloudflare Monitoring**
- Worker analytics and logs
- D1 database performance
- R2 storage usage
- AI usage and costs

### **Third-Party Monitoring**
- Stripe payment success rates
- Clerk authentication metrics
- Error tracking and alerts

### **Regular Maintenance**
- Update dependencies monthly
- Review and rotate API keys quarterly
- Monitor resource usage and costs
- Update AI content and indexes

---

## 🔐 Security Checklist

### **Environment Security**
- ✅ All secrets stored in Cloudflare secrets (not vars)
- ✅ `.env.local` files are gitignored
- ✅ No hardcoded API keys in code

### **API Security**
- ✅ Webhook signature verification enabled
- ✅ API rate limiting configured
- ✅ Authentication required for admin endpoints

### **Content Security**
- ✅ CSP headers configured
- ✅ Input validation on all forms
- ✅ SQL injection protection via Drizzle ORM

---

## 🆘 Troubleshooting

### **Common Issues**

#### **Deployment Fails**
- Check wrangler.jsonc syntax
- Verify all required secrets are set
- Ensure Workers paid plan is active

#### **Database Connection Issues**
- Verify D1 database ID in wrangler.jsonc
- Check migration status
- Ensure proper bindings

#### **Authentication Issues**
- Verify Clerk domain configuration
- Check redirect URL settings
- Ensure API keys are correct

#### **Payment Issues**
- Verify Stripe webhook configuration
- Check webhook signature validation
- Ensure tax calculation is working

### **Debug Commands**
```bash
# View deployment logs
npx wrangler tail

# Check database status
npx wrangler d1 info mercora-db

# Test API endpoints
curl https://yourdomain.com/api/products

# Check secrets
npx wrangler secret list
```

---

## 📞 Support Resources

- **Cloudflare Workers**: [workers.cloudflare.com](https://workers.cloudflare.com)
- **Clerk Documentation**: [clerk.com/docs](https://clerk.com/docs)
- **Stripe Documentation**: [stripe.com/docs](https://stripe.com/docs)
- **Next.js Documentation**: [nextjs.org/docs](https://nextjs.org/docs)

---

**🎉 Your Mercora platform is now ready for production!**