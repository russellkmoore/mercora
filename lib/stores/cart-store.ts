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
import type { CartItem, StableCartItem } from "@/lib/types/cartitem";
import type { Address } from "@/lib/types";
import type { BillingInfo } from "@/lib/types/billing";
import type { ShippingOption } from "@/lib/types/shipping";
import { Money, cartSubtotal, type StoredMoney } from "@/lib/money";
import {
  MAX_CART_LINE_QUANTITY,
  normalizeCartItemForStore,
  sameCartLineFacts,
} from "@/lib/gift-cards/line-identity";

/**
 * Interface for applied discount information
 */
export interface AppliedDiscount {
  promotionId: string;
  code: string;
  type: "cart" | "product" | "shipping";
  description: string;
  amount: StoredMoney;
  displayName: string; // e.g., "20% Off", "Free Shipping", "$10 Off"
}

/**
 * Cart store state interface defining all cart-related state and actions
 */
interface CartState {
  // === Cart Items ===
  /** Array of items currently in the shopping cart */
  items: StableCartItem[];

  // === Discount Information ===
  /** Array of applied discounts and their details */
  appliedDiscounts: AppliedDiscount[];
  /** Total discount amount across all types */
  totalDiscount: StoredMoney;

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
  taxAmount?: StoredMoney;

  // === Cart Management Actions ===
  /** Add an item to the cart (merges quantities if item exists) */
  addItem: (item: CartItem) => void;
  /** Remove an item completely from the cart */
  removeItem: (lineId: string) => void;
  /** Update the quantity of a specific item */
  updateQuantity: (lineId: string, quantity: number) => void;
  /** Clear all items from the cart */
  clearCart: () => void;
  /** Calculate total price of all items in cart */
  get total(): StoredMoney;

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
    subtotal: StoredMoney;
    cartDiscount: StoredMoney;
    shippingCost: StoredMoney;
    shippingDiscount: StoredMoney;
    tax: StoredMoney;
    total: StoredMoney;
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
  setTaxAmount: (amount: StoredMoney) => void;
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
      totalDiscount: Money.zero().toJSON(),
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
        const normalized = normalizeCartItemForStore(item);
        if (!normalized) return;
        const items = get().items;
        const existing = items.find((existingItem) => sameCartLineFacts(existingItem, normalized));

        if (existing) {
          const quantity = existing.quantity + normalized.quantity;
          if (quantity > MAX_CART_LINE_QUANTITY) return;
          set({
            items: items.map((i) =>
              i.lineId === existing.lineId
                ? { ...i, quantity }
                : i
            ),
          });
        } else {
          let lineId = normalized.lineId;
          let suffix = 2;
          while (items.some((existingItem) => existingItem.lineId === lineId)) {
            lineId = `${normalized.lineId}_${suffix}`;
            suffix += 1;
          }
          set({ items: [...items, { ...normalized, lineId }] });
        }
      },

      /**
       * Remove item completely from cart by stable line ID
       */
      removeItem: (lineId) => {
        set({ items: get().items.filter((i) => i.lineId !== lineId) });
      },

      /**
       * Update item quantity with validation (removes if quantity < 1)
       */
      updateQuantity: (lineId, quantity) => {
        if (quantity < 1) {
          // Remove item if quantity becomes invalid
          get().removeItem(lineId);
        } else if (Number.isSafeInteger(quantity) && quantity <= MAX_CART_LINE_QUANTITY) {
          // Update quantity for specified item
          set({
            items: get().items.map((i) =>
              i.lineId === lineId ? { ...i, quantity } : i
            ),
          });
        }
      },

      /**
       * Calculate total price of all items in cart
       */
      get total() { return cartSubtotal(get().items).toJSON(); },

      /**
       * Clear entire cart and reset all checkout information
       * Used after successful order completion or manual cart reset
       */
      clearCart: () =>
        set({
          items: [],
          appliedDiscounts: [],
          totalDiscount: Money.zero().toJSON(),
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
          const newTotalDiscount = sumDiscounts(newDiscounts).toJSON();
          
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
        const newTotalDiscount = sumDiscounts(newDiscounts).toJSON();
        
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
        totalDiscount: Money.zero().toJSON(),
      }),

      /**
       * Update shipping discount amounts when shipping option changes
       * Recalculates shipping discounts based on current shipping cost
       */
      updateShippingDiscounts: () => {
        const state = get();
        const shippingCost = state.shippingOption ? Money.fromStored(state.shippingOption.cost) : Money.zero();
        
        const updatedDiscounts = state.appliedDiscounts.map(discount => {
          if (discount.type === 'shipping') {
            // Get the discount details from the displayName to determine type
            if (discount.displayName.includes('Free Shipping') || discount.displayName.includes('100%')) {
              // Free shipping (100% off)
              return { ...discount, amount: shippingCost.toJSON() };
            } else if (discount.displayName.includes('%')) {
              // Percentage discount
              const match = discount.displayName.match(/(\d+)%/);
              if (match) {
                const percentage = parseInt(match[1]);
                return { ...discount, amount: shippingCost.applyRate((percentage / 100).toString()).toJSON() };
              }
            } else if (discount.displayName.includes('$')) {
              // Fixed amount discount
              const match = discount.displayName.match(/\$(\d+)/);
              if (match) {
                const fixedAmount = Money.fromMajor(match[1]);
                return { ...discount, amount: shippingCost.lte(fixedAmount) ? shippingCost.toJSON() : fixedAmount.toJSON() };
              }
            }
          }
          return discount;
        });

        const newTotalDiscount = sumDiscounts(updatedDiscounts).toJSON();
        
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
        const subtotal = cartSubtotal(state.items);
        const shippingCost = state.shippingOption ? Money.fromStored(state.shippingOption.cost) : Money.zero(subtotal.currency);
        
        // Separate cart and shipping discounts
        const cartDiscounts = state.appliedDiscounts.filter(d => d.type === 'cart');
        const shippingDiscounts = state.appliedDiscounts.filter(d => d.type === 'shipping');
        
        const cartDiscountAmount = sumDiscounts(cartDiscounts, subtotal.currency);
        const shippingDiscountAmount = sumDiscounts(shippingDiscounts, subtotal.currency);
        
        // Apply discounts with minimums of 0
        const discountedSubtotal = subtotal.lte(cartDiscountAmount) ? Money.zero(subtotal.currency) : subtotal.subtract(cartDiscountAmount);
        const discountedShipping = shippingCost.lte(shippingDiscountAmount) ? Money.zero(subtotal.currency) : shippingCost.subtract(shippingDiscountAmount);
        
        // Calculate tax on discounted amounts
        const tax = state.taxAmount ? Money.fromStored(state.taxAmount, subtotal.currency) : Money.zero(subtotal.currency);
        const total = discountedSubtotal.add(discountedShipping).add(tax);
        
        return {
          subtotal: subtotal.toJSON(),
          cartDiscount: cartDiscountAmount.toJSON(),
          shippingCost: shippingCost.toJSON(),
          shippingDiscount: shippingDiscountAmount.toJSON(),
          tax: tax.toJSON(),
          total: total.toJSON(),
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
      setTaxAmount: (amount) => set({ taxAmount: Money.fromStored(amount).toJSON() }),
    }),
    {
      name: 'cart-storage',
      skipHydration: true,
      version: 2,
      migrate: (persistedState: unknown) => migrateCartState(persistedState),
    }
  )
);

