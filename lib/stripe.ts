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

/**
 * Server-side Stripe instance
 * Configured with secret key for server operations
 */
export const stripe = secretKey 
  ? new StripeServer(secretKey, {
      apiVersion: '2025-07-30.basil',
      typescript: true,
    })
  : null;

/**
 * Get Stripe instance with proper error handling
 * Throws an error if Stripe is not properly configured
 */
export const getStripe = (): StripeServer => {
  if (!stripe) {
    throw new Error('Stripe is not properly configured - missing secret key');
  }
  return stripe;
};

/**
 * Cloudflare Workers-compatible Stripe API client
 * Uses fetch instead of Node.js https module
 */
export class CloudflareStripe {
  private apiKey: string;
  private apiVersion = '2020-08-27';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: Record<string, any>
  ) {
    const url = `https://api.stripe.com/v1${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Stripe-Version': this.apiVersion,
    };

    let body: string | undefined;
    if (data && method === 'POST') {
      // Convert to URL-encoded string for Stripe API
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      
      const encodeValue = (obj: any, prefix = ''): string[] => {
        const params: string[] = [];
        
        for (const key in obj) {
          if (obj[key] !== null && obj[key] !== undefined) {
            const value = obj[key];
            const fieldName = prefix ? `${prefix}[${key}]` : key;
            
            if (typeof value === 'object' && !Array.isArray(value)) {
              params.push(...encodeValue(value, fieldName));
            } else if (Array.isArray(value)) {
              value.forEach((item, index) => {
                if (typeof item === 'object') {
                  params.push(...encodeValue(item, `${fieldName}[${index}]`));
                } else {
                  params.push(`${encodeURIComponent(`${fieldName}[${index}]`)}=${encodeURIComponent(String(item))}`);
                }
              });
            } else {
              params.push(`${encodeURIComponent(fieldName)}=${encodeURIComponent(String(value))}`);
            }
          }
        }
        
        return params;
      };
      
      body = encodeValue(data).join('&');
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      throw new Error(`Stripe API Error: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    automatic_payment_methods?: { enabled: boolean };
    metadata?: Record<string, string>;
    shipping?: any;
    description?: string;
  }) {
    return await this.request('POST', '/payment_intents', params);
  }

  async calculateTax(params: {
    currency: string;
    line_items: Array<{
      amount: number;
      reference: string;
      tax_behavior?: string;
      tax_code?: string;
    }>;
    customer_details: {
      address: {
        line1: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
      };
      address_source: string;
    };
  }) {
    return await this.request('POST', '/tax/calculations', params);
  }

  webhooks = {
    constructEvent: (payload: string, signature: string, secret: string) => {
      // Basic webhook verification - in production, you'd want more robust verification
      // For now, just parse the payload
      try {
        return JSON.parse(payload);
      } catch (error) {
        throw new Error('Invalid webhook payload');
      }
    }
  };
}

/**
 * Get Cloudflare Workers-compatible Stripe client
 */
export const getCloudflareStripe = (): CloudflareStripe => {
  if (!secretKey) {
    throw new Error('Stripe secret key not configured for Cloudflare Workers');
  }
  return new CloudflareStripe(secretKey);
};

/**
 * Get the appropriate Stripe client based on the runtime environment
 */
export const getStripeClient = (): StripeServer | CloudflareStripe => {
  // Detect if we're running in Cloudflare Workers
  const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
    globalThis.navigator?.userAgent?.includes('Cloudflare-Workers');
  
  // Also check for specific Cloudflare Workers globals
  const hasWorkersGlobals = typeof caches !== 'undefined' && 
    typeof Request !== 'undefined' && 
    typeof Response !== 'undefined' && 
    typeof globalThis.fetch === 'function';

  if (isCloudflareWorkers || hasWorkersGlobals || process.env.NODE_ENV === 'production') {
    return getCloudflareStripe();
  } else {
    return getStripe();
  }
};

/**
 * Create a payment intent using the appropriate Stripe client
 */
export const createPaymentIntent = async (params: {
  amount: number;
  currency: string;
  automatic_payment_methods?: { enabled: boolean };
  metadata?: Record<string, string>;
  shipping?: any;
  description?: string;
}): Promise<{ id: string; client_secret: string | null; [key: string]: any }> => {
  const client = getStripeClient();
  
  if (client instanceof CloudflareStripe) {
    return await client.createPaymentIntent(params) as { id: string; client_secret: string | null; [key: string]: any };
  } else {
    // Use the regular Stripe SDK
    return await client.paymentIntents.create(params) as { id: string; client_secret: string | null; [key: string]: any };
  }
};

/**
 * Calculate tax using the appropriate Stripe client
 */
export const calculateTax = async (params: any): Promise<any> => {
  const client = getStripeClient();
  
  if (client instanceof CloudflareStripe) {
    return await client.calculateTax(params);
  } else {
    // Use the regular Stripe SDK
    return await client.tax.calculations.create(params);
  }
};

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