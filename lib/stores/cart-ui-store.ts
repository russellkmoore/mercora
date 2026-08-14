import { create } from "zustand";

type CartUIState = {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  setCartOpen: (open: boolean) => void;
};

/** Transient view state. Deliberately not persisted with cart contents. */
export const useCartUIStore = create<CartUIState>((set) => ({
  isOpen: false,
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  setCartOpen: (isOpen) => set({ isOpen }),
}));
