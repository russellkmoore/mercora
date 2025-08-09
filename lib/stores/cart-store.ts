/**
 * === Cart Store ===
 *
 * Zustand store for managing shopping cart state, checkout information,
 * and order processing. Provides persistent storage across browser sessions
 * with comprehensive cart management and checkout flow support.
 *
 * === Features ===
 * - **Persistent Cart**: Survives browser refreshes and session restarts
 * - **Item Management**: Add, remove, update quantities with smart merging
 * - **Checkout Integration**: Shipping, billing, and payment information
 * - **Tax Calculation**: Real-time tax computation and storage
 * - **Type Safety**: Fully typed with comprehensive interfaces
 * - **Performance**: Efficient state updates with minimal re-renders
 *
 * === Storage Strategy ===
 * Uses localStorage with 'cart-storage' key to persist cart state.
 * Automatically handles quantity consolidation and item deduplication.
 *
 * === Cart Operations ===
 * - **Add Item**: Merges with existing items or adds new ones
 * - **Remove Item**: Completely removes item from cart
 * - **Update Quantity**: Modifies item quantities with validation
 * - **Clear Cart**: Empties entire cart (used after order completion)
 *
 * === Checkout Flow ===
 * 1. Cart items and quantities
 * 2. Shipping address collection
 * 3. Billing address (can copy from shipping)  
 * 4. Shipping option selection
 * 5. Payment information entry
 * 6. Tax calculation and total computation
 *
 * === Usage ===
 * ```tsx
 * const { items, addItem, total } = useCartStore();
 * ```
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/lib/types/cartitem";
import type { Address } from "@/lib/types";
import type { BillingInfo } from "@/lib/types/billing";
import type { ShippingOption } from "@/lib/types/shipping";

/**
 * Cart store state interface defining all cart-related state and actions
 */
interface CartState {
  // === Cart Items ===
  /** Array of items currently in the shopping cart */
  items: CartItem[];

  // === Checkout Information ===
  /** Customer shipping address */
  shippingAddress?: Address;
  // Billing information for payment processing
  billingAddress?: Address;
  /** Selected shipping method and pricing */
  shippingOption?: ShippingOption;
  /** Payment and billing information */
  billingInfo?: BillingInfo;
  /** Calculated tax amount for the order */
  taxAmount?: number;

  // === Cart Management Actions ===
  /** Add an item to the cart (merges quantities if item exists) */
  addItem: (item: CartItem) => void;
  /** Remove an item completely from the cart */
  removeItem: (productId: number) => void;
  /** Update the quantity of a specific item */
  updateQuantity: (productId: number, quantity: number) => void;
  /** Clear all items from the cart */
  clearCart: () => void;
  /** Calculate total price of all items in cart */
  get total(): number;

  // === Checkout Information Setters ===
  /** Set customer shipping address */
  setShippingAddress: (address: Address) => void;
  /** Set billing address (can be different from shipping) */
  setBillingAddress: (address: Address) => void;
  /** Set selected shipping method and cost */
  setShippingOption: (option: ShippingOption | undefined) => void;
  /** Set payment/billing information */
  setBillingInfo: (info: BillingInfo) => void;
  /** Update calculated tax amount */
  setTaxAmount: (amount: number) => void;
}

/**
 * Main cart store with Zustand for state management
 * 
 * Automatically saves cart state to localStorage and provides intelligent
 * item management with quantity consolidation and checkout flow support.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      shippingAddress: undefined,
      billingAddress: undefined,
      shippingOption: undefined,
      billingInfo: undefined,
      taxAmount: undefined,

      /**
       * Add item to cart with intelligent quantity merging
       * If item already exists, increases quantity; otherwise adds new item
       */
      addItem: (item) => {
        const items = get().items;
        const existing = items.find((i) => i.productId === item.productId);

        if (existing) {
          // Merge quantities for existing items
          set({
            items: items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          // Add new item to cart
          set({ items: [...items, item] });
        }
      },

      /**
       * Remove item completely from cart by product ID
       */
      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.productId !== id) });
      },

      /**
       * Update item quantity with validation (removes if quantity < 1)
       */
      updateQuantity: (id, quantity) => {
        if (quantity < 1) {
          // Remove item if quantity becomes invalid
          get().removeItem(id);
        } else {
          // Update quantity for specified item
          set({
            items: get().items.map((i) =>
              i.productId === id ? { ...i, quantity } : i
            ),
          });
        }
      },

      /**
       * Calculate total price of all items in cart
       */
      get total() {
        const items = get().items;
        return items.reduce((total, item) => {
          return total + item.price * item.quantity;
        }, 0);
      },

      /**
       * Clear entire cart and reset all checkout information
       * Used after successful order completion or manual cart reset
       */
      clearCart: () =>
        set({
          items: [],
          shippingAddress: undefined,
          billingAddress: undefined,
          shippingOption: undefined,
          billingInfo: undefined,
          taxAmount: undefined,
        }),

      // === Checkout Information Setters ===
      /** Set customer shipping address */
      setShippingAddress: (address) => set({ shippingAddress: address }),
      
      /** Set billing address (can be different from shipping) */
      setBillingAddress: (address) => set({ billingAddress: address }),
      
      /** Set selected shipping method and cost */
      setShippingOption: (option) => set({ shippingOption: option }),
      
      /** Set payment/billing information */
      setBillingInfo: (info) => set({ billingInfo: info }),
      
      /** Update calculated tax amount */
      setTaxAmount: (amount) => set({ taxAmount: amount }),
    }),
    {
      name: 'cart-storage',
      skipHydration: true,
    }
  )
);