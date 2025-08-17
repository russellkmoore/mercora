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

import { useState, useEffect } from 'react';
import { useCartStore } from '@/lib/stores/cart-store';
import StripeProvider from './StripeProvider';
import PaymentForm from './PaymentForm';
import ShippingForm from './ShippingForm';
import ShippingOptions from './ShippingOptions';
import OrderSummary from './OrderSummary';
import ProgressBar from './ProgressBar';
import OrderConfirmationModal from './OrderConfirmationModal';
import type { Address, ShippingOption } from '@/lib/types';

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

      // Calculate tax with shipping address and cost
      const taxRes = await fetch('/api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shippingAddress,
          shippingCost: option.cost || 0,
        }),
      });

      if (!taxRes.ok) {
        const err = await taxRes.json() as { error?: string };
        throw new Error(err.error || 'Failed to calculate tax');
      }

      const taxData = await taxRes.json() as { amount: number };
      setTaxAmount(taxData.amount);

      // Create order and payment intent
      await createPaymentIntent(option);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Create Payment Intent with Stripe
  const createPaymentIntent = async (selectedShippingOption: ShippingOption) => {
    try {
      // Generate order ID
      const timestamp = Date.now();
      let baseId = userId ?? 'guest';
      if (baseId.includes('@')) {
        baseId = baseId.split('@')[0];
      }
      const safeUserId = baseId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const newOrderId = `WEB-${safeUserId}-${timestamp}`;
      setOrderId(newOrderId);

      // Calculate total amount (subtotal + shipping + tax)
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalAmount = subtotal + (selectedShippingOption.cost || 0) + (taxAmount || 0);

      // Create payment intent
      const res = await fetch('/api/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          taxAmount: taxAmount || 0,
          shippingAddress,
          orderId: newOrderId,
          description: `${items.length} item(s) - ${items.map(i => i.name).join(', ')}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to create payment intent');
      }

      const data = await res.json() as { clientSecret: string };
      setClientSecret(data.clientSecret);
      setCurrentStep('payment');

    } catch (err: unknown) {
      throw err;
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      // Submit order with payment intent ID to unified orders endpoint
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shipping_address: shippingAddress,
          billing_address: shippingAddress, // Use same as shipping for now
          shipping_method: shippingOption?.label || 'standard',
          shipping_cost: shippingOption?.cost || 0,
          tax_amount: Math.round((taxAmount || 0) * 100), // Convert to cents
          payment_method: 'stripe',
          payment_intent_id: paymentIntentId,
          status: 'pending',
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to create order');
      }

      // Clear cart and show confirmation
      clearCart();
      setCurrentStep('confirmation');

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Order creation failed');
    }
  };

  // Handle payment errors
  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // If no items in cart, show empty state
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Your cart is empty</h2>
        <p className="text-gray-400">Add some items to your cart to continue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ProgressBar step={currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 2 : 3} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Shipping Form */}
          {currentStep === 'shipping' && (
            <>
              <ShippingForm
                address={address}
                onChange={handleAddressChange}
                onSelectCountry={(value) =>
                  setAddress((prev) => ({ ...prev, country: value }))
                }
                onSubmit={handleAddressSubmit}
                error={null}
              />
              
              {shippingOptions.length > 0 && (
                <ShippingOptions
                  address={address}
                  options={shippingOptions}
                  onSelect={handleShippingSelected}
                  selectedOptionId={shippingOption?.id}
                  disabled={isLoading}
                />
              )}
            </>
          )}

          {/* Payment Form */}
          {currentStep === 'payment' && clientSecret && (
            <StripeProvider clientSecret={clientSecret}>
              <PaymentForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                disabled={isLoading}
              />
            </StripeProvider>
          )}

          {/* Confirmation */}
          {currentStep === 'confirmation' && (
            <OrderConfirmationModal
              isOpen={true}
              onClose={() => setCurrentStep('confirmation')}
              orderId={orderId}
              userId={userId}
            />
          )}
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <OrderSummary
            items={items}
            shippingOption={shippingOption}
            taxAmount={taxAmount ?? 0}
            showDiscountInput={currentStep !== 'confirmation'}
          />
        </div>
      </div>
    </div>
  );
}