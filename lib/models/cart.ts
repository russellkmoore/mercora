import type { CartItem } from "@/lib/types/cartitem";

export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function formatCartForCheckout(items: CartItem[]) {
  return items.map(({ productId, name, price, quantity }) => ({
    productId: productId,
    productName: name,
    price,
    quantity,
    lineTotal: price * quantity,
  }));
}

export function isValidCartItem(item: any): item is CartItem {
  return (
    item &&
    typeof item.id === "number" &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof item.quantity === "number"
  );
}

export function validateCartItems(items: CartItem[]): boolean {
  return items.every(isValidCartItem);
}