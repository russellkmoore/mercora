import { Money } from '@/lib/money';
import { parseGiftCardCustomization } from '@/lib/gift-cards/customization';
import type { GiftCardCustomization } from '@/lib/types/cartitem';
import type { OrderItem } from '@/lib/types/order';

/**
 * Selling is off, so a gift-card line cannot be priced or paid for (D-09).
 *
 * Distinct from `GiftCardTenderUnavailableError`, which means "that code did
 * not work". A shopper holding a stale gift-card line and a shopper typing a
 * bad code need different guidance, so `/api/payment-intent` maps this to its
 * own response code (D-16).
 *
 * It lives here rather than in `lib/gift-cards/capability.ts` because that
 * module pulls in the gift-card repository and key ring; the pricing service
 * and the payment-intent route both need this class without paying for either.
 */
export class GiftCardSalesDisabledError extends Error {
  constructor() {
    super("Gift-card sales are disabled");
    this.name = "GiftCardSalesDisabledError";
  }
}

/**
 * What to tell a caller whose cart holds a gift card the store has stopped
 * selling. It names the one action that clears the problem, because "check your
 * gift-card code" is useless advice to someone who has not typed one (D-16).
 *
 * Shared rather than duplicated so the browser client and an MCP agent are told
 * the same thing about the same state; the code beside it is what an agent
 * actually branches on.
 */
export const GIFT_CARD_SALES_DISABLED_MESSAGE =
  "Gift cards aren't on sale right now. Remove the gift card from your cart to continue checking out.";

export interface GiftCardOrderLineSnapshot {
  lineId: string;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  deliveryDate?: string;
  /** The catalog face value captured before discounts/tender. */
  faceValue: ReturnType<Money['toJSON']>;
}

export function checkoutGiftCardCustomization(value: unknown): GiftCardCustomization | undefined {
  return value === undefined ? undefined : parseGiftCardCustomization(value);
}

/** A gift-card line is explicit, digital, and carries only bounded recipient metadata. */
export function isGiftCardOrderLine(item: OrderItem): boolean {
  return item.fulfillment_type === 'digital' && item.gift_card !== undefined;
}

/**
 * The authoritative server-side signal for "this order is digital-only" —
 * the negation of this function's result. It has real consumers beyond the
 * invariant test: `app/api/payment-intent/route.ts` uses it to decide
 * whether to persist a shipping address and shipping method on the order.
 *
 * This is one half of a pinned pair (D-05). The other half is
 * `isDigitalOnlyCart` in `lib/checkout/digital-only.ts`, the client-side
 * signal for the same fact. The two must stay logically equivalent: for
 * any non-empty cart, `!hasPhysicalCheckoutLines(orderItems) ===
 * isDigitalOnlyCart(items)`.
 *
 * They read different fields because the client `CartItem` type carries no
 * `fulfillment_type` at all, so the client keys on the gift-card
 * customization instead of this field. The two agree today only because
 * `lib/services/checkout-pricing.ts` refuses to attach a
 * `giftCardCustomization` to any line that is not already digital and
 * non-shipping; that check is what keeps the client signal sufficient.
 *
 * `tests/unit/lib/checkout/digital-only.test.ts` is where the equivalence
 * is proven, fixture by fixture. If this predicate's semantics change,
 * update that test deliberately — do not let it drift.
 */
export function hasPhysicalCheckoutLines(items: OrderItem[]): boolean {
  return items.some((item) => item.fulfillment_type !== 'digital');
}

export function giftCardLineSnapshots(items: OrderItem[]): GiftCardOrderLineSnapshot[] {
  return items.flatMap((item) => {
    if (!isGiftCardOrderLine(item) || !item.id || !item.gift_card) return [];
    return [{
      lineId: item.id,
      recipientEmail: item.gift_card.recipientEmail,
      ...(item.gift_card.recipientName ? { recipientName: item.gift_card.recipientName } : {}),
      ...(item.gift_card.message ? { message: item.gift_card.message } : {}),
      ...(item.gift_card.deliveryDate ? { deliveryDate: item.gift_card.deliveryDate } : {}),
      faceValue: item.unit_price,
    }];
  });
}
