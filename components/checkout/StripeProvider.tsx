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
  // Return early if no clientSecret provided
  if (!clientSecret) {
    return <div>{children}</div>;
  }

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
        ...(options.appearance?.variables || {}),
      },
      rules: {
        '.Input': {
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '16px', // 16px prevents zoom on iOS
          minHeight: '44px', // Touch-friendly minimum height
          transition: 'border-color 0.15s ease-in-out',
          width: '100%',
          boxSizing: 'border-box',
          '-webkit-appearance': 'none', // Remove iOS styling
        },
        '.Input:focus': {
          borderColor: '#f97316',
          boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.2)',
          outline: 'none',
        },
        '.Input--invalid': {
          borderColor: '#ef4444',
        },
        '.Label': {
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '8px',
          color: '#374151',
          display: 'block',
          width: '100%',
        },
        '.Tab': {
          minHeight: '44px',
          padding: '12px 16px',
          fontSize: '16px',
          width: '100%',
          boxSizing: 'border-box',
        },
        '.Tab--selected': {
          borderColor: '#f97316',
        },
        '.TabIcon': {
          height: '20px',
          width: '20px',
        },
        '.TabList': {
          width: '100%',
        },
        '.TabContent': {
          width: '100%',
          marginTop: '16px',
        },
        // Note: Stripe doesn't support media queries, mobile styles handled at component level
        ...(options.appearance?.rules || {}),
      },
    },
    // Only spread appearance-related options to avoid conflicts with clientSecret mode
    ...(options.fonts && { fonts: options.fonts }),
    ...(options.locale && { locale: options.locale }),
  };

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      {children}
    </Elements>
  );
}