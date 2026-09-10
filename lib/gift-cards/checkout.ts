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
