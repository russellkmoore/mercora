/**
 * === Digital-only checkout ===
 *
 * The three facts that define an all-digital checkout, in one module rather
 * than scattered as inline literals across the CheckoutClient step machine
 * (D-01, D-02, assumption-delta: promote).
 *
 * The client cart type (`CartItem`) carries no fulfilment field, and gift
 * cards are the only digital product in the catalogue today — so "every
 * line carries a giftCardCustomization" is the signal this module reads.
 * The paired invariant test alongside `isDigitalOnlyCart` (checked against
 * the server's `hasPhysicalCheckoutLines`) is what will fail loudly on the
 * day a non-gift-card digital product ships and this signal stops being
 * sufficient on its own.
 */

/** The id the pricing service already assigns to a cart with no physical
 * lines (`checkout-pricing.ts`); the client echoes this server-owned value
 * rather than inventing its own. */
export const DIGITAL_SHIPPING_METHOD_ID = 'digital';

/** The digital-only progress-bar labels, in order (Copywriting Contract). */
export const DIGITAL_CHECKOUT_STEPS: readonly string[] = [
  'Billing details',
  'Payment',
  'Order Submitted',
];

/**
 * True when every line in a non-empty cart carries a gift-card
 * customization. An empty cart is not digital-only — it hits the existing
 * empty-cart branch before any step UI renders.
 */
export function isDigitalOnlyCart(
  items: readonly { giftCardCustomization?: unknown }[]
): boolean {
  return items.length > 0 && items.every((item) => item.giftCardCustomization !== undefined);
}
