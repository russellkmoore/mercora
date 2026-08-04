import type { Product, ProductVariant } from '@/lib/types';
import { toWireMoney, type MachMoney } from '@/lib/money';

export type WireVariant = Omit<ProductVariant, 'price' | 'compare_at_price' | 'cost'> & {
  price: MachMoney;
  compare_at_price?: MachMoney;
  cost?: MachMoney;
};

export type WireProduct = Omit<Product, 'variants'> & { variants?: WireVariant[] };

/**
 * Remove extensible/internal containers from media before it crosses a public
 * storefront boundary. These objects can contain DAM identifiers, processing
 * metadata, or integration secrets and are not required to render a product.
 */
function toPublicMedia<T>(media: T): T {
  if (!media || typeof media !== 'object') return media;

  const {
    external_references: _externalReferences,
    metadata: _metadata,
    extensions: _extensions,
    ...publicMedia
  } = media as Record<string, unknown>;

  return publicMedia as T;
}

/** Project a product variant to the fields safe for storefront callers. */
function toPublicVariant(variant: ProductVariant): ProductVariant {
  const {
    cost: _cost,
    barcode: _barcode,
    inventory: _inventory,
    ...publicVariant
  } = variant;

  return {
    ...publicVariant,
    ...(publicVariant.media
      ? { media: publicVariant.media.map(toPublicMedia) }
      : {}),
  };
}

/**
 * Storefront-safe product projection. Admin callers should keep the original
 * object; public callers must pass through this function before serialization.
 */
export function toPublicProduct(product: Product): Product {
  const {
    external_references: _externalReferences,
    extensions: _extensions,
    ...publicProduct
  } = product;

  return {
    ...publicProduct,
    ...(publicProduct.primary_image
      ? { primary_image: toPublicMedia(publicProduct.primary_image) }
      : {}),
    ...(publicProduct.media
      ? { media: publicProduct.media.map(toPublicMedia) }
      : {}),
    variants: publicProduct.variants?.map(toPublicVariant),
  };
}

/** Convert stored minor-unit product money to MACH's decimal wire contract. */
export function toWireProduct(product: Product): WireProduct {
  return {
    ...product,
    variants: product.variants?.map(({ price, compare_at_price, cost, ...variant }) => ({
      ...variant,
      price: toWireMoney(price),
      ...(compare_at_price != null ? { compare_at_price: toWireMoney(compare_at_price) } : {}),
      ...(cost != null ? { cost: toWireMoney(cost) } : {}),
    })),
  };
}
