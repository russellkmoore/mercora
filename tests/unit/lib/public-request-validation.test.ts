import { describe, expect, it } from "vitest";

import {
  isBoundedArray,
  isBoundedString,
  isPlainRecord,
  isValidPublicCartItems,
} from "@/lib/public-request-validation";

const cartItem = {
  productId: "product-1",
  variantId: "variant-1",
  name: "Example",
  price: { amount: 1000, currency: "USD" },
  quantity: 1,
  primaryImageUrl: "",
};

describe("public request validation", () => {
  it("accepts plain records but rejects arrays and class instances", () => {
    expect(isPlainRecord({ value: 1 })).toBe(true);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(new Date())).toBe(false);
  });

  it("bounds strings and arrays", () => {
    expect(isBoundedString("value", 5)).toBe(true);
    expect(isBoundedString("value!", 5)).toBe(false);
    expect(isBoundedArray(Array.from({ length: 100 }), 100)).toBe(true);
    expect(isBoundedArray(Array.from({ length: 101 }), 100)).toBe(false);
  });

  it("accepts a bounded, well-shaped cart", () => {
    expect(isValidPublicCartItems([cartItem])).toBe(true);
  });

  it("rejects oversized or malformed carts", () => {
    expect(isValidPublicCartItems(Array.from({ length: 101 }, () => cartItem))).toBe(false);
    expect(isValidPublicCartItems([{ ...cartItem, productId: "x".repeat(129) }])).toBe(false);
    expect(isValidPublicCartItems([{ ...cartItem, quantity: Number.POSITIVE_INFINITY }])).toBe(false);
    expect(isValidPublicCartItems({ 0: cartItem })).toBe(false);
  });
});
