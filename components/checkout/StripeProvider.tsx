/**
 * === Stripe Elements Provider ===
 *
 * Wrapper component that provides Stripe Elements context to child components.
 * Handles Stripe initialization, theming, and configuration for payment forms.
 *
 * === Features ===
 * - **Stripe Elements**: Secure payment form components
 * - **Theme Configuration**: Consistent styling with app design
 * - **Error Handling**: Graceful fallbacks for Stripe loading issues
 * - **Type Safety**: Full TypeScript support
 * - **Performance**: Lazy loading and caching
 *
 * === Usage ===
 * ```tsx
 * <StripeProvider>
 *   <PaymentForm />
 * </StripeProvider>
 * ```
 */

"use client";

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@/lib/stripe';
import type { ReactNode } from 'react';
import type { StripeElementsOptions } from '@stripe/stripe-js';

interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
  options?: StripeElementsOptions;
}

// Load Stripe outside of component to avoid recreating on every render
const stripePromise = loadStripe();

/**
 * Stripe Elements provider with custom theme and configuration
 */
export default function StripeProvider({ 
  children, 
  clientSecret,
  options = {}
}: StripeProviderProps) {
  // Configure Elements options with theme
  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#f97316', // Orange-500 to match your theme
        colorBackground: '#ffffff',
        colorText: '#000000',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
      rules: {
        '.Input': {
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '16px',
        },
        '.Input:focus': {
          borderColor: '#f97316',
          boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.2)',
        },
        '.Label': {
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '4px',
        },
      },
    },
    ...options,
  };

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      {children}
    </Elements>
  );
}