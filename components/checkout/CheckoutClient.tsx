/**
 * === Checkout Client Component ===
 *
 * Complete checkout flow with Stripe integration for payments and tax calculation.
 * Handles the entire customer journey from cart to payment confirmation.
 *
 * === Features ===
 * - **Multi-step Flow**: Shipping → Payment → Confirmation
 * - **Real-time Tax**: Stripe Tax integration for accurate calculations
 * - **Secure Payments**: PCI-compliant payment processing
 * - **Order Management**: Integrated order creation and tracking
 * - **Error Handling**: Comprehensive error management
 * - **Loading States**: User feedback throughout the process
 *
 * === Checkout Flow ===
 * 1. Shipping address collection
 * 2. Shipping option selection
 * 3. Real-time tax calculation
 * 4. Payment Intent creation
 * 5. Secure payment processing
 * 6. Order confirmation
 *
 * === Usage ===
 * ```tsx
 * <CheckoutClient userId={userId} />
 * ```
 */

"use client";

import { useState } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';
import StripeProvider from './StripeProvider';
import PaymentForm from './PaymentForm';
import ShippingForm from './ShippingForm';
import ShippingOptions from './ShippingOptions';
import OrderSummary, { type AuthoritativeCheckoutQuote } from './OrderSummary';
import ProgressBar from './ProgressBar';
import OrderConfirmationModal from './OrderConfirmationModal';
import type { Address, ShippingOption } from '@/lib/types';
import { Money } from '@/lib/money';
import { clearPendingCheckout, savePendingCheckout } from '@/lib/checkout/order-payload';

interface CheckoutClientProps {
  userId: string | null;
}

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

