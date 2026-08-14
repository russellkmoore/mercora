import { afterEach, describe, expect, it } from "vitest";
import { useCartUIStore } from "@/lib/stores/cart-ui-store";

describe("cart UI store", () => {
  afterEach(() => useCartUIStore.setState({ isOpen: false }));

  it("coordinates open and close without persistence", () => {
    expect(useCartUIStore.getState().isOpen).toBe(false);
    useCartUIStore.getState().openCart();
    expect(useCartUIStore.getState().isOpen).toBe(true);
    useCartUIStore.getState().closeCart();
    expect(useCartUIStore.getState().isOpen).toBe(false);
  });
});
