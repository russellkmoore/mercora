import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import { applyTestMigrations } from "./helpers/d1";
import { Money } from "@/lib/money";
import {
  GiftCardConflictError,
  classifyGiftCardReservation,
  createGiftCardRepository,
} from "@/lib/gift-cards/repository";
import {
  digestGiftCardCode,
  generateGiftCardCode,
  giftCardCodeSuffix,
} from "@/lib/gift-cards/code";
import { parseGiftCardCodeKeyRing, parseGiftCardDeliveryKeyRing } from "@/lib/gift-cards/config";
import { giftCardReissueDeliveryId, giftCardReissueId } from "@/lib/gift-cards/domain";
import { encryptGiftCardDeliveryCode } from "@/lib/gift-cards/encryption";

/**
 * `appendGiftCardEvent` goes through `getDbAsync`, which resolves the
 * Cloudflare context via `getCloudflareContext` — unavailable under the
 * vitest-pool-workers integration harness. Same substitution as
 * `tests/integration/lib/gift-cards/gift-card-events.test.ts`: bind Drizzle
 * straight to the real `env.DB` D1 database this suite already migrates.
 */
vi.mock("@/lib/db", () => ({
  getDbAsync: async () => drizzle(env.DB, { schema }),
}));

import { appendGiftCardEvent } from "@/lib/gift-cards/events";
import type { ReserveGiftCardInput } from "@/lib/gift-cards/domain";

const now = 1_800_600_000;
const deliveryKey = "base64:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
const hmacKey = "gift-card-hmac-key-material-for-admin-action-tests-0001";
let testSequence = 0;
let giftCardId = "gift_uninitialized";
let hash = "0".repeat(64);

function runtimeEnvironment(): Record<string, unknown> & { DB: D1Database } {
  return {
    DB: env.DB,
    GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "1",
    GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: hmacKey }),
    GIFT_CARD_DELIVERY_CURRENT_VERSION: "1",
    GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({ 1: deliveryKey }),
  };
}

/** A second, guaranteed-distinct 64-hex digest for a sibling card within the same test. */
function altDigest(offset: number): string {
  return (testSequence * 1_000 + offset).toString(16).padStart(64, "0");
}

