import type { CartItem } from "@/lib/types/cartitem";
import { cartItemTotal, cartSubtotal } from "@/lib/money";

export function calculateCartTotal(items: CartItem[]) {
  return cartSubtotal(items).toJSON();
}

export function formatCartForCheckout(items: CartItem[]) {
  return items.map(({ productId, name, price, quantity }) => ({
    productId: productId,
    productName: name,
    price,
    quantity,
    lineTotal: cartItemTotal({ productId, name, price, quantity, variantId: '', primaryImageUrl: '' }).toJSON(),
  }));
}

export function isValidCartItem(item: unknown): item is CartItem {
  return (
    typeof item === 'object' && item !== null &&
    'variantId' in item && typeof item.variantId === 'string' &&
    'name' in item && typeof item.name === 'string' &&
    'price' in item && typeof item.price === 'object' && item.price !== null &&
    'quantity' in item && typeof item.quantity === 'number'
  );
}

export function validateCartItems(items: CartItem[]): boolean {
  return items.every(isValidCartItem);
}
