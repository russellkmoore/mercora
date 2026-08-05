import { Money } from '@/lib/money';
import type { Order } from '@/lib/types/order';

export interface GiftCardCheckoutCapability {
  /** Reserve authoritative tender and return bounded opaque state for re-verification. */
  resolveTender(args: {
    token?: string;
    currency: string;
    amountDue: Money;
  }): Promise<{ amount: Money; state?: unknown }>;
  /** Fail closed unless the persisted reservation still covers `expectedTender`. */
  verifyReservedTender(args: {
    order: Order;
    state?: unknown;
    expectedTender: Money;
  }): Promise<void>;
  /** Idempotently settle an already verified reservation after the paid CAS. */
  applyTender(args: { order: Order; state?: unknown }): Promise<void>;
}

export interface SubscriptionCheckoutCapability {
  validateCheckout(args: { productIds: string[]; customerId?: string }): Promise<void>;
  /** Idempotently apply paid-order subscription effects, keyed by order id. */
  orderPaid(order: Order): Promise<void>;
}

export interface CommerceCapabilities {
  giftCards: GiftCardCheckoutCapability;
  subscriptions: SubscriptionCheckoutCapability;
}

export const noOpCommerceCapabilities: CommerceCapabilities = {
  giftCards: {
    async resolveTender({ currency }) {
      return { amount: Money.zero(currency) };
    },
    async verifyReservedTender({ expectedTender }) {
      if (!expectedTender.isZero()) {
        throw new Error('No gift-card capability is configured for nonzero tender');
      }
    },
    async applyTender() {},
  },
  subscriptions: {
    async validateCheckout() {},
    async orderPaid() {},
  },
};