export default function CheckoutClient({ userId }: CheckoutClientProps) {
  const {
    items,
    shippingAddress,
    shippingOption,
    taxAmount,
    setShippingAddress,
    setShippingOption,
    setTaxAmount,
    updateShippingDiscounts,
    appliedDiscounts,
    clearCart,
  } = useCartStore();

  // State management
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [address, setAddress] = useState<Partial<Address>>({
    recipient: '',
    email: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: 'US',
  });
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [authoritativeQuote, setAuthoritativeQuote] = useState<AuthoritativeCheckoutQuote>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Handle address form changes
  const handleAddressChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  // Submit address and get shipping options
  const handleAddressSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Get shipping options
      const res = await fetch('/api/shipping-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, items }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to get shipping options');
      }

      const data = await res.json() as { options: ShippingOption[] };
      setShippingOptions(data.options);
      
      // Save address to store
      setShippingAddress({
        recipient: address.recipient || '',
        email: address.email || '',
        line1: address.line1 || '',
        line2: address.line2,
        city: address.city || '',
        region: address.region || '',
        postal_code: address.postal_code || '',
        country: address.country || 'US',
        type: 'shipping',
        status: 'unverified',
      } as Address);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle shipping option selection
  const handleShippingSelected = async (option: ShippingOption) => {
    setIsLoading(true);
    setError('');

    try {
      setShippingOption(option);
      
      // Update shipping discounts based on new shipping cost
      updateShippingDiscounts();

      // The payment-intent endpoint performs the one authoritative tax/pricing
      // calculation and returns the exact quote shown beside Stripe Elements.
      await createPaymentIntent(option);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Create Payment Intent with Stripe
  const createPaymentIntent = async (
    selectedShippingOption: ShippingOption
  ) => {
    try {
      // Create payment intent
      const res = await fetch('/api/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          shippingAddress,
          shippingMethodId: selectedShippingOption.id,
          discountCodes: appliedDiscounts.map((discount) => discount.code),
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to create payment intent');
      }

      const data = await res.json() as {
        clientSecret: string;
        paymentIntentId: string;
        orderId: string;
        quote: AuthoritativeCheckoutQuote;
      };
      setOrderId(data.orderId);
      setTaxAmount(Money.fromMajor(data.quote.tax.amount, data.quote.tax.currency).toJSON());
      setAuthoritativeQuote(data.quote);
      savePendingCheckout({
        orderId: data.orderId,
        paymentIntentId: data.paymentIntentId,
      });
      setClientSecret(data.clientSecret);
      setCurrentStep('payment');

    } catch (err: unknown) {
      throw err;
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      // Ask the server to verify and finalize its durable pending order.
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentIntentId,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to create order');
      }

      const orderResponse = await res.json();
      console.log('Order created successfully:', orderResponse);
      clearPendingCheckout(paymentIntentId);

      // Clear cart immediately after successful order creation
      clearCart();
      
      // Show confirmation
      setCurrentStep('confirmation');

    } catch (err: unknown) {
      // Don't clear cart on error - preserve user's items for retry
      setError(err instanceof Error ? err.message : 'Order creation failed');
    }
  };

  // Handle payment errors
  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Handle going back to shipping step
  const handleBackToShipping = () => {
    setCurrentStep('shipping');
    setClientSecret(''); // Clear payment intent
    setAuthoritativeQuote(undefined);
    setError(''); // Clear any errors
  };

  // If no items in cart and not showing confirmation, show empty state
  if ((!items || items.length === 0) && currentStep !== 'confirmation') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Your cart is empty</h2>
        <p className="text-gray-400">Add some items to your cart to continue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProgressBar step={currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 2 : 3} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-col xl:grid xl:grid-cols-[1fr_1.6fr] gap-4 lg:gap-6 w-full">
        <div className="space-y-6 min-w-0">
          {/* Shipping Address Section */}
          {currentStep === 'shipping' ? (
            <div className="bg-white p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Shipping Address</h3>
              <ShippingForm
                address={address}
                onChange={handleAddressChange}
                onSelectCountry={(value) =>
                  setAddress((prev) => ({ ...prev, country: value }))
                }
                onSubmit={handleAddressSubmit}
                error={null}
              />
            </div>
          ) : (currentStep === 'payment' || currentStep === 'confirmation') && shippingAddress && (
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-orange-500">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900">Shipping Address</h4>
                <button
                  onClick={handleBackToShipping}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  disabled={isLoading}
                >
                  Edit
                </button>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{typeof shippingAddress.recipient === 'string' ? shippingAddress.recipient : 'Customer'}</p>
                <p>{typeof shippingAddress.line1 === 'string' ? shippingAddress.line1 : ''}</p>
                {shippingAddress.line2 && <p>{typeof shippingAddress.line2 === 'string' ? shippingAddress.line2 : ''}</p>}
                <p>{typeof shippingAddress.city === 'string' ? shippingAddress.city : ''}, {typeof shippingAddress.region === 'string' ? shippingAddress.region : ''} {typeof shippingAddress.postal_code === 'string' ? shippingAddress.postal_code : ''}</p>
              </div>
            </div>
          )}

          {/* Shipping Options Section */}
          {currentStep === 'shipping' && shippingOptions.length > 0 && (
            <div className="bg-white p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Shipping Method</h3>
              <ShippingOptions
                address={address}
                options={shippingOptions}
                onSelect={handleShippingSelected}
                selectedOptionId={shippingOption?.id}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Shipping Method Summary */}
          {(currentStep === 'payment' || currentStep === 'confirmation') && shippingOption && (
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-orange-500">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900">Shipping Method</h4>
                <button
                  onClick={handleBackToShipping}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  disabled={isLoading}
                >
                  Edit
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <p>{shippingOption.label}</p>
                <p className="text-gray-500">{Money.fromStored(shippingOption.cost).format()} - {shippingOption.estimatedDays ? `${shippingOption.estimatedDays} business days` : 'Standard delivery'}</p>
              </div>
            </div>
          )}

          {/* Confirmation */}
          {currentStep === 'confirmation' && (
            <OrderConfirmationModal
              isOpen={true}
              onClose={() => {
                // Cart already cleared, just handle navigation
                window.location.href = '/';
              }}
              orderId={orderId}
              userId={userId}
            />
          )}
        </div>

        {/* Right Column: Order Summary & Payment */}
        <div className="space-y-6">
          <OrderSummary
            items={items}
            shippingOption={shippingOption}
            taxAmount={taxAmount}
            showDiscountInput={currentStep !== 'confirmation'}
            authoritativeQuote={authoritativeQuote}
          />

          {/* Payment Form */}
          {currentStep === 'payment' && clientSecret && (
            <div className="bg-white p-4 sm:p-6 rounded-xl w-full min-h-[400px]">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Payment Information</h3>
              <div className="w-full">
                <StripeProvider clientSecret={clientSecret}>
                  <PaymentForm
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    disabled={isLoading}
                  />
                </StripeProvider>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