async function issueTestAccount(overrides: { id?: string; digest?: string; amountMinor?: number } = {}): Promise<string> {
  const repository = createGiftCardRepository(env.DB);
  const id = overrides.id ?? giftCardId;
  await repository.issueAccount({
    id,
    codeHash: { keyVersion: 1, digest: overrides.digest ?? hash },
    amount: Money.fromMinor(overrides.amountMinor ?? 1_000, "USD"),
    createdAt: now,
    delivery: {
      id: `${id}_delivery`,
      recipientEmail: "buyer@example.test",
      emailIdempotencyKey: `gift-card-delivery/${id}/v1`,
      codeCiphertext: "ciphertext-placeholder",
      codeNonce: "nonce-placeholder",
      codeKeyVersion: 1,
    },
  });
  return id;
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

function reservation(
  id: string,
  requestedAmount: number,
  overrides: Partial<ReserveGiftCardInput> = {},
): ReserveGiftCardInput {
  return {
    id,
    giftCardId,
    requestKey: `checkout-${id}`,
    quoteFingerprint: "b".repeat(64),
    requestedAmount: Money.fromMinor(requestedAmount, "USD"),
    reservedAt: now,
    expiresAt: now + 600,
    ...overrides,
  };
}

/**
 * Mirrors exactly what `POST .../reissue` does — generate the new card's
 * bearer material, call `repository.reissue`, then write the paired
 * `reissued`/`reissued_from` events — as two direct calls against real D1
 * rather than through the HTTP route layer, matching this codebase's
 * established integration-test pattern (repository/service functions
 * exercised directly; see `tests/integration/lib/gift-cards/repository.test.ts`
 * and `gift-card-events.test.ts`, neither of which invokes a Next.js route
 * handler under vitest-pool-workers).
 */
async function performReissue(oldGiftCardId: string, to = "buyer@example.test") {
  const repository = createGiftCardRepository(env.DB);
  const environment = runtimeEnvironment();
  const newGiftCardId = await giftCardReissueId(oldGiftCardId);
  const newDeliveryId = await giftCardReissueDeliveryId(oldGiftCardId);
  const code = generateGiftCardCode();
  const codeHash = await digestGiftCardCode(code, parseGiftCardCodeKeyRing(environment));
  if (!codeHash) throw new Error("test setup: generated code failed to digest");
  const encrypted = await encryptGiftCardDeliveryCode({
    giftCardId: newGiftCardId,
    deliveryId: newDeliveryId,
    code,
    keyRing: parseGiftCardDeliveryKeyRing(environment),
  });
  const result = await repository.reissue({
    oldGiftCardId,
    now,
    codeHash,
    codeSuffix: giftCardCodeSuffix(code) ?? undefined,
    delivery: {
      id: newDeliveryId,
      recipientEmail: to,
      emailIdempotencyKey: `gift-card-delivery/${newGiftCardId}/v1`,
      codeCiphertext: encrypted.ciphertext,
      codeNonce: encrypted.nonce,
      codeKeyVersion: encrypted.keyVersion,
    },
  });
  await appendGiftCardEvent({
    giftCardId: oldGiftCardId,
    eventType: "reissued",
    actor: { type: "admin", id: "user_admin" },
    details: { to_gift_card_id: result.newGiftCardId, amount_minor: result.amount.toMinorUnits(), recipient_email: to },
    createdAt: now,
  });
  await appendGiftCardEvent({
    giftCardId: result.newGiftCardId,
    eventType: "reissued_from",
    actor: { type: "admin", id: "user_admin" },
    details: { from_gift_card_id: oldGiftCardId },
    createdAt: now,
  });
  return result;
}

describe("gift-card admin mutation routes against real D1 (D-05, D-06, D-09, D-10)", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(() => {
    testSequence += 1;
    giftCardId = `gift_admin_test_${testSequence}`;
    hash = testSequence.toString(16).padStart(64, "0");
  });

  it("disables an active card once and writes exactly one disabled event carrying the reason", async () => {
    await issueTestAccount();
    const repository = createGiftCardRepository(env.DB);

    const disabled = await repository.disableAccount({ giftCardId, disabledAt: now });
    expect(disabled.changed).toBe(true);
    expect(disabled.account.status).toBe("disabled");
    await appendGiftCardEvent({
      giftCardId,
      eventType: "disabled",
      actor: { type: "admin", id: "user_admin" },
      details: { reason: "fraud investigation" },
      createdAt: now,
    });

    const retry = await repository.disableAccount({ giftCardId, disabledAt: now + 1 });
    expect(retry.changed).toBe(false);

    const events = await env.DB.prepare(
      `SELECT event_type, details FROM gift_card_events WHERE gift_card_id = ? AND event_type = 'disabled'`,
    ).bind(giftCardId).all<{ event_type: string; details: string }>();
    expect(events.results).toHaveLength(1);
    expect(JSON.parse(events.results[0]!.details)).toEqual({ reason: "fraud investigation" });

    const row = await env.DB.prepare(`SELECT status, disabled_at FROM gift_card_accounts WHERE id = ?`)
      .bind(giftCardId).first<{ status: string; disabled_at: number }>();
    expect(row?.status).toBe("disabled");
    expect(row?.disabled_at).toBe(now);
  });

  it("re-queues a needs_review delivery back to pending and writes one delivery_requeued event", async () => {
    await issueTestAccount();
    // The 0022 CHECKs require claim_token/lease_expires_at to be NULL for any
    // non-processing status, and completed_at to be set for 'sent'/'needs_review'
    // — `needs_review` (a terminal-attempt status, not the in-flight
    // `processing` claim) carries neither claim fields, but does carry completed_at.
    await env.DB.prepare(`UPDATE gift_card_deliveries SET status = 'needs_review', attempt_count = 8,
      completed_at = ? WHERE gift_card_id = ?`)
      .bind(now, giftCardId).run();

    const repository = createGiftCardRepository(env.DB);
    const result = await repository.requeueDelivery({ giftCardId, now: now + 10 });
    expect(result.requeued).toBe(true);
    await appendGiftCardEvent({
      giftCardId,
      eventType: "delivery_requeued",
      actor: { type: "admin", id: "user_admin" },
      details: { delivery_id: result.deliveryId },
      createdAt: now + 10,
    });

    const row = await env.DB.prepare(`SELECT status, attempt_count, claim_token, lease_expires_at
      FROM gift_card_deliveries WHERE gift_card_id = ?`).bind(giftCardId)
      .first<{ status: string; attempt_count: number; claim_token: string | null; lease_expires_at: number | null }>();
    expect(row).toMatchObject({ status: "pending", attempt_count: 0, claim_token: null, lease_expires_at: null });

    const events = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_events WHERE gift_card_id = ? AND event_type = 'delivery_requeued'`,
    ).bind(giftCardId).first<{ count: number }>();
    expect(events?.count).toBe(1);
  });

  it("releases an open hold and leaves exactly one hold_released row for that card", async () => {
    await issueTestAccount({ amountMinor: 1_000 });
    const repository = createGiftCardRepository(env.DB);
    const reserved = await repository.reserve(reservation("res_admin_1", 400));
    expect(reserved.available).toBe(true);

    const reservations = await repository.findReservations(giftCardId);
    const open = reservations.find((candidate) => candidate.id === "res_admin_1");
    expect(open).toBeDefined();
    expect(classifyGiftCardReservation(open!, now)).toBe("open");

    const released = await repository.releaseReservation({
      reservationId: "res_admin_1",
      reason: "admin:user_admin",
      releasedAt: now,
    });
    expect(released.released).toBe(true);
    await appendGiftCardEvent({
      giftCardId,
      eventType: "hold_released",
      actor: { type: "admin", id: "user_admin" },
      details: { reservation_id: "res_admin_1", amount_minor: released.reservation.amount.toMinorUnits() },
      createdAt: now,
    });

    const events = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_events WHERE gift_card_id = ? AND event_type = 'hold_released'`,
    ).bind(giftCardId).first<{ count: number }>();
    expect(events?.count).toBe(1);

    const row = await env.DB.prepare(`SELECT released_at, release_reason FROM gift_card_reservations WHERE id = ?`)
      .bind("res_admin_1").first<{ released_at: number; release_reason: string }>();
    expect(row).toMatchObject({ released_at: now, release_reason: "admin:user_admin" });
  });

  it("refuses to release a committed-unsettled reservation, leaving no released row and no event", async () => {
    await issueTestAccount({ amountMinor: 1_000 });
    await insertPendingOrder("order-admin-1");
    const repository = createGiftCardRepository(env.DB);
    await repository.reserve(reservation("res_admin_committed", 400));
    await repository.commitReservation({
      reservationId: "res_admin_committed",
      orderId: "order-admin-1",
      expectedAmount: Money.fromMinor(400, "USD"),
      committedAt: now,
    });

    const reservations = await repository.findReservations(giftCardId);
    const committed = reservations.find((candidate) => candidate.id === "res_admin_committed");
    expect(classifyGiftCardReservation(committed!, now)).toBe("committed_unsettled");

    await expect(
      repository.releaseReservation({ reservationId: "res_admin_committed", reason: "admin:user_admin", releasedAt: now }),
    ).rejects.toThrow(GiftCardConflictError);

    const events = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_events WHERE gift_card_id = ? AND event_type = 'hold_released'`,
    ).bind(giftCardId).first<{ count: number }>();
    expect(events?.count).toBe(0);
  });

  it("reissues a disabled card once, and a second attempt fails leaving exactly one adjustment, one new account, and one reissued event", async () => {
    await issueTestAccount({ amountMinor: 1_500 });
    const repository = createGiftCardRepository(env.DB);
    await repository.disableAccount({ giftCardId, disabledAt: now });

    const first = await performReissue(giftCardId);
    expect(first.amount.toMinorUnits()).toBe(1_500);

    await expect(performReissue(giftCardId)).rejects.toThrow(GiftCardConflictError);

    const adjustments = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_ledger_entries WHERE gift_card_id = ? AND entry_type = 'adjustment'`,
    ).bind(giftCardId).first<{ count: number }>();
    expect(adjustments?.count).toBe(1);

    const newAccounts = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_accounts WHERE id = ?`,
    ).bind(first.newGiftCardId).first<{ count: number }>();
    expect(newAccounts?.count).toBe(1);

    const reissuedEvents = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_events WHERE gift_card_id = ? AND event_type = 'reissued'`,
    ).bind(giftCardId).first<{ count: number }>();
    expect(reissuedEvents?.count).toBe(1);

    const reissuedFromEvents = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_events WHERE gift_card_id = ? AND event_type = 'reissued_from'`,
    ).bind(first.newGiftCardId).first<{ count: number }>();
    expect(reissuedFromEvents?.count).toBe(1);
  });

  it("refuses to reissue an active card and writes nothing", async () => {
    await issueTestAccount({ amountMinor: 500 });
    await expect(performReissue(giftCardId)).rejects.toThrow(GiftCardConflictError);

    const events = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM gift_card_events WHERE gift_card_id = ?`,
    ).bind(giftCardId).first<{ count: number }>();
    expect(events?.count).toBe(0);
  });
});
