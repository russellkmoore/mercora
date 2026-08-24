import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import {
  GiftCardConflictError,
  GiftCardUnavailableError,
  createGiftCardRepository,
} from "@/lib/gift-cards/repository";
import type { IssueGiftCardInput, ReserveGiftCardInput } from "@/lib/gift-cards/domain";

const now = 1_800_000_000;
const quote = "b".repeat(64);
let testSequence = 0;
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

describe("gift-card repository on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(() => {
    testSequence += 1;
    giftCardId = `gift_test_${testSequence}`;
    hash = testSequence.toString(16).padStart(64, "0");
  });

  it("issues exactly one account and ledger entry and converges an exact retry", async () => {
    const repository = createGiftCardRepository(env.DB);
    const first = await repository.issueAccount(issuance());
    const retry = await repository.issueAccount(issuance());
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.account).toEqual(first.account);
    expect(retry.issuance).toEqual(first.issuance);
    await expect(repository.findAccountByCodeHash({ keyVersion: 1, digest: hash }))
      .resolves.toMatchObject({ id: giftCardId, currency: "USD" });
    await expect(repository.readBalance(giftCardId, now)).resolves.toMatchObject({
      ledgerBalance: Money.fromMinor(1_000, "USD"),
      heldAmount: Money.zero("USD"),
      availableBalance: Money.fromMinor(1_000, "USD"),
    });
  });

  it("uses the version+digest pair as lookup identity and rejects collisions", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await expect(repository.issueAccount(issuance({
      id: "gift_rotated",
      codeHash: { keyVersion: 2, digest: hash },
    }))).resolves.toMatchObject({ created: true });
    await expect(repository.findAccountByCodeHash({ keyVersion: 2, digest: hash }))
      .resolves.toMatchObject({ id: "gift_rotated" });
    await expect(repository.issueAccount(issuance({ id: "gift_collision" })))
      .rejects.toBeInstanceOf(GiftCardConflictError);
  });

  it("atomically caps concurrent holds at the ledger-derived balance", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    let open!: () => void;
    const barrier = new Promise<void>((resolve) => { open = resolve; });
    const hold = async (id: string) => {
      await barrier;
      return repository.reserve(reservation(id, 700));
    };
    const left = hold("reservation_left");
    const right = hold("reservation_right");
    open();
    const results = await Promise.all([left, right]);
    expect(results.every((result) => result.available)).toBe(true);
    const amounts = results.map((result) => result.available
      ? result.reservation.amount.toMinorUnits()
      : 0).sort((a, b) => a - b);
    expect(amounts).toEqual([300, 700]);
    await expect(repository.readBalance(giftCardId, now)).resolves.toMatchObject({
      ledgerBalance: Money.fromMinor(1_000, "USD"),
      heldAmount: Money.fromMinor(1_000, "USD"),
      availableBalance: Money.zero("USD"),
    });
    await expect(repository.reserve(reservation("reservation_late", 1)))
      .resolves.toEqual({ available: false });
  });

  it("converges exact request retries and rejects changed request facts", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    const input = reservation("reservation_one");
    await expect(repository.reserve(input)).resolves.toMatchObject({
      available: true,
      created: true,
    });
    await expect(repository.reserve({
      ...input,
      reservedAt: input.reservedAt + 10,
      expiresAt: input.expiresAt + 10,
    })).resolves.toMatchObject({
      available: true,
      created: false,
    });
    await expect(repository.reserve({
      ...input,
      id: "reservation_changed",
      quoteFingerprint: "c".repeat(64),
    })).rejects.toBeInstanceOf(GiftCardConflictError);
  });

  it("releases expired open holds while committed holds survive expiry", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    const first = await repository.reserve(reservation("reservation_expiring", 800));
    expect(first.available).toBe(true);
    await expect(repository.readBalance(giftCardId, now + 601)).resolves.toMatchObject({
      heldAmount: Money.zero("USD"),
      availableBalance: Money.fromMinor(1_000, "USD"),
    });
    await repository.releaseReservation({
      reservationId: "reservation_expiring",
      reason: "expired checkout",
      releasedAt: now + 601,
    });
    const committed = await repository.reserve(reservation("reservation_committed", 900, {
      reservedAt: now + 601,
      expiresAt: now + 1_201,
    }));
    expect(committed.available).toBe(true);
    await insertPendingOrder("gift-order-commit");
    await repository.commitReservation({
      reservationId: "reservation_committed",
      orderId: "gift-order-commit",
      expectedAmount: Money.fromMinor(900, "USD"),
      committedAt: now + 700,
    });
    await expect(repository.readBalance(giftCardId, now + 2_000)).resolves.toMatchObject({
      heldAmount: Money.fromMinor(900, "USD"),
      availableBalance: Money.fromMinor(100, "USD"),
    });
  });

  it("settles one negative ledger entry and preserves availability across retries", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_settle", 600));
    await insertPendingOrder("gift-order-settle");
    await repository.commitReservation({
      reservationId: "reservation_settle",
      orderId: "gift-order-settle",
      expectedAmount: Money.fromMinor(600, "USD"),
      committedAt: now + 100,
    });
    let open!: () => void;
    const barrier = new Promise<void>((resolve) => { open = resolve; });
    const settle = async () => {
      await barrier;
      return repository.settleReservation({
        reservationId: "reservation_settle",
        orderId: "gift-order-settle",
        settledAt: now + 200,
      });
    };
    const left = settle();
    const right = settle();
    open();
    const results = await Promise.all([left, right]);
    expect(results.map(({ created }) => created).sort()).toEqual([false, true]);
    await expect(repository.readBalance(giftCardId, now + 200)).resolves.toMatchObject({
      ledgerBalance: Money.fromMinor(400, "USD"),
      heldAmount: Money.zero("USD"),
      availableBalance: Money.fromMinor(400, "USD"),
    });
  });

  it('restores a settled redemption exactly once per refund key and never exceeds it', async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation('reservation_restore_repository', 600));
    await insertPendingOrder('gift-order-restore-repository');
    const committed = await repository.commitReservation({
      reservationId: 'reservation_restore_repository',
      orderId: 'gift-order-restore-repository',
      expectedAmount: Money.fromMinor(600, 'USD'),
      committedAt: now + 100,
    });
    const redemption = await repository.settleReservation({
      reservationId: committed.id,
      orderId: 'gift-order-restore-repository',
      settledAt: now + 101,
    });
    const first = await repository.restoreRedemption({
      redemptionEntryId: redemption.entry.id,
      orderId: 'gift-order-restore-repository',
      refundKey: 'refund-restore-1',
      amount: Money.fromMinor(400, 'USD'),
      restoredAt: now + 200,
    });
    const retry = await repository.restoreRedemption({
      redemptionEntryId: redemption.entry.id,
      orderId: 'gift-order-restore-repository',
      refundKey: 'refund-restore-1',
      amount: Money.fromMinor(400, 'USD'),
      restoredAt: now + 201,
    });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    await expect(repository.readBalance(giftCardId, now + 201)).resolves.toMatchObject({
      ledgerBalance: Money.fromMinor(800, 'USD'),
    });
    await expect(repository.restoreRedemption({
      redemptionEntryId: redemption.entry.id,
      orderId: 'gift-order-restore-repository',
      refundKey: 'refund-restore-overage',
      amount: Money.fromMinor(201, 'USD'),
      restoredAt: now + 202,
    })).rejects.toBeInstanceOf(GiftCardConflictError);
  });

  it("serializes commit against release with exactly one terminal winner", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_race", 500));
    await insertPendingOrder("gift-order-race");
    let open!: () => void;
    const barrier = new Promise<void>((resolve) => { open = resolve; });
    const commit = (async () => {
      await barrier;
      return repository.commitReservation({
        reservationId: "reservation_race",
        orderId: "gift-order-race",
        expectedAmount: Money.fromMinor(500, "USD"),
        committedAt: now + 100,
      });
    })();
    const release = (async () => {
      await barrier;
      return repository.releaseReservation({
        reservationId: "reservation_race",
        reason: "checkout canceled",
        releasedAt: now + 100,
      });
    })();
    open();
    const results = await Promise.allSettled([commit, release]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const durable = await repository.findReservationById("reservation_race");
    expect(Boolean(durable?.committedAt) !== Boolean(durable?.releasedAt)).toBe(true);
  });

  it("fails closed for late commitment and refuses release after commitment", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_late_commit", 500));
    await insertPendingOrder("gift-order-late");
    await expect(repository.commitReservation({
      reservationId: "reservation_late_commit",
      orderId: "gift-order-late",
      expectedAmount: Money.fromMinor(500, "USD"),
      committedAt: now + 601,
    })).rejects.toBeInstanceOf(GiftCardUnavailableError);

    await repository.reserve(reservation("reservation_no_release", 500));
    await repository.commitReservation({
      reservationId: "reservation_no_release",
      orderId: "gift-order-late",
      expectedAmount: Money.fromMinor(500, "USD"),
      committedAt: now + 100,
    });
    await expect(repository.releaseReservation({
      reservationId: "reservation_no_release",
      reason: "must not release",
      releasedAt: now + 101,
    })).rejects.toBeInstanceOf(GiftCardConflictError);
  });

  it("enforces balance invariants for raw future writers", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await expect(env.DB.prepare(`INSERT INTO gift_card_ledger_entries
      (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
       business_key, created_at)
      VALUES ('bad_adjustment', ?, 'USD', 'adjustment', -1001,
       'bad-adjustment', ?)`)
      .bind(giftCardId, now + 1).run()).rejects.toThrow("ledger balance");
    await expect(env.DB.prepare(`INSERT INTO gift_card_reservations
      (id, gift_card_id, currency_code, request_key, quote_fingerprint,
       requested_amount_minor, amount_minor, reserved_at, expires_at)
      VALUES ('bad_reservation', ?, 'USD', 'bad-request-key', ?,
       1001, 1001, ?, ?)`)
      .bind(giftCardId, quote, now, now + 100).run()).rejects.toThrow("available balance");

    await repository.reserve(reservation("reservation_guard", 500));
    await insertPendingOrder("gift-order-guard");
    await repository.commitReservation({
      reservationId: "reservation_guard",
      orderId: "gift-order-guard",
      expectedAmount: Money.fromMinor(500, "USD"),
      committedAt: now + 10,
    });
    await expect(env.DB.prepare(`INSERT INTO gift_card_ledger_entries
      (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
       business_key, order_id, reservation_id, created_at)
      VALUES ('bad_redemption', ?, 'USD', 'redemption', -1,
       'bad-redemption', 'gift-order-guard', 'reservation_guard', ?)`)
      .bind(giftCardId, now + 20).run()).rejects.toThrow("committed reservation");
  });

  it("keeps ledger rows append-only and freezes durable financial identity", async () => {
    const repository = createGiftCardRepository(env.DB);
    const issued = await repository.issueAccount(issuance());

    await expect(env.DB.prepare(`UPDATE gift_card_ledger_entries
      SET amount_delta_minor = 999 WHERE id = ?`)
      .bind(issued.issuance.id).run()).rejects.toThrow("append-only");
    await expect(env.DB.prepare("DELETE FROM gift_card_ledger_entries WHERE id = ?")
      .bind(issued.issuance.id).run()).rejects.toThrow("append-only");
    await expect(env.DB.prepare(`UPDATE gift_card_accounts
      SET code_hash = ? WHERE id = ?`)
      .bind("f".repeat(64), giftCardId).run()).rejects.toThrow("identity is immutable");

    await env.DB.prepare(`UPDATE gift_card_accounts
      SET status = 'disabled', disabled_at = ? WHERE id = ?`)
      .bind(now + 1, giftCardId).run();
    await expect(env.DB.prepare(`UPDATE gift_card_accounts
      SET status = 'active', disabled_at = NULL WHERE id = ?`)
      .bind(giftCardId).run()).rejects.toThrow("status transition is invalid");

    const secondRepository = createGiftCardRepository(env.DB);
    const mutableGiftCardId = `${giftCardId}_reservation`;
    await secondRepository.issueAccount(issuance({
      id: mutableGiftCardId,
      codeHash: { keyVersion: 1, digest: "e".repeat(64) },
    }));
    const input = reservation("reservation_identity", 400, {
      giftCardId: mutableGiftCardId,
    });
    await secondRepository.reserve(input);
    await expect(env.DB.prepare(`UPDATE gift_card_reservations
      SET quote_fingerprint = ?, amount_minor = 399 WHERE id = ?`)
      .bind("d".repeat(64), input.id).run()).rejects.toThrow("identity is immutable");
    await expect(secondRepository.releaseReservation({
      reservationId: input.id,
      reason: "customer canceled",
      releasedAt: now + 1,
    })).resolves.toMatchObject({ released: true });
  });

  it("serializes concurrent restorations at the referenced redemption cap", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    await repository.reserve(reservation("reservation_restore", 600));
    await insertPendingOrder("gift-order-restore");
    await repository.commitReservation({
      reservationId: "reservation_restore",
      orderId: "gift-order-restore",
      expectedAmount: Money.fromMinor(600, "USD"),
      committedAt: now + 10,
    });
    const redemption = await repository.settleReservation({
      reservationId: "reservation_restore",
      orderId: "gift-order-restore",
      settledAt: now + 20,
      entryId: "redemption_restore",
    });

    await expect(env.DB.prepare(`INSERT INTO gift_card_ledger_entries
      (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
       business_key, related_entry_id, created_at)
      VALUES ('restoration_missing_order', ?, 'USD', 'restoration', 1,
       'restoration-missing-order', ?, ?)`)
      .bind(giftCardId, redemption.entry.id, now + 21).run()).rejects.toThrow();

    const otherCardId = `${giftCardId}_other`;
    await repository.issueAccount(issuance({
      id: otherCardId,
      codeHash: { keyVersion: 2, digest: hash },
    }));
    await expect(env.DB.prepare(`INSERT INTO gift_card_ledger_entries
      (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
       business_key, order_id, related_entry_id, created_at)
      VALUES ('restoration_wrong_card', ?, 'USD', 'restoration', 100,
       'restoration-wrong-card', 'gift-order-restore', ?, ?)`)
      .bind(otherCardId, redemption.entry.id, now + 21).run())
      .rejects.toThrow("conflicts with its redemption");

    let open!: () => void;
    const barrier = new Promise<void>((resolve) => { open = resolve; });
    const restore = async (id: string) => {
      await barrier;
      return env.DB.prepare(`INSERT INTO gift_card_ledger_entries
        (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
         business_key, order_id, related_entry_id, created_at)
        VALUES (?, ?, 'USD', 'restoration', 400, ?, 'gift-order-restore', ?, ?)`)
        .bind(id, giftCardId, `business-${id}`, redemption.entry.id, now + 30).run();
    };
    const left = restore("restoration_left");
    const right = restore("restoration_right");
    open();
    const results = await Promise.allSettled([left, right]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const restored = await env.DB.prepare(`SELECT SUM(amount_delta_minor) AS amount
      FROM gift_card_ledger_entries
      WHERE entry_type = 'restoration' AND related_entry_id = ?`)
      .bind(redemption.entry.id).first<{ amount: number }>();
    expect(restored?.amount).toBe(400);
    await env.DB.prepare(`INSERT INTO gift_card_ledger_entries
      (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
       business_key, order_id, related_entry_id, created_at)
      VALUES ('restoration_remainder', ?, 'USD', 'restoration', 200,
       'restoration-remainder', 'gift-order-restore', ?, ?)`)
      .bind(giftCardId, redemption.entry.id, now + 31).run();
    await expect(env.DB.prepare(`INSERT INTO gift_card_ledger_entries
      (id, gift_card_id, currency_code, entry_type, amount_delta_minor,
       business_key, order_id, related_entry_id, created_at)
      VALUES ('restoration_over_cap', ?, 'USD', 'restoration', 1,
       'restoration-over-cap', 'gift-order-restore', ?, ?)`)
      .bind(giftCardId, redemption.entry.id, now + 32).run())
      .rejects.toThrow();
  });
});
