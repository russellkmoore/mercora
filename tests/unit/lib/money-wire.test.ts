import { describe, expect, it } from "vitest";
import { Money, fromWireMoney, toWireMoney } from "@/lib/money";

describe("fromWireMoney", () => {
  it("reads a wire amount as major units", () => {
    // 3499 minor units is $34.99; reading it as minor units used to throw.
    expect(fromWireMoney({ amount: 34.99, currency: "USD" }).toMinorUnits()).toBe(3499);
  });

  it("round-trips a stored value through the wire shape", () => {
    const stored = { amount: 3499, currency: "USD" };
    expect(fromWireMoney(toWireMoney(stored)).toMinorUnits()).toBe(3499);
  });

  it("keeps the wire currency", () => {
    expect(fromWireMoney({ amount: 10.5, currency: "EUR" }).currency).toBe("EUR");
  });

  it("falls back to the default currency when the wire value omits one", () => {
    expect(fromWireMoney({ amount: 1.25 }, "GBP").currency).toBe("GBP");
  });

  it("returns zero rather than throwing on absent or malformed input", () => {
    for (const value of [undefined, null, {}, { amount: "34.99" }, { amount: Number.NaN }]) {
      expect(fromWireMoney(value).toMinorUnits()).toBe(0);
    }
  });

  it("does not throw on a fractional amount the minor-unit constructor rejects", () => {
    expect(() => Money.fromMinor(34.99)).toThrow(/safe integer/);
    expect(() => fromWireMoney({ amount: 34.99, currency: "USD" })).not.toThrow();
  });
});
