import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import {
  createGiftCardRepository,
  sumOutstandingGiftCardBalances,
} from "@/lib/gift-cards/repository";
import {
  HONOR_GUARD_SETTING_CATEGORY,
  HONOR_GUARD_SETTING_KEY,
  HONOR_GUARD_STALE_SECONDS,
  honorIsEffectivelyOn,
  readHonorGuard,
  writeHonorGuard,
} from "@/lib/gift-cards/honor-guard";
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

  it("still counts a committed reservation whose redemption has not settled yet", async () => {
    // Commit and settle are two steps: `commitReservation` marks the order
    // final, `settleReservation` writes the redemption ledger entry later from
    // the order-effects drain. In between, the available-balance expression has
    // already subtracted the reservation, so `outstandingMinor` reads 0 for the
    // card. The money is still owed, so the guard has to see it in the
    // reservation count or honoring would switch off mid-settlement.
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance({ amount: Money.fromMinor(600, "USD") }));
    await repository.reserve(reservation("reservation_committed_unsettled"));
    await insertPendingOrder("order_guard_committed_unsettled");
    await repository.commitReservation({
      reservationId: "reservation_committed_unsettled",
      orderId: "order_guard_committed_unsettled",
      expectedAmount: Money.fromMinor(600, "USD"),
      committedAt: now + 5,
    });

    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 0,
      cardsWithBalance: 0,
      openReservations: 1,
      currency: "USD",
    });

    // The whole point: with the card reading zero, the reservation count is
    // the only thing keeping honoring on.
    await writeHonorGuard(env.DB, {
      outstanding_minor: 0,
      currency: "USD",
      open_reservations: 1,
      measured_at: now,
    });
    await expect(honorIsEffectivelyOn(env.DB, false, now)).resolves.toBe(true);
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

describe("honor-guard record on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM admin_settings WHERE key = ?")
      .bind(HONOR_GUARD_SETTING_KEY).run();
  });

  /** A database that fails the moment anything tries to read from it. */
  const unreadableDatabase = {
    prepare(): never {
      throw new Error("the honor guard read D1 when it should not have");
    },
  } as unknown as D1Database;

  it("round-trips the four fields the record is fixed at", async () => {
    const record = {
      outstanding_minor: 12_345,
      currency: "USD",
      open_reservations: 3,
      measured_at: epoch,
    };
    await writeHonorGuard(env.DB, record);
    await expect(readHonorGuard(env.DB)).resolves.toEqual(record);
  });

  it("stores the row under the fixed key, category and object data type", async () => {
    await writeHonorGuard(env.DB, {
      outstanding_minor: 0,
      currency: "USD",
      open_reservations: 0,
      measured_at: epoch,
    });
    await expect(env.DB.prepare(
      "SELECT key, category, data_type FROM admin_settings WHERE key = ?",
    ).bind(HONOR_GUARD_SETTING_KEY).first()).resolves.toMatchObject({
      key: HONOR_GUARD_SETTING_KEY,
      category: HONOR_GUARD_SETTING_CATEGORY,
      data_type: "object",
    });
  });

  it("replaces the previous measurement instead of colliding on the primary key", async () => {
    await writeHonorGuard(env.DB, {
      outstanding_minor: 500,
      currency: "USD",
      open_reservations: 1,
      measured_at: epoch,
    });
    await writeHonorGuard(env.DB, {
      outstanding_minor: 0,
      currency: "USD",
      open_reservations: 0,
      measured_at: epoch + 300,
    });
    await expect(readHonorGuard(env.DB)).resolves.toEqual({
      outstanding_minor: 0,
      currency: "USD",
      open_reservations: 0,
      measured_at: epoch + 300,
    });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS rows FROM admin_settings WHERE key = ?",
    ).bind(HONOR_GUARD_SETTING_KEY).first<{ rows: number }>())
      .resolves.toMatchObject({ rows: 1 });
  });

  it("reads a missing row as null", async () => {
    await expect(readHonorGuard(env.DB)).resolves.toBeNull();
  });

  it("reads malformed JSON as null rather than throwing", async () => {
    await env.DB.prepare(`INSERT INTO admin_settings (key, value, category, description, data_type)
      VALUES (?, ?, ?, ?, 'object')`)
      .bind(HONOR_GUARD_SETTING_KEY, "{not json", HONOR_GUARD_SETTING_CATEGORY, "corrupt")
      .run();
    await expect(readHonorGuard(env.DB)).resolves.toBeNull();
  });

  it("reads a well-formed row with the wrong shape as null", async () => {
    await env.DB.prepare(`INSERT INTO admin_settings (key, value, category, description, data_type)
      VALUES (?, ?, ?, ?, 'object')`)
      .bind(
        HONOR_GUARD_SETTING_KEY,
        JSON.stringify({ outstanding_minor: "12", currency: "USD", open_reservations: 0 }),
        HONOR_GUARD_SETTING_CATEGORY,
        "wrong shape",
      ).run();
    await expect(readHonorGuard(env.DB)).resolves.toBeNull();
  });

  it("answers honor-on without touching D1 when honor is configured on", async () => {
    await expect(honorIsEffectivelyOn(unreadableDatabase, true, epoch)).resolves.toBe(true);
  });

  it("follows the guard record when honor is configured off", async () => {
    await writeHonorGuard(env.DB, {
      outstanding_minor: 0,
      currency: "USD",
      open_reservations: 0,
      measured_at: epoch,
    });
    await expect(honorIsEffectivelyOn(env.DB, false, epoch)).resolves.toBe(false);
    await expect(honorIsEffectivelyOn(env.DB, false, epoch + HONOR_GUARD_STALE_SECONDS + 1))
      .resolves.toBe(true);
    await writeHonorGuard(env.DB, {
      outstanding_minor: 2_500,
      currency: "USD",
      open_reservations: 0,
      measured_at: epoch,
    });
    await expect(honorIsEffectivelyOn(env.DB, false, epoch)).resolves.toBe(true);
  });

  it("keeps honoring when the guard cannot be read at all", async () => {
    await expect(honorIsEffectivelyOn(unreadableDatabase, false, epoch)).resolves.toBe(true);
  });

  it("keeps honoring when no measurement has ever been written", async () => {
    await expect(honorIsEffectivelyOn(env.DB, false, epoch)).resolves.toBe(true);
  });
});
