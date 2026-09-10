import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import { applyTestMigrations } from "../../helpers/d1";
import { Money } from "@/lib/money";
import { createGiftCardRepository } from "@/lib/gift-cards/repository";
import type { IssueGiftCardInput } from "@/lib/gift-cards/domain";

// `appendGiftCardEvent`/`listGiftCardEvents` go through `getDbAsync`, which
// resolves the Cloudflare context via `getCloudflareContext` — unavailable
// under the vitest-pool-workers integration harness. Same substitution as
// `tests/integration/content-publication-models.test.ts`: bind Drizzle
// straight to the real `env.DB` D1 database this suite already migrates.
vi.mock("@/lib/db", () => ({
  getDbAsync: async () => drizzle(env.DB, { schema }),
}));

import {
  GIFT_CARD_EVENT_TYPES,
  assertGiftCardEventDetails,
  appendGiftCardEvent,
  listGiftCardEvents,
} from "@/lib/gift-cards/events";
import { buildGiftCardTimeline } from "@/lib/gift-cards/timeline";
import { listAdminGiftCardPresentations } from "@/lib/gift-cards/presentations";
import type { ReserveGiftCardInput } from "@/lib/gift-cards/domain";

const now = 1_800_500_000;
let testSequence = 0;
let giftCardId = "gift_uninitialized";
let hash = "0".repeat(64);

/** A second, guaranteed-distinct 64-hex digest for a sibling card within the same test. */
function altDigest(offset: number): string {
  return (testSequence * 1_000 + offset).toString(16).padStart(64, "0");
}

function issuance(overrides: Partial<IssueGiftCardInput> = {}): IssueGiftCardInput {
  return {
    id: giftCardId,
    codeHash: { keyVersion: 1, digest: hash },
    amount: Money.fromMinor(1_000, "USD"),
    createdAt: now,
    ...overrides,
  };
}

