import { describe, expect, it, vi } from "vitest";
import { Money } from "@/lib/money";
import {
  createRepositoryBackedGiftCardCapability,
  GiftCardTenderReconciliationError,
  GiftCardTenderRequestError,
  GiftCardTenderUnavailableError,
} from "@/lib/gift-cards/capability";
import type { GiftCardAccount, GiftCardReservation } from "@/lib/gift-cards/domain";
import type { Order } from "@/lib/types/order";

const token = "GC-2345-6789-ABCD-EFGH-JKLM-NPQR-STUV";
const requestIdentity = {
  requestKey: "checkout-request-one",
  quoteFingerprint: "a".repeat(64),
  reservedAt: 1_800_000_000,
  expiresAt: 1_800_000_600,
};
const keyRing = {
  currentVersion: 2,
  keys: {
    1: "previous-gift-card-hmac-key-material-001",
    2: "current-gift-card-hmac-key-material-0001",
  },
};

function account(overrides: Partial<GiftCardAccount> = {}): GiftCardAccount {
  return {
    id: "gift_one",
    codeHash: { keyVersion: 2, digest: "b".repeat(64) },
    currency: "USD",
    status: "active",
    issuanceEntryId: "issuance_one",
    issuanceBusinessKey: "gift-card/issuance/gift_one/v1",
    issuedAmount: Money.fromMinor(1_000, "USD"),
    createdAt: requestIdentity.reservedAt - 100,
    ...overrides,
  };
}

function reservation(overrides: Partial<GiftCardReservation> = {}): GiftCardReservation {
  return {
    id: "gift_reservation_one",
    giftCardId: "gift_one",
    requestKey: requestIdentity.requestKey,
    quoteFingerprint: requestIdentity.quoteFingerprint,
    requestedAmount: Money.fromMinor(700, "USD"),
    amount: Money.fromMinor(700, "USD"),
    reservedAt: requestIdentity.reservedAt,
    expiresAt: requestIdentity.expiresAt,
    ...overrides,
  };
}

function order(tender = 700): Order {
  return {
    id: "order_one",
    status: "processing",
    payment_status: "paid",
    total_amount: Money.fromMinor(2_000, "USD").toJSON(),
    currency_code: "USD",
    items: [],
    extensions: { checkout_tender: Money.fromMinor(tender, "USD").toJSON() },
  };
}

function harness(options: {
  matchedAccount?: GiftCardAccount;
  match?: boolean;
  available?: boolean;
  lookupError?: Error;
} = {}) {
  const durableReservation = reservation();
  const repository = {
    findAccountByCodeHash: vi.fn(async ({ keyVersion }: { keyVersion: number }) => {
      if (options.lookupError) throw options.lookupError;
      return keyVersion === 2 && options.match !== false
        ? (options.matchedAccount ?? account())
        : undefined;
    }),
    reserve: vi.fn(async () => options.available === false
      ? { available: false as const }
      : { available: true as const, created: true, reservation: durableReservation }),
    commitReservation: vi.fn(async () => durableReservation),
    settleReservation: vi.fn(async () => ({
      created: true,
      entry: {
        id: "entry_one",
        giftCardId: "gift_one",
        entryType: "redemption" as const,
        amountDelta: Money.fromMinor(-700, "USD"),
        businessKey: "gift-card/redemption/gift_reservation_one/v1",
        orderId: "order_one",
        reservationId: "gift_reservation_one",
        createdAt: requestIdentity.reservedAt + 10,
      },
    })),
    findSettledRedemption: vi.fn(async () => ({
      id: "entry_one",
      giftCardId: "gift_one",
      entryType: "redemption" as const,
      amountDelta: Money.fromMinor(-700, "USD"),
      businessKey: "gift-card/redemption/gift_reservation_one/v1",
      orderId: "order_one",
      reservationId: "gift_reservation_one",
      createdAt: requestIdentity.reservedAt + 10,
    })),
    restoreRedemption: vi.fn(async () => ({
      created: true,
      entry: {
        id: 'restore_one', giftCardId: 'gift_one', entryType: 'restoration' as const,
        amountDelta: Money.fromMinor(100, 'USD'), businessKey: 'gift-card/restoration/entry_one/refund-one/v1',
        orderId: 'order_one', relatedEntryId: 'entry_one', createdAt: requestIdentity.reservedAt + 20,
      },
    })),
    releaseReservation: vi.fn(async () => ({ released: true, reservation: durableReservation })),
  };
  const resolveLookupRuntime = vi.fn(async () => ({ repository, keyRing }));
  const resolveRepository = vi.fn(async () => repository);
  const capability = createRepositoryBackedGiftCardCapability({
    resolveLookupRuntime,
    resolveRepository,
    now: () => requestIdentity.reservedAt + 10,
  });
  return { capability, repository, resolveLookupRuntime, resolveRepository };
}

