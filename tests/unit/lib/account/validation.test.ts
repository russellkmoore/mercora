import { describe, expect, it } from "vitest";
import { parseAddressInput, parseProfileInput } from "@/lib/account/validation";

describe("account input validation", () => {
  it("normalizes a bounded address", () => {
    expect(parseAddressInput({
      type: "shipping", line1: " 1 Main ", city: " Denver ", country: "us",
      postal_code: "80202", is_default: true,
    })).toMatchObject({
      type: "shipping", is_default: true,
      address: { line1: "1 Main", city: "Denver", country: "US", postal_code: "80202" },
    });
  });

  it("rejects oversized, missing, and malformed fields", () => {
    expect(() => parseAddressInput({ line1: "", city: "Denver", country: "US" })).toThrow("line1");
    expect(() => parseAddressInput({ line1: "x".repeat(201), city: "Denver", country: "US" })).toThrow("line1");
    expect(() => parseAddressInput({ line1: "1 Main", city: "Denver", country: "USA" })).toThrow("country");
    expect(() => parseProfileInput({ first_name: "x".repeat(101) })).toThrow("first_name");
  });
});
