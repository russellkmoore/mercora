import { describe, expect, it, vi } from "vitest";
import { Money } from "@/lib/money";
import { GiftCardTenderUnavailableError } from "@/lib/gift-cards/capability";
import { GiftCardRuntimeConfigurationError } from "@/lib/gift-cards/config";
import {
  createRuntimeGiftCardCapability,
  createRuntimeGiftCardCapabilityFactory,
} from "@/lib/gift-cards/runtime";
import type { GiftCardReservation } from "@/lib/gift-cards/domain";
import type { Order } from "@/lib/types/order";

const token = "GC-2345-6789-ABCD-EFGH-JKLM-NPQR-STUV";
const identity = {
  requestKey: "checkout-request-runtime",
  quoteFingerprint: "a".repeat(64),
  reservedAt: 1_800_000_000,
  expiresAt: 1_800_000_600,
};

function durableReservation(): GiftCardReservation {
  return {
    id: "gift_reservation_runtime",
    giftCardId: "gift_runtime",
    requestKey: identity.requestKey,
    quoteFingerprint: identity.quoteFingerprint,
    requestedAmount: Money.fromMinor(500, "USD"),
    amount: Money.fromMinor(500, "USD"),
    reservedAt: identity.reservedAt,
    expiresAt: identity.expiresAt,
  };
}

function paidOrder(): Order {
  return {
    id: "order_runtime",
    status: "processing",
    payment_status: "paid",
    total_amount: Money.fromMinor(1_000, "USD").toJSON(),
    currency_code: "USD",
    items: [],
    extensions: { checkout_tender: Money.fromMinor(500, "USD").toJSON() },
  };
}

describe("gift-card request-scoped runtime", () => {
  it("does not resolve bindings or secrets while its factory and no-token path are idle", async () => {
    const getEnvironment = vi.fn(async () => { throw new Error("must stay lazy"); });
    const factory = createRuntimeGiftCardCapabilityFactory({ getEnvironment });
    expect(getEnvironment).not.toHaveBeenCalled();
    const capability = factory();
    expect(getEnvironment).not.toHaveBeenCalled();
    await expect(capability.resolveTender({
      currency: "USD",
      amountDue: Money.fromMinor(500, "USD"),
    })).resolves.toEqual({ amount: Money.zero("USD") });
    expect(getEnvironment).not.toHaveBeenCalled();
  });

  it("re-reads and re-parses the server key ring for each bearer request", async () => {
    let environment: Record<string, unknown> = {
      DB: {} as D1Database,
      GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "1",
      GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({
        1: "current-gift-card-hmac-key-material-0001",
      }),
    };
    const getEnvironment = vi.fn(async () => environment);
    const repository = {
      findAccountByCodeHash: vi.fn(async () => undefined),
      reserve: vi.fn(),
      commitReservation: vi.fn(),
      settleReservation: vi.fn(),
      releaseReservation: vi.fn(),
    };
    const capability = createRuntimeGiftCardCapability({
      getEnvironment,
      repositoryFactory: vi.fn(() => repository) as never,
    });
    await expect(capability.resolveTender({
      token,
      currency: "USD",
      amountDue: Money.fromMinor(500, "USD"),
      requestIdentity: identity,
    })).rejects.toBeInstanceOf(GiftCardTenderUnavailableError);

    environment = {
      ...environment,
      GIFT_CARD_CODE_HMAC_KEYS_JSON: "not-json",
    };
    await expect(capability.resolveTender({
      token,
      currency: "USD",
      amountDue: Money.fromMinor(500, "USD"),
      requestIdentity: identity,
    })).rejects.toBeInstanceOf(GiftCardRuntimeConfigurationError);
    expect(getEnvironment).toHaveBeenCalledTimes(2);
  });

  it("reconciles an existing reservation without parsing acquisition keys", async () => {
    const reservation = durableReservation();
    const repository = {
      findAccountByCodeHash: vi.fn(),
      reserve: vi.fn(),
      commitReservation: vi.fn(async () => reservation),
      settleReservation: vi.fn(),
      releaseReservation: vi.fn(),
    };
    const getEnvironment = vi.fn(async () => ({ DB: {} as D1Database }));
    const capability = createRuntimeGiftCardCapability({
      getEnvironment,
      repositoryFactory: vi.fn(() => repository) as never,
      now: () => identity.reservedAt + 10,
    });
    await expect(capability.verifyReservedTender({
      order: paidOrder(),
      state: { v: 1, reservationId: reservation.id },
      expectedTender: reservation.amount,
    })).resolves.toBeUndefined();
    expect(repository.commitReservation).toHaveBeenCalledOnce();
    expect(getEnvironment).toHaveBeenCalledOnce();
  });
});
