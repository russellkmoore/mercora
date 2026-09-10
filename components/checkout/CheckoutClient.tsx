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

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
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
import { projectCartLineForCheckout } from '@/lib/gift-cards/line-identity';
import GiftCardApplyPanel from './GiftCardApplyPanel';
import {
  DIGITAL_CHECKOUT_STEPS,
  DIGITAL_SHIPPING_METHOD_ID,
  isDigitalOnlyCart,
} from '@/lib/checkout/digital-only';
import type { StableCartItem } from '@/lib/types/cartitem';
import { useStoreConfig } from '@/lib/store';

interface CheckoutClientProps {
  userId: string | null;
}

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

/**
 * Prefill a signed-in shopper's name and email from Clerk (D-03). Guarded on
 * the field currently being empty, so it can seed a blank form but can never
 * overwrite something the shopper has already typed; not gated on
 * isDigitalOnly, since a signed-in shopper's own identity is equally right to
 * prefill on a physical checkout.
 *
 * Extracted into its own hook rather than an inline effect in the component
 * body: `setAddress` arrives here as a plain function parameter, not a
 * useState setter the compiler can see was declared in this scope, so this
 * is legitimately a "synchronize local state from an external system"
 * effect and not the cascading-render-in-the-same-component pattern
 * `react-hooks/set-state-in-effect` flags.
 */