async function issueTestAccount(id = giftCardId, digest = hash): Promise<void> {
  const repository = createGiftCardRepository(env.DB);
  await repository.issueAccount(issuance({ id, codeHash: { keyVersion: 1, digest } }));
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

describe("gift-card events on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(() => {
    testSequence += 1;
    giftCardId = `gift_events_test_${testSequence}`;
    hash = testSequence.toString(16).padStart(64, "0");
  });

  it("has exactly the nine-member D-03 event vocabulary", () => {
    expect(GIFT_CARD_EVENT_TYPES).toHaveLength(9);
    expect(GIFT_CARD_EVENT_TYPES).toEqual([
      "note",
      "disabled",
      "reissued",
      "reissued_from",
      "delivery_resent",
      "delivery_requeued",
      "hold_released",
      "admin_created",
      "code_revealed",
    ]);
  });

  it("writes an event and reads back an integer epoch created_at, not an ISO string", async () => {
    await issueTestAccount();
    const eventId = await appendGiftCardEvent({
      giftCardId,
      eventType: "note",
      actor: { type: "admin", id: "admin_1" },
      details: { text: "called the customer" },
      createdAt: now,
    });
    expect(typeof eventId).toBe("string");

    const row = await env.DB.prepare(`SELECT created_at FROM gift_card_events WHERE id = ?`)
      .bind(eventId).first<{ created_at: unknown }>();
    expect(typeof row?.created_at).toBe("number");
    expect(row?.created_at).toBe(now);
  });

  it("stores both actor fields for an admin actor and a null actor id for a system actor", async () => {
    await issueTestAccount();
    const adminEventId = await appendGiftCardEvent({
      giftCardId,
      eventType: "note",
      actor: { type: "admin", id: "admin_42" },
      createdAt: now,
    });
    const systemEventId = await appendGiftCardEvent({
      giftCardId,
      eventType: "delivery_requeued",
      actor: { type: "system", id: null },
      createdAt: now + 1,
    });

    const adminRow = await env.DB.prepare(`SELECT actor_type, actor_id FROM gift_card_events WHERE id = ?`)
      .bind(adminEventId).first<{ actor_type: string; actor_id: string | null }>();
    const systemRow = await env.DB.prepare(`SELECT actor_type, actor_id FROM gift_card_events WHERE id = ?`)
      .bind(systemEventId).first<{ actor_type: string; actor_id: string | null }>();

    expect(adminRow).toEqual({ actor_type: "admin", actor_id: "admin_42" });
    expect(systemRow).toEqual({ actor_type: "system", actor_id: null });
  });

  it("lists events for one card only, bounded, newest first", async () => {
    await issueTestAccount();
    const otherId = `${giftCardId}_other`;
    await issueTestAccount(otherId, altDigest(1));

    await appendGiftCardEvent({
      giftCardId, eventType: "note", actor: { type: "admin", id: "admin_1" }, createdAt: now,
    });
    await appendGiftCardEvent({
      giftCardId, eventType: "note", actor: { type: "admin", id: "admin_1" }, createdAt: now + 10,
    });
    await appendGiftCardEvent({
      giftCardId: otherId, eventType: "note", actor: { type: "admin", id: "admin_1" }, createdAt: now + 5,
    });

    const events = await listGiftCardEvents(giftCardId, 10);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.giftCardId === giftCardId)).toBe(true);
    expect(events[0]?.createdAt).toBe(now + 10);
    expect(events[1]?.createdAt).toBe(now);
  });

  it("rejects a second reissued event for the same card as a thrown error, not a silent no-op", async () => {
    await issueTestAccount();
    await appendGiftCardEvent({
      giftCardId,
      eventType: "reissued",
      actor: { type: "admin", id: "admin_1" },
      details: { to_gift_card_id: "gift_new_1", amount_minor: 500 },
      createdAt: now,
    });

    await expect(appendGiftCardEvent({
      giftCardId,
      eventType: "reissued",
      actor: { type: "admin", id: "admin_1" },
      details: { to_gift_card_id: "gift_new_2", amount_minor: 500 },
      createdAt: now + 1,
    })).rejects.toThrow();

    const events = await listGiftCardEvents(giftCardId, 10);
    expect(events.filter((event) => event.eventType === "reissued")).toHaveLength(1);
  });

  it("assertGiftCardEventDetails rejects a details object containing any forbidden key, nested or not", () => {
    expect(() => assertGiftCardEventDetails({ codeHash: "abc" })).toThrow(TypeError);
    expect(() => assertGiftCardEventDetails({ code_hash: "abc" })).toThrow(TypeError);
    expect(() => assertGiftCardEventDetails({ nested: { claim_token: "abc" } })).toThrow(TypeError);
    expect(() => assertGiftCardEventDetails({ list: [{ email_idempotency_key: "abc" }] })).toThrow(TypeError);
    expect(() => assertGiftCardEventDetails({ gift_card_reissue_business_key: "abc" })).toThrow(TypeError);
    expect(() => assertGiftCardEventDetails({ safe: "ok", nested: { alsoSafe: 1 } })).not.toThrow();
    expect(() => assertGiftCardEventDetails(undefined)).not.toThrow();
  });

  it("refuses to write an event whose details contain a forbidden key, and writes nothing", async () => {
    await issueTestAccount();
    await expect(appendGiftCardEvent({
      giftCardId,
      eventType: "note",
      actor: { type: "admin", id: "admin_1" },
      details: { claim_token: "leaked" },
      createdAt: now,
    })).rejects.toThrow(TypeError);

    const events = await listGiftCardEvents(giftCardId, 10);
    expect(events).toHaveLength(0);
  });
});

describe("buildGiftCardTimeline on real D1", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(() => {
    testSequence += 1;
    giftCardId = `gift_timeline_test_${testSequence}`;
    hash = testSequence.toString(16).padStart(64, "0");
  });

  it("merges the issuance, a hold, its release, and a note, oldest first", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());

    const reserved = await repository.reserve(reservation("reservation_1", 400, {
      reservedAt: now + 10,
      expiresAt: now + 600,
    }));
    expect(reserved.available).toBe(true);

    await repository.releaseReservation({
      reservationId: "reservation_1",
      reason: "admin:admin_1",
      releasedAt: now + 20,
    });

    await appendGiftCardEvent({
      giftCardId,
      eventType: "note",
      actor: { type: "admin", id: "admin_1" },
      details: { text: "test note" },
      createdAt: now + 30,
    });

    const { entries } = await buildGiftCardTimeline({
      database: env.DB,
      giftCardId,
      now: now + 100,
    });

    expect(entries.map((entry) => entry.type)).toEqual(["issuance", "hold", "released", "note"]);
    expect(entries.map((entry) => entry.createdAt)).toEqual([now, now + 10, now + 20, now + 30]);
    const released = entries.find((entry) => entry.type === "released");
    expect(released?.details).toMatchObject({ reason: "admin:admin_1" });
    const note = entries.find((entry) => entry.type === "note");
    expect(note).toMatchObject({
      source: "event", actorType: "admin", actorId: "admin_1", details: { text: "test note" },
    });
  });
});

