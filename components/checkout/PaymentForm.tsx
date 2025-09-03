/**
 * === Stripe Payment Form ===
 *
 * Secure payment form using Stripe Elements for PCI-compliant payment
 * processing. Handles payment method collection, validation, and submission.
 *
 * === Features ===
 * - **Stripe Elements**: Secure, PCI-compliant payment inputs
 * - **Real-time Validation**: Instant feedback on payment details
 * - **Payment Intent**: Secure payment processing with confirmation
 * - **Error Handling**: Comprehensive error management and display
 * - **Loading States**: User feedback during payment processing
 * - **Accessibility**: Full keyboard and screen reader support
 *
 * === Security ===
 * - No sensitive payment data touches your servers
 * - Automatic PCI compliance through Stripe Elements
 * - Tokenized payment methods for recurring payments
 *
 * === Usage ===
 * ```tsx
 * <PaymentForm
 *   clientSecret="pi_xxx_secret_xxx"
 *   onSuccess={(paymentIntent) => handleSuccess(paymentIntent)}
 *   onError={(error) => handleError(error)}
 * />
 * ```
 */

"use client";

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import type { StripePaymentElementOptions } from '@stripe/stripe-js';

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

/**
 * Stripe payment form component with integrated payment processing
 */
export default function PaymentForm({
  clientSecret,
  onSuccess,
  onError,
  disabled = false,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Detect mobile Safari
  const isMobileSafari = typeof window !== 'undefined' && 
    /iPad|iPhone|iPod/.test(navigator.userAgent) && 
    /Safari/.test(navigator.userAgent);

  // Payment Element options with mobile optimization
  const paymentElementOptions: StripePaymentElementOptions = {
    layout: {
      type: 'tabs',
      defaultCollapsed: false,
      radios: false,
      spacedAccordionItems: isMobileSafari // More spacing on mobile Safari
    },
    paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
    wallets: {
      applePay: 'auto', // Will show only if device supports it and domain is verified
      googlePay: 'auto', // Will show only if device supports it
    },
    fields: {
      billingDetails: {
        address: 'auto',
      },
    },
  };

  /**
   * Handle payment form submission
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error('Stripe.js hasn\'t loaded yet.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Return URL after payment completion
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: 'if_required', // Only redirect if required by payment method
      });

      if (error) {
        // Payment failed
        const message = error.message || 'An unexpected error occurred.';
        setErrorMessage(message);
        onError(message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded
        onSuccess(paymentIntent.id);
      } else {
        // Handle other payment statuses
        const message = 'Payment requires additional action.';
        setErrorMessage(message);
        onError(message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment processing failed';
      setErrorMessage(message);
      onError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-black w-full">
      {!stripe || !elements ? (
        <div className="min-h-[300px] w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
            <p className="text-sm text-gray-600">Loading payment form...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 w-full">
          {/* Stripe Payment Element */}
          <div className="min-h-[300px] w-full">
            <PaymentElement 
              id="payment-element"
              options={paymentElementOptions}
            />
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="text-red-600 text-sm font-medium p-3 bg-red-50 rounded-lg border border-red-200">
              {errorMessage}
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            disabled={!stripe || !elements || isLoading || disabled}
            className="w-full bg-black text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </div>
            ) : (
              'Complete Payment'
            )}
          </Button>
        </form>
      )}

      {/* Payment security notice */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Your payment information is secure and encrypted</p>
      </div>
    </div>
  );
}