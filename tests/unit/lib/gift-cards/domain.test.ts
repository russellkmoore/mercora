import { describe, expect, it } from "vitest";
import { Money } from "@/lib/money";
import {
  assertGiftCardCodeHash,
  assertIssueGiftCardInput,
  assertReserveGiftCardInput,
  giftCardIssuanceBusinessKey,
  giftCardRedemptionBusinessKey,
} from "@/lib/gift-cards/domain";

const digest = "a".repeat(64);

describe("gift-card domain", () => {
  it("accepts only the frozen versioned code-hash identity", () => {
    expect(() => assertGiftCardCodeHash({ keyVersion: 1, digest })).not.toThrow();
    for (const invalid of [
      { keyVersion: 0, digest },
      { keyVersion: 1.5, digest },
      { keyVersion: 1, digest: "A".repeat(64) },
      { keyVersion: 1, digest: "g".repeat(64) },
      { keyVersion: 1, digest: "a".repeat(63) },
    ]) {
      expect(() => assertGiftCardCodeHash(invalid)).toThrow();
    }
  });

  it("requires positive safe Money and exact issuance attribution", () => {
    expect(() => assertIssueGiftCardInput({
      id: "gift_one",
      codeHash: { keyVersion: 1, digest },
      amount: Money.fromMinor(2_500, "USD"),
      issuedOrderId: "order_one",
      issuedLineId: "line_one",
      createdAt: 1_800_000_000,
    })).not.toThrow();
    expect(() => assertIssueGiftCardInput({
      id: "gift_one",
      codeHash: { keyVersion: 1, digest },
      amount: Money.zero("USD"),
      createdAt: 1_800_000_000,
    })).toThrow("positive");
    expect(() => assertIssueGiftCardInput({
      id: "gift_one",
      codeHash: { keyVersion: 1, digest },
      amount: Money.fromMinor(2_500, "USD"),
      issuedOrderId: "order_one",
      createdAt: 1_800_000_000,
    })).toThrow("together");
  });

  it("binds reservation identity to an exact request, quote, amount, and lease", () => {
    expect(() => assertReserveGiftCardInput({
      id: "reservation_one",
      giftCardId: "gift_one",
      requestKey: "checkout-request-one",
      quoteFingerprint: "b".repeat(64),
      requestedAmount: Money.fromMinor(1_000, "USD"),
      reservedAt: 100,
      expiresAt: 200,
    })).not.toThrow();
    expect(() => assertReserveGiftCardInput({
      id: "reservation_one",
      giftCardId: "gift_one",
      requestKey: "checkout-request-one",
      quoteFingerprint: "b".repeat(64),
      requestedAmount: Money.fromMinor(1_000, "USD"),
      reservedAt: 200,
      expiresAt: 200,
    })).toThrow("follow");
  });

  it("derives bounded business identities without bearer material", () => {
    expect(giftCardIssuanceBusinessKey("gift_one"))
      .toBe("gift-card/issuance/gift_one/v1");
    expect(giftCardRedemptionBusinessKey("reservation_one"))
      .toBe("gift-card/redemption/reservation_one/v1");
  });
});
