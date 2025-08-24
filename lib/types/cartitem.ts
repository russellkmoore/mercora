export interface CartItem {
  variantId: string; // Unique identifier for the variant in the cart
  productId: string; // Parent product reference (string for MACH)
  name: string;
  price: number;
  quantity: number;
  primaryImageUrl: string;
}
