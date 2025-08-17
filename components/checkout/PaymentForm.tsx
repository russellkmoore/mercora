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

  // Payment Element options
  const paymentElementOptions: StripePaymentElementOptions = {
    layout: 'tabs',
    paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
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
    <div className="bg-white p-6 rounded-xl text-black">
      <h2 className="text-lg font-bold mb-4">Payment Information</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Stripe Payment Element */}
        <div className="min-h-[200px]">
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
          className="w-full bg-black text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Payment security notice */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Your payment information is secure and encrypted</p>
      </div>
    </div>
  );
}