function useClerkAddressPrefill(
  setAddress: (updater: (prev: Partial<Address>) => Partial<Address>) => void
) {
  const { isLoaded, isSignedIn, user } = useUser();
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    setAddress((prev) => {
      const next = { ...prev };
      if (!next.recipient && user.fullName) next.recipient = user.fullName;
      const clerkEmail = user.primaryEmailAddress?.emailAddress;
      if (!next.email && clerkEmail) next.email = clerkEmail;
      return next;
    });
  }, [isLoaded, isSignedIn, user, setAddress]);
}

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

  // Honor governs redemption. With it off the panel is simply absent (D-16).
  const { commerce } = useStoreConfig();

  // The cart's fulfilment mix, derived once per render (D-01, D-02).
  const isDigitalOnly = isDigitalOnlyCart(items);

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
  // Gift-card tender is applied on the payment step: `giftCardToken` is what
  // the shopper is typing, `appliedGiftCard` is the code the current quote was
  // priced with. Each apply re-quotes with a fresh request key; the server
  // releases the previous quote's hold (previousOrderId) before reserving.
  const [giftCardToken, setGiftCardToken] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState('');
  const lastQuoteOption = useRef<ShippingOption | undefined>(undefined);
  const [confirmedItems, setConfirmedItems] = useState<StableCartItem[]>([]);

  // Prefill a signed-in shopper's name and email from Clerk (D-03).
  useClerkAddressPrefill(setAddress);

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
      if (isDigitalOnly) {
        // A digital-only cart has nothing to ship: skip the shipping-options
        // lookup and the shipping-method panel entirely, and go straight to
        // payment with the digital method id and the address the shopper
        // just submitted (D-01).
        const billingAddress = {
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
        } as Address;
        setShippingAddress(billingAddress);
        await createPaymentIntent(
          {
            id: DIGITAL_SHIPPING_METHOD_ID,
            label: 'Digital delivery',
            cost: Money.zero(items[0]?.price.currency).toJSON(),
            estimatedDays: 0,
          },
          billingAddress
        );
        return;
      }

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
    selectedShippingOption: ShippingOption,
    addressOverride?: Address,
    tender?: { giftCardToken?: string }
  ) => {
    lastQuoteOption.current = selectedShippingOption;
    const token = tender?.giftCardToken?.trim() ?? '';
    try {
      // Create payment intent. Any earlier quote from this checkout is named
      // so the server releases its gift-card hold and cancels its intent.
      const res = await fetch('/api/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(projectCartLineForCheckout),
          shippingAddress: addressOverride ?? shippingAddress,
          shippingMethodId: selectedShippingOption.id,
          discountCodes: appliedDiscounts.map((discount) => discount.code),
          ...(token ? {
            giftCardToken: token,
            giftCardRequestKey: crypto.randomUUID(),
          } : {}),
          ...(orderId ? { previousOrderId: orderId } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to create payment intent');
      }

      const data = await res.json() as {
        noCash?: boolean;
        clientSecret: string;
        paymentIntentId: string;
        orderId: string;
        quote: AuthoritativeCheckoutQuote;
      };
      setOrderId(data.orderId);
      setTaxAmount(Money.fromMajor(data.quote.tax.amount, data.quote.tax.currency).toJSON());
      setAuthoritativeQuote(data.quote);
      setAppliedGiftCard(token);
      if (data.noCash) {
        // Snapshot into confirmedItems before the cart is cleared, so the
        // confirmation modal can still show what was bought (D-11).
        setConfirmedItems(items);
        clearCart();
        setGiftCardToken('');
        setCurrentStep('confirmation');
      } else {
        savePendingCheckout({ orderId: data.orderId, paymentIntentId: data.paymentIntentId });
        setClientSecret(data.clientSecret);
        setCurrentStep('payment');
      }

    } catch (err: unknown) {
      throw err;
    }
  };

  // Apply or remove a gift card on the payment step: re-quote in place and
  // swap the Stripe form to the new PaymentIntent for the remaining balance.
  const requoteWithGiftCard = async (token: string) => {
    const option = lastQuoteOption.current;
    if (!option) return;
    setIsLoading(true);
    setError('');
    try {
      await createPaymentIntent(option, undefined, token ? { giftCardToken: token } : undefined);
      if (!token) setGiftCardToken('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update the gift card');
    } finally {
      setIsLoading(false);
    }
  };
  const handleApplyGiftCard = () => requoteWithGiftCard(giftCardToken);
  const handleRemoveGiftCard = () => requoteWithGiftCard('');

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

      clearPendingCheckout(paymentIntentId);

      // Snapshot into confirmedItems before the cart is cleared, so the
      // confirmation modal can still show what was bought (D-11).
      setConfirmedItems(items);
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
        <h2 className="text-2xl font-bold text-foreground mb-4">Your cart is empty</h2>
        <p className="text-muted-foreground">Add some items to your cart to continue.</p>
      </div>
    );
  }

  // The step array and its index move together — a three-label bar with the
  // four-label index would fill the wrong circle (D-02, RESEARCH Pitfall 4).
  const progressBarProps = isDigitalOnly
    ? {
        steps: [...DIGITAL_CHECKOUT_STEPS],
        step: currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 1 : 2,
      }
    : {
        step: currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 2 : 3,
      };

  return (
    <div className="space-y-4">
      <ProgressBar {...progressBarProps} />

      {error && (
        <div className="bg-danger/10 border border-danger text-danger px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-col xl:grid xl:grid-cols-[1fr_1.6fr] gap-4 lg:gap-6 w-full">
        <div className="space-y-6 min-w-0">
          {/* Address Section */}
          {currentStep === 'shipping' ? (
            <div className="bg-surface-elevated p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-foreground">
                {isDigitalOnly ? 'Billing details' : 'Shipping Address'}
              </h3>
              <ShippingForm
                address={address}
                onChange={handleAddressChange}
                onSelectCountry={(value) =>
                  setAddress((prev) => ({ ...prev, country: value }))
                }
                onSubmit={handleAddressSubmit}
                error={null}
                {...(isDigitalOnly
                  ? {
                      heading: 'Billing details',
                      helperText: 'Nothing ships — we need this for your receipt and tax.',
                    }
                  : {})}
              />
            </div>
          ) : (currentStep === 'payment' || currentStep === 'confirmation') && shippingAddress && (
            <div className="bg-surface p-4 rounded-lg border-l-4 border-success">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-foreground">
                  {isDigitalOnly ? 'Billing details' : 'Shipping Address'}
                </h4>
                <button
                  onClick={handleBackToShipping}
                  className="text-sm text-success hover:text-success/90 font-medium"
                  disabled={isLoading}
                >
                  Edit
                </button>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{typeof shippingAddress.recipient === 'string' ? shippingAddress.recipient : 'Customer'}</p>
                <p>{typeof shippingAddress.line1 === 'string' ? shippingAddress.line1 : ''}</p>
                {shippingAddress.line2 && <p>{typeof shippingAddress.line2 === 'string' ? shippingAddress.line2 : ''}</p>}
                <p>{typeof shippingAddress.city === 'string' ? shippingAddress.city : ''}, {typeof shippingAddress.region === 'string' ? shippingAddress.region : ''} {typeof shippingAddress.postal_code === 'string' ? shippingAddress.postal_code : ''}</p>
              </div>
            </div>
          )}

          {/* Shipping Options Section */}
          {currentStep === 'shipping' && shippingOptions.length > 0 && (
            <div className="bg-surface-elevated p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Shipping Method</h3>
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
            <div className="bg-surface p-4 rounded-lg border-l-4 border-success">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-foreground">Shipping Method</h4>
                <button
                  onClick={handleBackToShipping}
                  className="text-sm text-success hover:text-success/90 font-medium"
                  disabled={isLoading}
                >
                  Edit
                </button>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{shippingOption.label}</p>
                <p className="text-muted-foreground">{Money.fromStored(shippingOption.cost).format()} - {shippingOption.estimatedDays ? `${shippingOption.estimatedDays} business days` : 'Standard delivery'}</p>
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
              items={confirmedItems}
            />
          )}
        </div>

        {/* Right Column: Order Summary & Payment */}
        <div className="space-y-6">
          <OrderSummary
            items={items}
            shippingOption={shippingOption}
            taxAmount={taxAmount}
            showDiscountInput={
              currentStep === 'shipping' && !authoritativeQuote && !clientSecret
            }
            giftCardCode={appliedGiftCard}
            authoritativeQuote={authoritativeQuote}
          />

          {/* Payment Form */}
          {currentStep === 'payment' && clientSecret && (
            <div className="bg-surface-elevated p-4 sm:p-6 rounded-xl w-full min-h-[400px]">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Payment Information</h3>
              {commerce.features.giftCardReconciliation && (
                <GiftCardApplyPanel
                  value={giftCardToken}
                  onChange={setGiftCardToken}
                  appliedCode={appliedGiftCard || undefined}
                  onApply={handleApplyGiftCard}
                  onRemove={handleRemoveGiftCard}
                  busy={isLoading}
                />
              )}
              <div className="w-full">
                {/* Keyed on the client secret: Elements cannot change secrets
                    after mount, so a re-quote must remount the form. */}
                <StripeProvider key={clientSecret} clientSecret={clientSecret}>
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
