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
import { useThemeTokens } from '@/lib/store';

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
  const tokens = useThemeTokens();

  // Return early if no clientSecret provided
  if (!clientSecret) {
    return <div>{children}</div>;
  }

  // Configure Elements options with theme. The Stripe Elements iframe cannot
  // read this app's CSS custom properties, so every colour here comes from
  // getThemeTokens() (via useThemeTokens()) rather than a literal — this is
  // the same inverse mapping the transactional emails use (D-11): the form
  // stays a light panel under volt-dark. The focus shadow is expressed as
  // the primary token plus an 8-digit hex alpha suffix rather than a
  // restated rgba() channel triple.
  const elementsOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: tokens.primary,
        colorBackground: tokens.surfaceInverse,
        colorText: tokens.onInverse,
        colorDanger: tokens.danger,
        fontFamily: tokens.fontSans,
        spacingUnit: '4px',
        borderRadius: '8px',
        ...(options.appearance?.variables || {}),
      },
      rules: {
        '.Input': {
          border: `1px solid ${tokens.borderInverse}`,
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
          borderColor: tokens.primary,
          boxShadow: `0 0 0 2px ${tokens.primary}33`,
          outline: 'none',
        },
        '.Input--invalid': {
          borderColor: tokens.danger,
        },
        '.Label': {
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '8px',
          color: tokens.mutedOnInverse,
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
          borderColor: tokens.primary,
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
