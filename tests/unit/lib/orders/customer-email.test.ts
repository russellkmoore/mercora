import { describe, expect, it } from "vitest";
import { getOrderCustomerEmail } from "@/lib/orders/customer-email";

describe("getOrderCustomerEmail", () => {
  it("normalizes the server-authored extension email", () => {
    expect(
      getOrderCustomerEmail({
        extensions: { email: "  Customer@Example.COM " },
        shipping_address: { email: "fallback@example.com" },
      }),
    ).toBe("customer@example.com");
  });

  it("falls back to the persisted shipping address", () => {
    expect(
      getOrderCustomerEmail({
        extensions: {},
        shipping_address: { email: " Guest@Example.com " },
      }),
    ).toBe("guest@example.com");
  });

  it("does not accept non-string or empty values", () => {
    expect(
      getOrderCustomerEmail({
        extensions: { email: 42 },
        shipping_address: { email: "   " },
      }),
    ).toBeNull();
    expect(getOrderCustomerEmail({ shipping_address: [] })).toBeNull();
  });
});
