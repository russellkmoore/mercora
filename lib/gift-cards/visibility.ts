/**
 * === Gift-card visibility ===
 *
 * One place that answers "should a shopper see the gift card right now", so
 * every public surface asks the same question the same way instead of
 * re-deriving `product.type === 'gift_card'` inline (D-14).
 *
 * Three facts shape this module:
 *
 * 1. The signal is the catalogue product type, never the product's URL handle
 *    and never its id (D-08). A handle list goes stale the moment someone
 *    renames the product; an id list goes stale the moment the catalogue is
 *    reseeded. The `type` column is what the pricing service already keys on
 *    (`lib/services/checkout-pricing.ts`), and `toPublicProduct` preserves it,
 *    so the same predicate works on stored products and on the public
 *    projection. The paired unit test pins both decoys.
 *
 * 2. It is applied at public call sites only — never inside `listProducts`,
 *    `searchProducts` or `getProductsByCategory` (D-14). `/admin/products`
 *    shares those functions and Phase 14's gift-card management depends on the
 *    card staying visible there. Filtering in the model layer would hide the
 *    product from the very people who administer it.
 *
 * 3. Visibility is a presentation decision driven by the configured flags;
 *    whether outstanding balances are honored is a separate, money decision
 *    made elsewhere (D-10). A store can hide every gift-card surface and still
 *    redeem a card someone already paid for.
 *
 * Flag vocabulary (D-01): `giftCardAcquisition` is **sell**,
 * `giftCardReconciliation` is **honor**.
 */

/** The catalogue `product.type` value that marks a gift card (D-08). */
export const GIFT_CARD_PRODUCT_TYPE = 'gift_card';

/** The two `commerce.features` booleans these predicates read. */
export interface GiftCardVisibilityFeatures {
  /** Sell — `STORE_FEATURE_GIFT_CARD_ACQUISITION`. */
  giftCardAcquisition: boolean;
  /** Honor — `STORE_FEATURE_GIFT_CARD_RECONCILIATION`. */
  giftCardReconciliation: boolean;
}

/**
 * True when the gift card must not appear on any browse surface. A store that
 * has stopped selling hides the card whether or not it still honors balances
 * (D-07) — there is nothing to add to a cart either way.
 */
export function hidesGiftCardsFromListings(
  features: Pick<GiftCardVisibilityFeatures, 'giftCardAcquisition'>,
): boolean {
  return !features.giftCardAcquisition;
}

/**
 * True unless this product is a gift card while selling is off. A product with
 * no type, or a null type, is never hidden — absence of the signal is not the
 * signal.
 */
export function isPubliclyVisibleProduct(
  product: { type?: string | null },
  features: Pick<GiftCardVisibilityFeatures, 'giftCardAcquisition'>,
): boolean {
  if (product.type !== GIFT_CARD_PRODUCT_TYPE) return true;
  return !hidesGiftCardsFromListings(features);
}

/**
 * The listing projection: the same array minus anything currently hidden.
 * Generic so call sites keep their concrete product type, and item identity is
 * preserved — this filters, it does not reshape.
 */
export function filterListedProducts<T extends { type?: string | null }>(
  products: readonly T[],
  features: Pick<GiftCardVisibilityFeatures, 'giftCardAcquisition'>,
): T[] {
  return products.filter((product) => isPubliclyVisibleProduct(product, features));
}

/**
 * True only when both flags are off — the state where gift cards do not exist
 * for a visitor at all (D-02). This is the predicate the 404 gates use (D-10),
 * distinct from `hidesGiftCardsFromListings`: with sell off and honor on the
 * card is absent from listings but a direct link still renders (D-07).
 */
export function giftCardSurfacesHidden(features: GiftCardVisibilityFeatures): boolean {
  return !features.giftCardAcquisition && !features.giftCardReconciliation;
}
