# Stripe Integration Guide

This guide covers the complete Stripe integration for payments and tax calculation in the Mercora eCommerce application.

## Overview

The application integrates Stripe for:
- **Secure Payment Processing**: PCI-compliant payment collection
- **Real-time Tax Calculation**: Accurate US sales tax via Stripe Tax
- **Payment Intent Management**: Secure payment confirmation flow
- **Webhook Handling**: Payment status updates and order management

## Features

### Payment Processing
- **Stripe Elements**: Secure, customizable payment forms
- **Payment Intents**: Advanced payment flow with built-in authentication
- **Multiple Payment Methods**: Credit cards, Apple Pay, Google Pay
- **Real-time Validation**: Instant feedback on payment details

### Tax Calculation
- **Stripe Tax Integration**: Accurate tax rates for all US jurisdictions
- **Address-based Calculation**: Location-specific tax computation
- **Shipping Tax**: Tax calculation on shipping costs
- **Fallback Handling**: Graceful degradation if Stripe Tax fails

### Security
- **PCI Compliance**: No sensitive payment data touches your servers
- **Webhook Verification**: Cryptographic signature validation
- **Environment Variables**: Secure API key management
- **Error Handling**: Comprehensive error management and logging

## Setup Instructions

### 1. Create Stripe Account
1. Sign up at [https://stripe.com](https://stripe.com)
2. Complete account verification
3. Access your Dashboard

### 2. Get API Keys
1. Go to **Developers > API Keys** in your Stripe Dashboard
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your keys:

```bash
cp .env.example .env.local
```

Update `.env.local`:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
```

### 4. Set Up Webhooks
1. Go to **Developers > Webhooks** in Stripe Dashboard
2. Click **+ Add endpoint**
3. Set endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
5. Copy the **Signing secret** and add to `.env.local`:
```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 5. Enable Stripe Tax
1. Go to **Products > Tax** in Stripe Dashboard
2. Enable tax calculation for your business
3. Configure your business location and tax settings

## File Structure

```
├── lib/
│   └── stripe.ts                 # Stripe configuration and utilities
├── app/api/
│   ├── webhooks/stripe/route.ts  # Webhook event handling  
│   ├── payment-intent/route.ts   # Payment Intent creation
│   ├── tax/route.ts              # Tax calculation endpoint
│   └── orders/route.ts           # Unified order management
├── components/checkout/
│   ├── CheckoutClient.tsx        # Complete checkout flow with Stripe
│   ├── StripeProvider.tsx        # Stripe Elements provider
│   ├── PaymentForm.tsx           # Secure payment form
│   ├── ShippingForm.tsx          # Shipping address collection
│   ├── ShippingOptions.tsx       # Shipping method selection
│   ├── OrderSummary.tsx          # Order totals and summary
│   └── ... other checkout components
└── docs/
    ├── STRIPE_INTEGRATION.md     # This documentation
    └── API_STRUCTURE.md          # Clean API architecture
```

## API Endpoints

### POST /api/payment-intent
Creates a Payment Intent for secure payment processing.

**Request:**
```json
{
  "amount": number,        // Total amount including tax
  "taxAmount": number,     // Tax amount (from /api/tax)
  "shippingAddress": Address,
  "orderId": string,
  "description"?: string
}
```

**Response:**
```json
{
  "clientSecret": string,
  "paymentIntentId": string,
  "amount": number
}
```

### POST /api/tax
Calculates tax using Stripe Tax with fallback to fixed rate.

**Request:**
```json
{
  "items": [CartItem[]],
  "shippingAddress": Address,
  "shippingCost": number
}
```

**Response:**
```json
{
  "amount": number,
  "breakdown": TaxBreakdown,
  "calculated_by": "stripe" | "fallback"
}
```

### POST /api/webhooks/stripe
Handles Stripe webhook events for payment status updates.

## Components

### StripeProvider
Wraps child components with Stripe Elements context.

```tsx
<StripeProvider clientSecret="pi_xxx_secret_xxx">
  <PaymentForm />
</StripeProvider>
```

### PaymentForm
Secure payment form using Stripe Elements.

```tsx
<PaymentForm
  clientSecret="pi_xxx_secret_xxx"
  onSuccess={(paymentIntentId) => handleSuccess(paymentIntentId)}
  onError={(error) => handleError(error)}
/>
```

### CheckoutClient
Complete checkout flow with shipping, tax, and payment.

```tsx
<CheckoutClient userId={userId} />
```

## Testing

### Test Cards
Use Stripe's test cards for development:

- **Successful payment**: `4242424242424242`
- **Declined payment**: `4000000000000002`
- **3D Secure**: `4000002500003155`

### Test Tax Addresses
Test tax calculation with different US addresses:

- **California**: High tax rate (~10%)
- **Montana**: No state sales tax
- **New York**: Moderate tax rate (~8%)

## Production Deployment

### 1. Switch to Live Keys
1. Get live API keys from Stripe Dashboard
2. Update environment variables with `pk_live_` and `sk_live_` keys
3. Update webhook endpoints to production URLs

### 2. Tax Configuration
1. Register for tax collection in required states
2. Configure tax rates in Stripe Dashboard
3. Set up automatic tax filing (optional)

### 3. Webhook Security
1. Verify webhook signatures in production
2. Use HTTPS for all webhook endpoints
3. Monitor webhook delivery in Stripe Dashboard

## Troubleshooting

### Common Issues

**API Key Errors**
- Verify keys are correctly set in environment variables
- Ensure you're using test keys for development
- Check that keys haven't been revoked

**Tax Calculation Failures**
- Verify Stripe Tax is enabled in Dashboard
- Check that business location is configured
- Ensure shipping addresses are valid US addresses

**Webhook Issues**
- Verify webhook URL is accessible
- Check webhook signature verification
- Monitor webhook logs in Stripe Dashboard

### Error Handling
The integration includes comprehensive error handling:
- Payment failures are gracefully handled
- Tax calculation falls back to fixed rate if Stripe Tax fails
- Webhook events are logged and monitored

## Support

- **Stripe Documentation**: [https://stripe.com/docs](https://stripe.com/docs)
- **Stripe Tax Guide**: [https://stripe.com/docs/tax](https://stripe.com/docs/tax)
- **Webhook Guide**: [https://stripe.com/docs/webhooks](https://stripe.com/docs/webhooks)