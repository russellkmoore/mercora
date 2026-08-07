import { Money } from '../money';
import { getCategoryDisplayName, listCategories } from '../models/mach/category';
import { listProducts } from '../models/mach/products';
import { allowedShippingCountries } from '../shipping/allowed-countries';
import type { Product } from '../types';
import { getSettings } from '../utils/settings';
import type { CapabilitiesResponse } from './types';

export function isPublicMcpProduct(product: Product): boolean {
  return product.status === 'active';
}

const MERCHANDISING_CATEGORIES = new Set([
  'featured',
  'sale',
  'on sale',
  'new',
  'new arrivals',
  'bestsellers',
  'best sellers',
]);

function variantPrices(product: Product): number[] {
  return (product.variants ?? []).flatMap((variant) => {
    try {
      const amount = Money.fromStored(variant.price ?? 0).toMach().amount;
      return amount > 0 ? [amount] : [];
    } catch {
      return [];
    }
  });
}

export async function getCatalogCapabilities(): Promise<CapabilitiesResponse> {
  const [categories, products, shippingSettings] = await Promise.all([
    listCategories(),
    listProducts({ status: ['active'] }),
    getSettings('shipping'),
  ]);
  const publicProducts = products.filter(isPublicMcpProduct);
  const categoryNames = categories.flatMap((category) => {
    const name = getCategoryDisplayName(category);
    return name ? [name] : [];
  });
  const priceRanges: Record<string, { min: number; max: number }> = {};

  for (const category of categories) {
    const name = getCategoryDisplayName(category);
    if (!name) continue;
    const prices = publicProducts
      .filter((product) => product.categories?.includes(category.id))
      .flatMap(variantPrices);
    if (prices.length) priceRanges[name] = { min: Math.min(...prices), max: Math.max(...prices) };
  }

  const specialties = categoryNames.filter(
    (name) => !MERCHANDISING_CATEGORIES.has(name.toLowerCase()),
  );
  return {
    categories: categoryNames,
    price_ranges: priceRanges,
    shipping_regions: allowedShippingCountries(shippingSettings),
    specialties,
  };
}

export function genericBundleSuggestions(distinctProducts: number): string[] {
  if (distinctProducts < 1) return [];
  return distinctProducts === 1
    ? ['Browse related catalog items that complement this product.']
    : ['Review the selected products together for complementary options.'];
}
