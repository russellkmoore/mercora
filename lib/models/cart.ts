import type { CartItem } from "@/lib/types/cartitem";
import { cartItemTotal, cartSubtotal, Money } from "@/lib/money";

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
  if (
    typeof item !== 'object' || item === null ||
    !('productId' in item) || typeof item.productId !== 'string' ||
    !('variantId' in item) || typeof item.variantId !== 'string' ||
    !('name' in item) || typeof item.name !== 'string' ||
    !('primaryImageUrl' in item) || typeof item.primaryImageUrl !== 'string' ||
    !('quantity' in item) || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
    !('price' in item)
  ) {
    return false;
  }

  try {
    Money.fromStored(item.price);
    return true;
  } catch {
    return false;
  }
}

export function validateCartItems(items: CartItem[]): boolean {
  return items.every(isValidCartItem);
}