async function insertTestPersonCustomer(id: string, person: Record<string, unknown>): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO customers (id, type, person) VALUES (?, 'person', ?)`,
  ).bind(id, JSON.stringify(person)).run();
}

describe("listAdminGiftCardPresentations search and projection (D-14, D-15)", () => {
  beforeAll(async () => {
    await applyTestMigrations();
  });

  beforeEach(() => {
    testSequence += 1;
    giftCardId = `gift_search_test_${testSequence}`;
    hash = testSequence.toString(16).padStart(64, "0");
  });

  it("carries id, codeSuffix, maskedCode, recipientEmail, and a resolved purchaser", async () => {
    const repository = createGiftCardRepository(env.DB);
    const customerId = `customer_${testSequence}`;
    await insertTestPersonCustomer(customerId, { email: "jane@example.com", full_name: "Jane Doe" });
    await repository.issueAccount(issuance({
      codeSuffix: "4A7K",
      purchaserCustomerId: customerId,
      delivery: {
        id: `${giftCardId}_delivery`,
        recipientEmail: "recipient@example.com",
        emailIdempotencyKey: `${giftCardId}_idem`,
        codeCiphertext: "c".repeat(10),
        codeNonce: "n".repeat(10),
        codeKeyVersion: 1,
      },
    }));

    const { cards, total } = await listAdminGiftCardPresentations({
      database: env.DB, now: now + 1, limit: 10, offset: 0,
    });
    expect(total).toBe(1);
    expect(cards[0]).toMatchObject({
      id: giftCardId,
      codeSuffix: "4A7K",
      maskedCode: "GC-****-****-****-****-****-****-4A7K",
      recipientEmail: "recipient@example.com",
      purchaser: "Jane Doe",
    });
  });

  it("renders a null maskedCode for a card with no stored code suffix", async () => {
    const repository = createGiftCardRepository(env.DB);
    await repository.issueAccount(issuance());
    const { cards } = await listAdminGiftCardPresentations({
      database: env.DB, now: now + 1, limit: 10, offset: 0,
    });
    expect(cards[0]).toMatchObject({ codeSuffix: undefined, maskedCode: null });
  });

  it("matches an exact order id, an exact recipient email, and an exact suffix, case-insensitively for the latter two", async () => {
    const repository = createGiftCardRepository(env.DB);
    await insertPendingOrder(`order_${testSequence}`);
    const orderCardId = `${giftCardId}_order`;
    await repository.issueAccount(issuance({
      id: orderCardId,
      codeHash: { keyVersion: 1, digest: altDigest(1) },
      issuedOrderId: `order_${testSequence}`,
      issuedLineId: "line_1",
      codeSuffix: "9WXZ",
      delivery: {
        id: `${orderCardId}_delivery`,
        recipientEmail: "Search-Target@Example.com",
        emailIdempotencyKey: `${orderCardId}_idem`,
        codeCiphertext: "c".repeat(10),
        codeNonce: "n".repeat(10),
        codeKeyVersion: 1,
      },
    }));
    // A sibling card that must never match any of the three queries below.
    await repository.issueAccount(issuance({
      id: `${giftCardId}_other`,
      codeHash: { keyVersion: 1, digest: altDigest(2) },
      codeSuffix: "PQRS",
    }));

    const byOrderId = await listAdminGiftCardPresentations({
      database: env.DB, now: now + 1, limit: 10, offset: 0, q: `order_${testSequence}`,
    });
    expect(byOrderId.total).toBe(1);
    expect(byOrderId.cards[0]?.id).toBe(orderCardId);

    const byEmail = await listAdminGiftCardPresentations({
      database: env.DB, now: now + 1, limit: 10, offset: 0, q: "search-target@example.com",
    });
    expect(byEmail.total).toBe(1);
    expect(byEmail.cards[0]?.id).toBe(orderCardId);

    const bySuffix = await listAdminGiftCardPresentations({
      database: env.DB, now: now + 1, limit: 10, offset: 0, q: "9wxz",
    });
    expect(bySuffix.total).toBe(1);
    expect(bySuffix.cards[0]?.id).toBe(orderCardId);

    const noMatch = await listAdminGiftCardPresentations({
      database: env.DB, now: now + 1, limit: 10, offset: 0, q: "no-such-card-anywhere",
    });
    expect(noMatch.total).toBe(0);
    expect(noMatch.cards).toHaveLength(0);
  });
});