describe("repository-backed gift-card capability", () => {
  it('restores a settled tender using only its opaque reservation state', async () => {
    const { capability, repository } = harness();
    await capability.restoreTender({
      order: order(), state: { v: 1, reservationId: 'gift_reservation_one' },
      refundKey: 'refund-one', amount: Money.fromMinor(100, 'USD'),
    });
    expect(repository.findSettledRedemption).toHaveBeenCalledWith({
      reservationId: 'gift_reservation_one', orderId: 'order_one',
    });
    expect(repository.restoreRedemption).toHaveBeenCalledWith(expect.objectContaining({
      redemptionEntryId: 'entry_one', refundKey: 'refund-one', amount: Money.fromMinor(100, 'USD'),
    }));
  });

  it("does zero runtime work without a bearer token", async () => {
    const { capability, resolveLookupRuntime, resolveRepository } = harness();
    await expect(capability.resolveTender({
      currency: "USD",
      amountDue: Money.fromMinor(700, "USD"),
    })).resolves.toEqual({ amount: Money.zero("USD") });
    expect(resolveLookupRuntime).not.toHaveBeenCalled();
    expect(resolveRepository).not.toHaveBeenCalled();
  });

  it("requires durable request identity before touching keys or D1", async () => {
    const { capability, resolveLookupRuntime } = harness();
    await expect(capability.resolveTender({
      token,
      currency: "USD",
      amountDue: Money.fromMinor(700, "USD"),
    })).rejects.toBeInstanceOf(GiftCardTenderRequestError);
    expect(resolveLookupRuntime).not.toHaveBeenCalled();

    for (const invalid of [
      { ...requestIdentity, requestKey: "short" },
      { ...requestIdentity, quoteFingerprint: "A".repeat(64) },
      { ...requestIdentity, expiresAt: requestIdentity.reservedAt },
    ]) {
      await expect(capability.resolveTender({
        token,
        currency: "USD",
        amountDue: Money.fromMinor(700, "USD"),
        requestIdentity: invalid,
      })).rejects.toBeInstanceOf(GiftCardTenderRequestError);
    }
    expect(resolveLookupRuntime).not.toHaveBeenCalled();
  });

  it("digests every rotation candidate and returns reservation-only v1 state", async () => {
    const { capability, repository } = harness();
    const resolved = await capability.resolveTender({
      token,
      currency: "USD",
      amountDue: Money.fromMinor(700, "USD"),
      requestIdentity,
    });

    expect(repository.findAccountByCodeHash).toHaveBeenCalledTimes(2);
    expect(repository.reserve).toHaveBeenCalledWith(expect.objectContaining({
      giftCardId: "gift_one",
      requestKey: requestIdentity.requestKey,
      quoteFingerprint: requestIdentity.quoteFingerprint,
      requestedAmount: Money.fromMinor(700, "USD"),
      reservedAt: requestIdentity.reservedAt,
      expiresAt: requestIdentity.expiresAt,
    }));
    expect(resolved.amount).toEqual(Money.fromMinor(700, "USD"));
    expect(resolved.state).toEqual({ v: 1, reservationId: "gift_reservation_one" });
    expect(JSON.stringify(resolved.state)).not.toContain(token);
    expect(JSON.stringify(resolved.state)).not.toContain("gift_one");
  });

  it.each([
    ["malformed code", { token: "not-a-code" }, {}],
    ["unknown code", {}, { match: false }],
    ["disabled account", {}, { matchedAccount: account({ status: "disabled", disabledAt: requestIdentity.reservedAt }) }],
    ["currency mismatch", {}, { matchedAccount: account({ currency: "EUR", issuedAmount: Money.fromMinor(1_000, "EUR") }) }],
    ["empty balance", {}, { available: false }],
    ["lookup failure", {}, { lookupError: new Error("D1 binding secret detail") }],
  ])("uses one fixed unavailable failure for %s", async (_label, input, options) => {
    const { capability } = harness(options as Parameters<typeof harness>[0]);
    let caught: unknown;
    try {
      await capability.resolveTender({
        token,
        currency: "USD",
        amountDue: Money.fromMinor(700, "USD"),
        requestIdentity,
        ...input,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GiftCardTenderUnavailableError);
    expect((caught as Error).message).toBe("Gift-card tender is unavailable");
    expect((caught as Error).message).not.toContain(token);
    expect((caught as Error).message).not.toContain("D1 binding secret detail");
  });

  it("commits exact order and amount before idempotent settlement", async () => {
    const { capability, repository } = harness();
    const state = { v: 1, reservationId: "gift_reservation_one" };
    const expectedTender = Money.fromMinor(700, "USD");
    await capability.verifyReservedTender({ order: order(), state, expectedTender });
    expect(repository.commitReservation).toHaveBeenCalledWith({
      reservationId: "gift_reservation_one",
      orderId: "order_one",
      expectedAmount: expectedTender,
      committedAt: requestIdentity.reservedAt + 10,
    });

    await capability.applyTender({ order: order(), state });
    await capability.applyTender({ order: order(), state });
    expect(repository.settleReservation).toHaveBeenCalledTimes(2);
    expect(repository.settleReservation).toHaveBeenLastCalledWith({
      reservationId: "gift_reservation_one",
      orderId: "order_one",
      settledAt: requestIdentity.reservedAt + 10,
    });
  });

  it("releases open holds and rejects tampered state without repository work", async () => {
    const { capability, repository, resolveRepository } = harness();
    await capability.releaseTender({
      state: { v: 1, reservationId: "gift_reservation_one" },
      reason: "payment setup failed",
    });
    expect(repository.releaseReservation).toHaveBeenCalledWith({
      reservationId: "gift_reservation_one",
      reason: "payment setup failed",
      releasedAt: requestIdentity.reservedAt + 10,
    });

    resolveRepository.mockClear();
    await expect(capability.verifyReservedTender({
      order: order(),
      state: { v: 1, reservationId: "gift_reservation_one", giftCardId: "gift_one" },
      expectedTender: Money.fromMinor(700, "USD"),
    })).rejects.toBeInstanceOf(GiftCardTenderReconciliationError);
    expect(resolveRepository).not.toHaveBeenCalled();
  });
});
