import type { StoredMoney } from '@/lib/money';

export interface GiftCardCustomization {
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  /** Calendar date in canonical YYYY-MM-DD form. */
  deliveryDate?: string;
}

export interface CartItem {
  /** Assigned by the cart from immutable, canonical line facts. */
  lineId?: string;
  variantId: string;
  productId: string; // Parent product reference (string for MACH)
  name: string;
  /** Persisted minor-unit price, not a decimal display value. */
  price: StoredMoney;
  quantity: number;
  primaryImageUrl: string;
  giftCardCustomization?: GiftCardCustomization;
}

export type StableCartItem = CartItem & { lineId: string };
