import type { Product, ProductVariant } from '@/lib/types';
import { toWireMoney, type MachMoney } from '@/lib/money';

export type WireVariant = Omit<ProductVariant, 'price' | 'compare_at_price' | 'cost'> & {
  price: MachMoney;
  compare_at_price?: MachMoney;
  cost?: MachMoney;
};

export type WireProduct = Omit<Product, 'variants'> & { variants?: WireVariant[] };

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
