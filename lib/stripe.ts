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
import { Money, type StoredMoney } from '@/lib/money';

// Environment variables with validation
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!publishableKey) {
  console.warn('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable');
}

if (!secretKey && typeof window === 'undefined') {
  // Only require secret key on server-side
  console.warn('Missing STRIPE_SECRET_KEY environment variable');
}

/**
 * Client-side Stripe instance loader
 * Returns a promise that resolves to a Stripe instance for browser use
 */
let stripePromise: Promise<Stripe | null> | null = null;

export const loadStripe = (): Promise<Stripe | null> => {
  if (!publishableKey) {
    console.error('Cannot load Stripe: Missing publishable key');
    return Promise.resolve(null);
  }
  
  if (!stripePromise) {
    stripePromise = loadStripeLib(publishableKey);
  }
  return stripePromise;
};

let stripeClient: StripeServer | null = null;

/**
 * Get Stripe instance with proper error handling
 * Throws an error if Stripe is not properly configured
 */
export const getStripe = (): StripeServer => {
  if (!secretKey) {
    throw new Error('Stripe is not properly configured - missing secret key');
  }
  if (!stripeClient) {
    stripeClient = new StripeServer(secretKey, {
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
      httpClient: StripeServer.createFetchHttpClient(),
    });
  }
  return stripeClient;
};

/** One SDK client is used in Node.js and Cloudflare Workers. */
export const getStripeClient = getStripe;

/**
 * Create a payment intent using the appropriate Stripe client
 */
export const createPaymentIntent = async (
  params: StripeServer.PaymentIntentCreateParams
): Promise<StripeServer.PaymentIntent> => getStripe().paymentIntents.create(params);

export const retrievePaymentIntent = async (
  id: string
): Promise<StripeServer.PaymentIntent> => getStripe().paymentIntents.retrieve(id);

/** Best-effort cleanup when durable pending-order persistence fails. */
export const cancelPaymentIntent = async (id: string): Promise<void> => {
  await getStripe().paymentIntents.cancel(id);
};

/**
 * Calculate tax using the appropriate Stripe client
 */
export const calculateTax = async (
  params: StripeServer.Tax.CalculationCreateParams
): Promise<StripeServer.Tax.Calculation> => getStripe().tax.calculations.create(params);

/**
 * Verify a Stripe webhook with Web Crypto so signature checking works in
 * Cloudflare Workers as well as Node.js.
 */
export const constructWebhookEvent = async (
  payload: string | Uint8Array,
  signature: string,
  secret = getWebhookSecret()
): Promise<StripeServer.Event> => getStripe().webhooks.constructEventAsync(
  payload,
  signature,
  secret,
  undefined,
  StripeServer.createSubtleCryptoProvider()
);

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
export const formatAmountForStripe = (amount: StoredMoney): number => {
  return Money.fromStored(amount).toMinorUnits();
};

/**
 * Utility function to format amounts from Stripe
 * Converts cents back to dollars
 */
export const formatAmountFromStripe = (amount: number, currency = 'USD'): StoredMoney => {
  return Money.fromMinor(amount, currency).toJSON();
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
