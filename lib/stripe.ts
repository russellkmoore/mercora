/**
 * === Stripe Configuration ===
 *
 * Centralized Stripe configuration for both client and server-side usage.
 * Provides secure API key management and consistent Stripe instance creation.
 *
 * === Features ===
 * - **Environment Variables**: Secure API key management
 * - **Client Configuration**: Browser-safe publishable key handling
 * - **Server Configuration**: Server-side secret key management
 * - **Type Safety**: Full TypeScript support
 * - **Error Handling**: Graceful fallbacks for missing keys
 *
 * === Security ===
 * - Only publishable keys are exposed to the client
 * - Secret keys remain server-side only
 * - Environment-based configuration
 *
 * === Usage ===
 * ```tsx
 * // Client-side
 * import { loadStripe } from '@/lib/stripe';
 * const stripe = await loadStripe();
 * 
 * // Server-side
 * import { stripe } from '@/lib/stripe';
 * const paymentIntent = await stripe.paymentIntents.create({...});
 * ```
 */

import { loadStripe as loadStripeLib, Stripe } from '@stripe/stripe-js';
import StripeServer from 'stripe';

// Environment variables with validation
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!publishableKey) {
  throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable');
}

if (!secretKey && typeof window === 'undefined') {
  // Only require secret key on server-side
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

/**
 * Client-side Stripe instance loader
 * Returns a promise that resolves to a Stripe instance for browser use
 */
let stripePromise: Promise<Stripe | null> | null = null;

export const loadStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripeLib(publishableKey!);
  }
  return stripePromise;
};

/**
 * Server-side Stripe instance
 * Configured with secret key for server operations
 */
export const stripe = new StripeServer(secretKey!, {
  apiVersion: '2025-07-30.basil',
  typescript: true,
});

/**
 * Stripe Tax configuration
 * Settings for tax calculation functionality
 */
export const stripeTaxConfig = {
  // Enable automatic tax for supported regions
  automaticTax: {
    enabled: true,
  },
  // Tax behavior for different scenarios
  taxBehavior: 'exclusive' as const, // Tax calculated separately from item prices
  // Tax code for general products
  defaultTaxCode: 'txcd_99999999', // General - Tangible Goods
};

/**
 * Common Stripe configuration options
 */
export const stripeConfig = {
  currency: 'usd',
  paymentMethodTypes: ['card'] as const,
  mode: 'payment' as const,
  billingAddressCollection: 'required' as const,
  shippingAddressCollection: {
    allowedCountries: ['US'] as const,
  },
};

/**
 * Utility function to format amounts for Stripe
 * Stripe requires amounts in cents (smallest currency unit)
 */
export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100);
};

/**
 * Utility function to format amounts from Stripe
 * Converts cents back to dollars
 */
export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100;
};

/**
 * Environment check for webhook secret
 */
export const getWebhookSecret = (): string => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable');
  }
  return webhookSecret;
};