import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  resolveCommerceCapabilities,
  noOpCommerceCapabilities,
  type CommerceCapabilities,
  type CommerceFeatureFlags,
} from '@/lib/commerce/capabilities';
import { createRuntimeGiftCardCapabilityFactory } from '@/lib/gift-cards/runtime';
import { honorIsEffectivelyOn } from '@/lib/gift-cards/honor-guard';

type RuntimeEnvironment = Record<string, unknown>;

function enabled(environment: RuntimeEnvironment, key: string): boolean {
  return typeof environment[key] === 'string' && environment[key].trim().toLowerCase() === 'true';
}

/**
 * Resolve optional commerce features from request-scoped Worker bindings.
 * This deliberately avoids build-time `process.env` capture and never touches
 * the gift-card key ring unless either gift-card capability is enabled.
 */
export async function resolveRuntimeCommerceCapabilities(): Promise<CommerceCapabilities> {
  const { env } = await getCloudflareContext({ async: true });
  const environment = env as unknown as RuntimeEnvironment;
  const sellsGiftCards = enabled(environment, 'STORE_FEATURE_GIFT_CARD_ACQUISITION');
  const honorsGiftCards = enabled(environment, 'STORE_FEATURE_GIFT_CARD_RECONCILIATION');

  // Honoring keeps running while a shopper may still hold a balance, even
  // after the honor flag is turned off (D-04). One `admin_settings` row
  // answers that — never a balance query on the request path (D-06).
  //
  // `!sellsGiftCards` is the whole point of the guard, not a detail of it. If
  // the override ran while selling is on, a deploy configured to sell cards it
  // cannot redeem would resolve cleanly instead of throwing, and GCF-04 would
  // be silently gone. Short-circuiting also means the row is never read while
  // honoring is already configured on.
  const honorsGiftCardsEffectively = honorsGiftCards || (
    !sellsGiftCards
    && await honorIsEffectivelyOn(
      environment.DB as D1Database,
      false,
      Math.floor(Date.now() / 1000),
    // `honorIsEffectivelyOn` already answers "keep honoring" on a failed read.
    // Repeating that here keeps the fail-safe direction true at the call site
    // even if that internal guarantee is ever refactored away.
    ).catch(() => true)
  );

  const flags: CommerceFeatureFlags = {
    giftCardAcquisition: sellsGiftCards,
    giftCardReconciliation: honorsGiftCardsEffectively,
    subscriptionAcquisition: enabled(environment, 'STORE_FEATURE_SUBSCRIPTION_ACQUISITION'),
    subscriptionReconciliation: enabled(environment, 'STORE_FEATURE_SUBSCRIPTION_RECONCILIATION'),
  };
  return resolveCommerceCapabilities(flags, {
    giftCards: createRuntimeGiftCardCapabilityFactory(),
    // Subscription runtime composition remains owned by O06. Supplying its
    // inert boundary preserves ordinary checkout while an unsupported marked
    // subscription order still fails closed in the capability itself.
    subscriptions: () => noOpCommerceCapabilities.subscriptions,
  });
}
