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
 * Interface for applied discount information
 */
export interface AppliedDiscount {
  promotionId: string;
  code: string;
  type: "cart" | "product" | "shipping";
  description: string;
  amount: number;
  displayName: string; // e.g., "20% Off", "Free Shipping", "$10 Off"
}

/**
 * Cart store state interface defining all cart-related state and actions
 */
interface CartState {
  // === Cart Items ===
  /** Array of items currently in the shopping cart */
  items: CartItem[];

  // === Discount Information ===
  /** Array of applied discounts and their details */
  appliedDiscounts: AppliedDiscount[];
  /** Total discount amount across all types */
  totalDiscount: number;

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
  removeItem: (variantId: string) => void;
  /** Update the quantity of a specific item */
  updateQuantity: (variantId: string, quantity: number) => void;
  /** Clear all items from the cart */
  clearCart: () => void;
  /** Calculate total price of all items in cart */
  get total(): number;

  // === Discount Management Actions ===
  /** Apply a discount to the cart */
  applyDiscount: (discount: AppliedDiscount) => void;
  /** Remove a specific discount by promotion ID */
  removeDiscount: (promotionId: string) => void;
  /** Clear all applied discounts */
  clearDiscounts: () => void;
  /** Update shipping discount amounts when shipping option changes */
  updateShippingDiscounts: () => void;
  /** Calculate order totals with discounts applied */
  calculateTotals: () => {
    subtotal: number;
    cartDiscount: number;
    shippingCost: number;
    shippingDiscount: number;
    tax: number;
    total: number;
  };

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
      appliedDiscounts: [],
      totalDiscount: 0,
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
        const existing = items.find((i) => i.variantId === item.variantId);

        if (existing) {
          // Merge quantities for existing items
          set({
            items: items.map((i) =>
              i.variantId === item.variantId
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
       * Remove item completely from cart by variant ID
       */
      removeItem: (variantId) => {
        set({ items: get().items.filter((i) => i.variantId !== variantId) });
      },

      /**
       * Update item quantity with validation (removes if quantity < 1)
       */
      updateQuantity: (variantId, quantity) => {
        if (quantity < 1) {
          // Remove item if quantity becomes invalid
          get().removeItem(variantId);
        } else {
          // Update quantity for specified item
          set({
            items: get().items.map((i) =>
              i.variantId === variantId ? { ...i, quantity } : i
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
          appliedDiscounts: [],
          totalDiscount: 0,
          shippingAddress: undefined,
          billingAddress: undefined,
          shippingOption: undefined,
          billingInfo: undefined,
          taxAmount: undefined,
        }),

      // === Discount Management Actions ===
      
      /**
       * Apply a discount to the cart
       * Prevents duplicate discounts and updates total discount amount
       */
      applyDiscount: (discount) => {
        const state = get();
        const existing = state.appliedDiscounts.find(d => d.promotionId === discount.promotionId);
        
        if (!existing) {
          const newDiscounts = [...state.appliedDiscounts, discount];
          const newTotalDiscount = newDiscounts.reduce((sum, d) => sum + d.amount, 0);
          
          set({
            appliedDiscounts: newDiscounts,
            totalDiscount: newTotalDiscount,
          });
        }
      },

      /**
       * Remove a specific discount by promotion ID
       */
      removeDiscount: (promotionId) => {
        const state = get();
        const newDiscounts = state.appliedDiscounts.filter(d => d.promotionId !== promotionId);
        const newTotalDiscount = newDiscounts.reduce((sum, d) => sum + d.amount, 0);
        
        set({
          appliedDiscounts: newDiscounts,
          totalDiscount: newTotalDiscount,
        });
      },

      /**
       * Clear all applied discounts
       */
      clearDiscounts: () => set({
        appliedDiscounts: [],
        totalDiscount: 0,
      }),

      /**
       * Update shipping discount amounts when shipping option changes
       * Recalculates shipping discounts based on current shipping cost
       */
      updateShippingDiscounts: () => {
        const state = get();
        const shippingCost = state.shippingOption?.cost || 0;
        
        const updatedDiscounts = state.appliedDiscounts.map(discount => {
          if (discount.type === 'shipping') {
            // Get the discount details from the displayName to determine type
            if (discount.displayName.includes('Free Shipping') || discount.displayName.includes('100%')) {
              // Free shipping (100% off)
              return { ...discount, amount: shippingCost };
            } else if (discount.displayName.includes('%')) {
              // Percentage discount
              const match = discount.displayName.match(/(\d+)%/);
              if (match) {
                const percentage = parseInt(match[1]);
                return { ...discount, amount: shippingCost * (percentage / 100) };
              }
            } else if (discount.displayName.includes('$')) {
              // Fixed amount discount
              const match = discount.displayName.match(/\$(\d+)/);
              if (match) {
                const fixedAmount = parseInt(match[1]);
                return { ...discount, amount: Math.min(fixedAmount, shippingCost) };
              }
            }
          }
          return discount;
        });

        const newTotalDiscount = updatedDiscounts.reduce((sum, d) => sum + d.amount, 0);
        
        set({
          appliedDiscounts: updatedDiscounts,
          totalDiscount: newTotalDiscount,
        });
      },

      /**
       * Calculate order totals with discounts applied
       * Returns breakdown of all pricing components
       */
      calculateTotals: () => {
        const state = get();
        const subtotal = state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
        const shippingCost = state.shippingOption?.cost || 0;
        
        // Separate cart and shipping discounts
        const cartDiscounts = state.appliedDiscounts.filter(d => d.type === 'cart');
        const shippingDiscounts = state.appliedDiscounts.filter(d => d.type === 'shipping');
        
        const cartDiscountAmount = cartDiscounts.reduce((sum, d) => sum + d.amount, 0);
        const shippingDiscountAmount = shippingDiscounts.reduce((sum, d) => sum + d.amount, 0);
        
        // Apply discounts with minimums of 0
        const discountedSubtotal = Math.max(0, subtotal - cartDiscountAmount);
        const discountedShipping = Math.max(0, shippingCost - shippingDiscountAmount);
        
        // Calculate tax on discounted amounts
        const tax = state.taxAmount || 0;
        const total = discountedSubtotal + discountedShipping + tax;
        
        return {
          subtotal,
          cartDiscount: cartDiscountAmount,
          shippingCost,
          shippingDiscount: shippingDiscountAmount,
          tax,
          total,
        };
      },

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