function sumDiscounts(discounts: AppliedDiscount[], currency = 'USD'): Money {
  return discounts.reduce((total, discount) => total.add(Money.fromStored(discount.amount, currency)), Money.zero(currency));
}

export function migrateCartState(persistedState: unknown): unknown {
  if (!persistedState || typeof persistedState !== 'object') return persistedState;
  const state = persistedState as { items?: unknown[]; taxAmount?: unknown; totalDiscount?: unknown; appliedDiscounts?: unknown[]; shippingOption?: { cost?: unknown } };
  const toStored = (value: unknown): StoredMoney => typeof value === 'number' ? Money.fromMajor(value).toJSON() : Money.fromStored(value).toJSON();
  return {
    ...state,
    items: state.items?.reduce<StableCartItem[]>((items, item) => {
      if (!item || typeof item !== 'object') return items;
      const cartItem = item as { price?: unknown };
      let normalized: StableCartItem | null = null;
      try {
        normalized = normalizeCartItemForStore({
          ...cartItem,
          ...(cartItem.price !== undefined && { price: toStored(cartItem.price) }),
        });
      } catch {
        return items;
      }
      if (!normalized) return items;
      const existing = items.find((candidate) => sameCartLineFacts(candidate, normalized));
      if (existing) {
        existing.quantity = Math.min(
          MAX_CART_LINE_QUANTITY,
          existing.quantity + normalized.quantity,
        );
        return items;
      }
      let lineId = normalized.lineId;
      let suffix = 2;
      while (items.some((candidate) => candidate.lineId === lineId)) {
        lineId = `${normalized.lineId}_${suffix}`;
        suffix += 1;
      }
      items.push({ ...normalized, lineId });
      return items;
    }, []),
    taxAmount: state.taxAmount === undefined ? undefined : toStored(state.taxAmount),
    totalDiscount: state.totalDiscount === undefined ? Money.zero().toJSON() : toStored(state.totalDiscount),
    appliedDiscounts: state.appliedDiscounts?.map((discount) => {
      if (!discount || typeof discount !== 'object') return discount;
      const applied = discount as { amount?: unknown };
      return { ...applied, ...(applied.amount !== undefined && { amount: toStored(applied.amount) }) };
    }),
    shippingOption: state.shippingOption ? { ...state.shippingOption, ...(state.shippingOption.cost !== undefined && { cost: toStored(state.shippingOption.cost) }) } : undefined,
  };
}
