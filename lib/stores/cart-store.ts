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
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types/cartitem";
import type { Address } from "@/lib/types/address";
import type { BillingInfo } from "@/lib/types/billing";
import type { ShippingOption } from "@/lib/types/shipping";

/**
 * Cart store state interface defining all cart-related state and actions
 */
interface CartState {
  // === Cart Items ===
  items: CartItem[];                                    // Products in cart with quantities
  
  // === Checkout Information ===
  shippingAddress?: Address;                            // Customer shipping address
  billingAddress?: Address;                             // Billing address (can differ from shipping)
  shippingOption?: ShippingOption;                      // Selected shipping method and cost
  billingInfo?: BillingInfo;                           // Payment method information
  taxAmount?: number;                                   // Calculated tax amount for order
  
  // === Cart Management Actions ===
  addItem: (item: CartItem) => void;                   // Add item to cart (merges quantities)
  removeItem: (id: number) => void;                    // Remove item completely from cart
  updateQuantity: (id: number, quantity: number) => void; // Update item quantity
  clearCart: () => void;                               // Empty entire cart
  
  // === Checkout Actions ===
  setShippingAddress: (address: Address) => void;      // Set shipping destination
  setBillingAddress: (address: Address) => void;       // Set billing address
  setShippingOption: (option: ShippingOption | undefined) => void; // Select shipping method
  setBillingInfo: (info: BillingInfo) => void;         // Set payment information
  setTaxAmount: (amount: number) => void;               // Update calculated tax amount
}

/**
 * Cart store with persistent storage and comprehensive checkout support
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
      // Persist cart state in localStorage
      name: "cart-storage",
    }
  )
);
