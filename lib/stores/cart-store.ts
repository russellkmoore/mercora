import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types/cartitem";
import type { Address } from "@/lib/types/address";
import type { BillingInfo } from "@/lib/types/billing";
import type { ShippingOption } from "@/lib/types/shipping";

interface CartState {
  items: CartItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  shippingOption?: ShippingOption;
  billingInfo?: BillingInfo;
  taxAmount?: number;

  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;

  setShippingAddress: (address: Address) => void;
  setBillingAddress: (address: Address) => void;
  setShippingOption: (option: ShippingOption | undefined) => void;
  setBillingInfo: (info: BillingInfo) => void;
  setTaxAmount: (amount: number) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      shippingAddress: undefined,
      billingAddress: undefined,
      shippingOption: undefined,
      billingInfo: undefined,
      taxAmount: undefined,

      addItem: (item) => {
        const items = get().items;
        const existing = items.find((i) => i.productId === item.productId);

        if (existing) {
          set({
            items: items.map((i) =>
              i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.productId !== id) });
      },

      updateQuantity: (id, quantity) => {
        if (quantity < 1) {
          get().removeItem(id);
        } else {
          set({
            items: get().items.map((i) =>
              i.productId === id ? { ...i, quantity } : i
            ),
          });
        }
      },

      clearCart: () =>
        set({
          items: [],
          shippingAddress: undefined,
          billingAddress: undefined,
          shippingOption: undefined,
          billingInfo: undefined,
          taxAmount: undefined,
        }),

      setShippingAddress: (address) => set({ shippingAddress: address }),
      setBillingAddress: (address) => set({ billingAddress: address }),
      setShippingOption: (option) => set({ shippingOption: option }),
      setBillingInfo: (info) => set({ billingInfo: info }),
      setTaxAmount: (amount) => set({ taxAmount: amount }),
    }),
    {
      name: "cart-storage",
    }
  )
);
