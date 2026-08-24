import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  resolveCommerceCapabilities,
  noOpCommerceCapabilities,
  type CommerceCapabilities,
  type CommerceFeatureFlags,
} from '@/lib/commerce/capabilities';
import { createRuntimeGiftCardCapabilityFactory } from '@/lib/gift-cards/runtime';

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
  const flags: CommerceFeatureFlags = {
    giftCardAcquisition: enabled(environment, 'STORE_FEATURE_GIFT_CARD_ACQUISITION'),
    giftCardReconciliation: enabled(environment, 'STORE_FEATURE_GIFT_CARD_RECONCILIATION'),
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
