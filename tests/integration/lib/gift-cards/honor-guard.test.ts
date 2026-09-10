import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import {
  createGiftCardRepository,
  sumOutstandingGiftCardBalances,
} from "@/lib/gift-cards/repository";
import {
  HONOR_GUARD_MIXED_CURRENCY,
  HONOR_GUARD_SETTING_CATEGORY,
  HONOR_GUARD_SETTING_KEY,
  HONOR_GUARD_STALE_SECONDS,
  honorIsEffectivelyOn,
  readHonorGuard,
  resolveHonorEffective,
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

/**
 * Close out any committed-but-unsettled reservation left by a previous case.
 *
 * The suites below isolate cases by advancing the clock and disabling leftover
 * accounts. That is no longer enough: a committed reservation never expires,
 * and the measurement now counts one against a *disabled* card too (WR-14) —
 * deliberately, because that is still money. Releasing is not an option either;
 * `gift_card_reservations_transition_guard` refuses to release anything already
 * committed. Settling is the only way to close one, which is exactly what
 * production does, so that is what this does.
 */
async function settleStrandedReservations(): Promise<void> {
  const stranded = await env.DB.prepare(
    `SELECT id, committed_order_id FROM gift_card_reservations
     WHERE released_at IS NULL AND committed_at IS NOT NULL
       AND committed_order_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM gift_card_ledger_entries entry
         WHERE entry.reservation_id = gift_card_reservations.id
           AND entry.entry_type = 'redemption'
       )`,
  ).all<{ id: string; committed_order_id: string }>();

  const repository = createGiftCardRepository(env.DB);
  for (const row of stranded.results ?? []) {
    await repository.settleReservation({
      reservationId: row.id,
      orderId: row.committed_order_id,
      settledAt: now,
    });
  }
}

/**
 * Drain every leftover balance to zero with a negative adjustment.
 *
 * Disabling a leftover card is no longer enough to take it out of the
 * measurement: a disabled card that still holds a balance is counted (WR-07),
 * deliberately, because that money is still owed until it is reissued or
 * written off. The ledger is append-only, so the only way to make a leftover
 * card contribute nothing is the same thing reissue does — an `adjustment`
 * entry for exactly the available balance. Runs after
 * `settleStrandedReservations`, so a committed hold has already become a
 * redemption and the drain sees the true remainder.
 */
async function drainLeftoverBalances(): Promise<void> {
  const repository = createGiftCardRepository(env.DB);
  const accounts = await env.DB.prepare("SELECT id FROM gift_card_accounts").all<{ id: string }>();
  for (const { id } of accounts.results ?? []) {
    const balance = await repository.readBalance(id, now);
    if (!balance || !balance.availableBalance.gt(Money.zero(balance.availableBalance.currency))) continue;
    await repository.writeAdjustment({
      giftCardId: id,
      amount: balance.availableBalance.negate(),
      businessKey: `test-drain/${id}/${testSequence}`,
      createdAt: now,
    });
  }
}

describe("sumOutstandingGiftCardBalances on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  // The measurement is an aggregate over every card still holding value, so
  // each case has to start from a table that contributes nothing. The ledger
  // is append-only and reservation identity is immutable (migration 0022
  // triggers), so rows cannot be deleted or back-dated: instead every case
  // gets its own clock a day ahead of the last, which expires the previous
  // case's reservations, every leftover account is disabled out of the active
  // set, and whatever balance is left on it is drained to zero (WR-07).
  beforeEach(async () => {
    testSequence += 1;
    now = epoch + testSequence * 86_400;
    giftCardId = `gift_guard_${testSequence}`;
    hash = (testSequence + 0x1000).toString(16).padStart(64, "0");
    await settleStrandedReservations();
    await env.DB.prepare(
      "UPDATE gift_card_accounts SET status = 'disabled', disabled_at = ? WHERE status = 'active'",
    ).bind(now).run();
    await drainLeftoverBalances();
  });

  it("reports zeros and a null currency when no gift cards exist", async () => {
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 0,
      cardsWithBalance: 0,
      openReservations: 0,
      heldMinor: 0,
      currency: null,
      currencyCount: 0,
    });
  });

  it("counts the full issued balance of an active card with no reservations", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toEqual({
      outstandingMinor: 1_000,
      cardsWithBalance: 1,
      openReservations: 0,
      heldMinor: 0,
      currency: "USD",
      currencyCount: 1,
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
      heldMinor: 600,
      currency: "USD",
      currencyCount: 1,
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
      heldMinor: 0,
      currency: "USD",
      currencyCount: 1,
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
      heldMinor: 0,
      currency: "USD",
      currencyCount: 1,
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
      heldMinor: 600,
      currency: "USD",
      currencyCount: 1,
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
      heldMinor: 0,
      currency: "USD",
      currencyCount: 1,
    });
  });

  it("still counts a committed, unsettled reservation after its card is disabled", async () => {
    // WR-14. Scoping the count to active accounts alone re-opened CR-01's hole,
    // narrowed to one card state: disabling a card mid-settlement dropped the
    // measurement to zero and stranded the redemption on every retry. Nothing
    // in the tree disables a card yet, but nothing stops it either — the status
    // transition guard permits active -> disabled with an outstanding
    // reservation, and settleReservation never checks account status.
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance({ amount: Money.fromMinor(600, "USD") }));
    await repository.reserve(reservation("reservation_committed_disabled"));
    await insertPendingOrder("order_guard_committed_disabled");
    await repository.commitReservation({
      reservationId: "reservation_committed_disabled",
      orderId: "order_guard_committed_disabled",
      expectedAmount: Money.fromMinor(600, "USD"),
      committedAt: now + 5,
    });
    await env.DB.prepare(
      "UPDATE gift_card_accounts SET status = 'disabled', disabled_at = ? WHERE id = ?",
    ).bind(now + 6, giftCardId).run();

    // The card contributes nothing to the balance half — it is not active — so
    // the reservation count is the only thing left holding honoring on.
    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toMatchObject({
      outstandingMinor: 0,
      cardsWithBalance: 0,
      openReservations: 1,
      heldMinor: 600,
    });

    await writeHonorGuard(env.DB, {
      outstanding_minor: 0,
      currency: "USD",
      open_reservations: 1,
      held_minor: 600,
      measured_at: now,
    });
    await expect(resolveHonorEffective(
      env.DB,
      { giftCardAcquisition: false, giftCardReconciliation: false },
      now,
    )).resolves.toBe(true);
  });

  it("does not count an uncommitted reservation against a disabled card", async () => {
    // The exception is committed reservations only. An uncommitted one holds no
    // money the store has taken, and it expires on its own — counting it would
    // pin honoring on for any abandoned checkout against a retired card.
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_open_disabled"));
    await env.DB.prepare(
      "UPDATE gift_card_accounts SET status = 'disabled', disabled_at = ? WHERE id = ?",
    ).bind(now + 1, giftCardId).run();

    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toMatchObject({
      openReservations: 0,
      heldMinor: 0,
    });
  });

  it("reports the face value held by open reservations, not just how many there are", async () => {
    // WR-15. `outstandingMinor` cannot carry this: the available-balance
    // expression has already subtracted a committed reservation, so the money
    // reads as zero on the card while it is plainly in flight.
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_held_a", 250));
    await repository.reserve(reservation("reservation_held_b", 150));

    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toMatchObject({
      outstandingMinor: 600,
      openReservations: 2,
      heldMinor: 400,
    });
  });

  it("reports the currency span so a mixed-currency sum is never printed as money", async () => {
    // `outstandingMinor` is a bare SUM with no GROUP BY. Two currencies make it
    // a number that is not a total of anything, formatted under whichever code
    // sorts first. It is still a valid answer to "is there money out there", so
    // it is kept and the span is reported alongside it.
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.issueAccount(issuance({
      id: `${giftCardId}_eur`,
      codeHash: { keyVersion: 1, digest: (testSequence + 0x2000).toString(16).padStart(64, "0") },
      amount: Money.fromMinor(500, "EUR"),
    }));

    await expect(sumOutstandingGiftCardBalances(env.DB, now)).resolves.toMatchObject({
      outstandingMinor: 1_500,
      cardsWithBalance: 2,
      currencyCount: 2,
    });
  });

  it("still counts a disabled card's remaining balance, and counts it exactly once after reissue (WR-07)", async () => {
    // Phase 14 lets an admin disable a card. Disabling stops redemption but
    // does not forgive the money on it: until the balance is reissued (D-05's
    // answer to a mistaken disable) it is a liability the store still owes.
    // If the guard stopped seeing it, both flags off would read "no
    // balances", honoring would switch off, and the detail page holding the
    // Reissue button would 404 — the one card that needs it, unreachable.
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.disableAccount({ giftCardId, disabledAt: now + 1 });

    const measured = await sumOutstandingGiftCardBalances(env.DB, now + 1);
    expect(measured).toEqual({
      outstandingMinor: 1_000,
      cardsWithBalance: 1,
      openReservations: 0,
      heldMinor: 0,
      currency: "USD",
      currencyCount: 1,
    });

    // With that measurement stored, both flags off keeps honoring on — so
    // the admin surface stays reachable.
    await writeHonorGuard(env.DB, {
      outstanding_minor: measured.outstandingMinor,
      currency: "USD",
      open_reservations: 0,
      measured_at: now + 1,
    });
    await expect(resolveHonorEffective(
      env.DB,
      { giftCardAcquisition: false, giftCardReconciliation: false },
      now + 1,
    )).resolves.toBe(true);

    // Reissue drains the disabled card and issues a new active one: the old
    // card now reads zero and drops out, the new card is counted — once.
    const reissued = await repository.reissue({
      oldGiftCardId: giftCardId,
      now: now + 2,
      actor: { type: "admin", id: "user_admin" },
      codeHash: { keyVersion: 1, digest: (testSequence + 0x4000).toString(16).padStart(64, "0") },
    });
    await expect(repository.readBalance(giftCardId, now + 2)).resolves.toMatchObject({
      availableBalance: Money.zero("USD"),
    });
    await expect(repository.readBalance(reissued.newGiftCardId, now + 2)).resolves.toMatchObject({
      availableBalance: Money.fromMinor(1_000, "USD"),
    });
    await expect(sumOutstandingGiftCardBalances(env.DB, now + 2)).resolves.toEqual({
      outstandingMinor: 1_000,
      cardsWithBalance: 1,
      openReservations: 0,
      heldMinor: 0,
      currency: "USD",
      currencyCount: 1,
    });
  });

  it("drops a disabled card that has been drained to zero, so it contributes no currency either", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.disableAccount({ giftCardId, disabledAt: now + 1 });
    await repository.writeAdjustment({
      giftCardId,
      amount: Money.fromMinor(-1_000, "USD"),
      businessKey: `write-off/${giftCardId}`,
      createdAt: now + 2,
    });
    await expect(sumOutstandingGiftCardBalances(env.DB, now + 2)).resolves.toEqual({
      outstandingMinor: 0,
      cardsWithBalance: 0,
      openReservations: 0,
      heldMinor: 0,
      currency: null,
      currencyCount: 0,
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

  it.each([
    ["an empty currency, which throws in the Money constructor", { currency: "" }],
    ["a non-ISO currency, which throws out of Intl.NumberFormat", { currency: "US$" }],
    ["a two-letter currency", { currency: "US" }],
    ["a fractional total, which trips assertSafeMinorUnits", { outstanding_minor: 12.5 }],
    ["a total beyond safe integer range", { outstanding_minor: Number.MAX_SAFE_INTEGER + 2 }],
    ["a negative reservation count, which cannot describe anything real", { open_reservations: -1 }],
  ])("reads a row carrying %s as null rather than letting the banner format it", async (_name, overrides) => {
    // The banner runs Money.fromMinor(...).format() on whatever comes back, in
    // an admin server component. Every value here throws somewhere in that
    // chain, so the parse has to refuse it — null is a shape the banner and
    // balancesMayExist both already handle, and it fails toward honoring.
    await env.DB.prepare(`INSERT INTO admin_settings (key, value, category, description, data_type)
      VALUES (?, ?, ?, ?, 'object')`)
      .bind(
        HONOR_GUARD_SETTING_KEY,
        JSON.stringify({
          outstanding_minor: 100,
          currency: "USD",
          open_reservations: 0,
          measured_at: epoch,
          ...overrides,
        }),
        HONOR_GUARD_SETTING_CATEGORY,
        "unusable",
      ).run();

    await expect(readHonorGuard(env.DB)).resolves.toBeNull();
    await expect(honorIsEffectivelyOn(env.DB, false, epoch)).resolves.toBe(true);
  });

  it("still reads the mixed-currency sentinel, which is deliberate and not corruption", async () => {
    await writeHonorGuard(env.DB, {
      outstanding_minor: 3_000,
      currency: HONOR_GUARD_MIXED_CURRENCY,
      open_reservations: 0,
      measured_at: epoch,
    });
    await expect(readHonorGuard(env.DB)).resolves.toMatchObject({
      currency: HONOR_GUARD_MIXED_CURRENCY,
    });
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

  describe("resolveHonorEffective is the one owner of the money decision (D-18)", () => {
    const SELL_ON_HONOR_OFF = { giftCardAcquisition: true, giftCardReconciliation: false };
    const BOTH_OFF = { giftCardAcquisition: false, giftCardReconciliation: false };
    const SELL_OFF_HONOR_ON = { giftCardAcquisition: false, giftCardReconciliation: true };

    it("answers yes without touching D1 when honor is configured on", async () => {
      await expect(resolveHonorEffective(unreadableDatabase, SELL_OFF_HONOR_ON, epoch))
        .resolves.toBe(true);
    });

    it("answers no without touching D1 when selling is on and honor is off", async () => {
      // The short-circuit that used to live in lib/commerce/runtime.ts, and the
      // reason it is load-bearing: this combination throws at capability
      // resolution (GCF-04). If the guard were read here, a store selling cards
      // it cannot redeem would resolve cleanly instead of throwing, and the
      // protection would be gone with nothing to notice it. `unreadableDatabase`
      // throws on any read, so reaching D1 fails this test rather than passing
      // it quietly.
      await expect(resolveHonorEffective(unreadableDatabase, SELL_ON_HONOR_OFF, epoch))
        .resolves.toBe(false);
    });

    it("answers no even with a guard record that would say balances exist", async () => {
      // Same state, but with a real database holding a record that screams
      // "money outstanding". The flags decide; the guard is not consulted.
      await writeHonorGuard(env.DB, {
        outstanding_minor: 250_000,
        currency: "USD",
        open_reservations: 9,
        measured_at: epoch,
      });
      await expect(resolveHonorEffective(env.DB, SELL_ON_HONOR_OFF, epoch))
        .resolves.toBe(false);
    });

    it("follows the guard with both flags off", async () => {
      await writeHonorGuard(env.DB, {
        outstanding_minor: 0,
        currency: "USD",
        open_reservations: 0,
        measured_at: epoch,
      });
      await expect(resolveHonorEffective(env.DB, BOTH_OFF, epoch)).resolves.toBe(false);

      await writeHonorGuard(env.DB, {
        outstanding_minor: 4_000,
        currency: "USD",
        open_reservations: 0,
        measured_at: epoch,
      });
      await expect(resolveHonorEffective(env.DB, BOTH_OFF, epoch)).resolves.toBe(true);
    });

    it("keeps honoring with both flags off and no database binding at all", async () => {
      // Not knowing is not a reason to stop honoring (D-04).
      await expect(resolveHonorEffective(undefined, BOTH_OFF, epoch)).resolves.toBe(true);
    });

    it("keeps honoring with both flags off when the guard cannot be read", async () => {
      await expect(resolveHonorEffective(unreadableDatabase, BOTH_OFF, epoch))
        .resolves.toBe(true);
    });

    it("keeps honoring with both flags off when no measurement exists yet", async () => {
      await expect(resolveHonorEffective(env.DB, BOTH_OFF, epoch)).resolves.toBe(true);
    });
  });

  it("keeps honoring when no measurement has ever been written", async () => {
    await expect(honorIsEffectivelyOn(env.DB, false, epoch)).resolves.toBe(true);
  });
});
