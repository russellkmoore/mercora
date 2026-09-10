import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import {
  createGiftCardRepository,
  sumOutstandingGiftCardBalances,
} from "@/lib/gift-cards/repository";
import type { IssueGiftCardInput, ReserveGiftCardInput } from "@/lib/gift-cards/domain";

const epoch = 1_800_000_000;
const quote = "c".repeat(64);
let testSequence = 0;
let now = epoch;
let giftCardId = "gift_uninitialized";
let hash = "0".repeat(64);

function issuance(overrides: Partial<IssueGiftCardInput> = {}): IssueGiftCardInput {
  return {
    id: giftCardId,
    codeHash: { keyVersion: 1, digest: hash },
    amount: Money.fromMinor(1_000, "USD"),
    createdAt: now,
    ...overrides,
  };
}

function reservation(
  id: string,
  requestedAmount = 600,
  overrides: Partial<ReserveGiftCardInput> = {},
): ReserveGiftCardInput {
  return {
    id,
    giftCardId,
    requestKey: `checkout-${id}`,
    quoteFingerprint: quote,
    requestedAmount: Money.fromMinor(requestedAmount, "USD"),
    reservedAt: now,
    expiresAt: now + 600,
    ...overrides,
  };
}

async function insertPendingOrder(id: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO orders
    (id, status, total_amount, currency_code, items, payment_status, created_at, updated_at)
    VALUES (?, 'pending', ?, 'USD', '[]', 'pending', ?, ?)`)
    .bind(
      id,
      JSON.stringify({ amount: 1, currency: "USD" }),
      new Date(now * 1_000).toISOString(),
      new Date(now * 1_000).toISOString(),
    ).run();
}

describe("sumOutstandingGiftCardBalances on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  // The measurement is an aggregate over every active card, so each case has
  // to start from a table that contributes nothing. The ledger is append-only
  // and reservation identity is immutable (migration 0022 triggers), so rows
  // cannot be deleted or back-dated: instead every case gets its own clock a
  // day ahead of the last, which expires the previous case's reservations,
  // and every leftover account is disabled out of the active set first.
  beforeEach(async () => {
    testSequence += 1;
    now = epoch + testSequence * 86_400;
    giftCardId = `gift_guard_${testSequence}`;
    hash = (testSequence + 0x1000).toString(16).padStart(64, "0");
    await env.DB.prepare(
      "UPDATE gift_card_accounts SET status = 'disabled', disabled_at = ? WHERE status = 'active'",
    ).bind(now).run();
  });

  it("reports zeros and a null currency when no gift cards exist", async () => {
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 0,
      cardsWithBalance: 0,
      openReservations: 0,
      currency: null,
    });
  });

  it("counts the full issued balance of an active card with no reservations", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 1_000,
      cardsWithBalance: 1,
      openReservations: 0,
      currency: "USD",
    });
  });

  it("subtracts an open reservation and reports it as an open reservation", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await expect(repository.reserve(reservation("reservation_open")))
      .resolves.toMatchObject({ available: true });
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 400,
      cardsWithBalance: 1,
      openReservations: 1,
      currency: "USD",
    });
  });

  it("returns the balance and clears the open count once the reservation is released", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_released"));
    await expect(repository.releaseReservation({
      reservationId: "reservation_released",
      reason: "abandoned",
      releasedAt: now + 5,
    })).resolves.toMatchObject({ released: true });
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 1_000,
      cardsWithBalance: 1,
      openReservations: 0,
      currency: "USD",
    });
  });

  it("lets the redemption ledger entry carry the reduction once a reservation settles", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_settled"));
    await insertPendingOrder("order_guard_settled");
    await repository.commitReservation({
      reservationId: "reservation_settled",
      orderId: "order_guard_settled",
      expectedAmount: Money.fromMinor(600, "USD"),
      committedAt: now + 5,
    });
    await expect(repository.settleReservation({
      reservationId: "reservation_settled",
      orderId: "order_guard_settled",
      settledAt: now + 10,
    })).resolves.toMatchObject({ created: true });
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 400,
      cardsWithBalance: 1,
      openReservations: 0,
      currency: "USD",
    });
  });

  it("ignores a reservation that expired without being released or committed", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_expired"));
    // The reservation's own expiry is now + 600; measuring past it is the
    // only way to age a row whose identity columns cannot be updated.
    await expect(sumOutstandingGiftCardBalances(env.DB, now + 601)).resolves.toEqual({
      outstandingMinor: 1_000,
      cardsWithBalance: 1,
      openReservations: 0,
      currency: "USD",
    });
  });

  it("excludes a disabled card from the outstanding total", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await env.DB.prepare(
      "UPDATE gift_card_accounts SET status = 'disabled', disabled_at = ? WHERE id = ?",
    ).bind(now + 1, giftCardId).run();
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 0,
      cardsWithBalance: 0,
      openReservations: 0,
      currency: null,
    });
  });
});
