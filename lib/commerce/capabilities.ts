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
  /** Idempotently apply paid-order subscription effects, keyed by order id. */
  orderPaid(order: Order): Promise<void>;
}

export interface CommerceFeatureFlags {
  giftCards: boolean;
  /** Customer-facing acquisition/UI. Safe rollback switch for new sales. */
  subscriptionAcquisition: boolean;
  /** Existing lifecycle/invoice reconciliation. Remains on after first sale. */
  subscriptionReconciliation: boolean;
}

export interface CommerceCapabilityFactories {
  giftCards?: () => GiftCardCheckoutCapability;
  subscriptions?: () => SubscriptionCheckoutCapability;
}

export class CommerceCapabilityConfigurationError extends Error {}

/** Protected order metadata written only while reconciling a verified subscription invoice order. */
export const SUBSCRIPTION_ACQUISITION_EXTENSION = "subscription_acquisition_id";

export function subscriptionAcquisitionIdFromOrder(order: Order): string | undefined {
  const value = order.extensions?.[SUBSCRIPTION_ACQUISITION_EXTENSION];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length < 1 || value.length > 128 || value.trim() !== value) {
    throw new Error("Paid order contains an invalid subscription acquisition marker");
  }
  return value;
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
    async orderPaid(order) {
      if (subscriptionAcquisitionIdFromOrder(order)) {
        throw new Error("Subscription capability is disabled for an applicable paid order");
      }
    },
  },
};

/**
 * Lazily resolve optional capabilities. Disabled features always return the
 * inert implementation without invoking a factory, so they perform no provider
 * or database setup. Enabling a feature without its implementation fails at
 * the configuration boundary instead of silently degrading to a no-op.
 */
export function resolveCommerceCapabilities(
  flags: CommerceFeatureFlags,
  factories: CommerceCapabilityFactories = {},
): CommerceCapabilities {
  const resolve = <T>(
    enabled: boolean,
    factory: (() => T) | undefined,
    fallback: T,
    name: string,
  ): T => {
    if (!enabled) return fallback;
    if (!factory) throw new CommerceCapabilityConfigurationError(
      `${name} is enabled but no capability implementation is configured`,
    );
    return factory();
  };

  if (flags.subscriptionAcquisition && !flags.subscriptionReconciliation) {
    throw new CommerceCapabilityConfigurationError(
      "Subscription acquisition requires lifecycle and invoice reconciliation",
    );
  }

  const subscriptions = resolve(
    flags.subscriptionAcquisition || flags.subscriptionReconciliation,
    factories.subscriptions,
    noOpCommerceCapabilities.subscriptions,
    "Subscriptions",
  );
  const gatedSubscriptions: SubscriptionCheckoutCapability = subscriptions === noOpCommerceCapabilities.subscriptions
    ? subscriptions
    : {
        async orderPaid(order) {
          // Core currently stages this optional effect unconditionally. Ordinary
          // orders must not wake the subscription database/provider boundary.
          if (!subscriptionAcquisitionIdFromOrder(order)) return;
          await subscriptions.orderPaid(order);
        },
      };

  return {
    giftCards: resolve(
      flags.giftCards,
      factories.giftCards,
      noOpCommerceCapabilities.giftCards,
      "Gift cards",
    ),
    subscriptions: gatedSubscriptions,
  };
}
