# Production Deployment Setup

## Environment Configuration

Your Stripe integration is now configured for both local development and production deployment.

### ✅ **Already Configured**

#### **Local Development (.env.local)**
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Added to .env.local
- ✅ `STRIPE_SECRET_KEY` - Added to .env.local  
- ✅ `STRIPE_WEBHOOK_SECRET` - Added to .env.local

#### **Production Cloudflare (wrangler.jsonc + secrets)**
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Added to wrangler.jsonc vars
- ✅ `STRIPE_SECRET_KEY` - Added as Cloudflare secret ✨
- ✅ `STRIPE_WEBHOOK_SECRET` - Added as Cloudflare secret ✨

### 📋 **Deployment Checklist**

#### **1. Stripe Webhook Configuration**
Update your Stripe webhook endpoint URL to point to production:

**In Stripe Dashboard:**
1. Go to **Developers > Webhooks**
2. Edit your existing webhook
3. Change URL from local to: `https://voltique.russellkmoore.me/api/webhooks/stripe`
4. Ensure these events are selected:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`

#### **2. Deploy to Production**
```bash
# Deploy with all secrets configured
npm run deploy
```

#### **3. Test Production Payment Flow**
1. Visit: https://voltique.russellkmoore.me/checkout
2. Add items to cart
3. Use Stripe test card: `4242424242424242`
4. Complete checkout flow
5. Verify order creation and payment processing

#### **4. Production Readiness**
When ready for live payments:

```bash
# Switch to live Stripe keys in wrangler.jsonc
# Update NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to pk_live_...

# Add live secret key
echo "sk_live_your_live_secret_key" | npx wrangler secret put STRIPE_SECRET_KEY

# Add live webhook secret  
echo "whsec_your_live_webhook_secret" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## 🔐 **Security Summary**

### **Public Variables (wrangler.jsonc)**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Safe to expose client-side

### **Secret Variables (Cloudflare Secrets)**
- `STRIPE_SECRET_KEY` - Server-side only, encrypted by Cloudflare
- `STRIPE_WEBHOOK_SECRET` - Server-side only, encrypted by Cloudflare
- `RESEND_API_KEY` - Already configured as secret

### **Local Development**
- All keys in `.env.local` for local testing
- `.env.local` is gitignored (secure)

## 🚀 **Current Status**

**✅ READY TO DEPLOY**

Your Stripe integration is fully configured for production:
- Clean API structure eliminates redundancy
- Real-time tax calculation via Stripe Tax
- Secure payment processing with webhooks
- Proper secret management for Cloudflare Workers

## 🧪 **Testing**

### **Test Cards (Works in both environments)**
- **Success**: `4242424242424242`
- **Decline**: `4000000000000002` 
- **3D Secure**: `4000002500003155`
- **Insufficient funds**: `4000000000009995`

### **Test Tax Addresses**
- **California**: High tax rate (~10%)
- **Montana**: No state sales tax (0%)
- **New York**: Moderate tax rate (~8%)

## 📊 **Monitoring**

After deployment, monitor:
- Stripe Dashboard for payment activity
- Cloudflare Workers logs for webhook processing
- Order creation in your database

The integration is production-ready! 🎉