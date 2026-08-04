import type { StoredMoney } from '@/lib/money';

export interface CartItem {
  variantId: string; // Unique identifier for the variant in the cart
  productId: string; // Parent product reference (string for MACH)
  name: string;
  /** Persisted minor-unit price, not a decimal display value. */
  price: StoredMoney;
  quantity: number;
  primaryImageUrl: string;
}
