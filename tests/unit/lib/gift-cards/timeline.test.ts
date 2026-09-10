import { describe, expect, it } from "vitest";
import { buildGiftCardTimeline } from "@/lib/gift-cards/timeline";

interface LedgerFixtureRow {
  id: string;
  entry_type: "issuance" | "redemption" | "restoration" | "adjustment";
  amount_delta_minor: number;
  order_id: string | null;
  created_at: number;
}

interface ReservationFixtureRow {
  id: string;
  gift_card_id: string;
  currency_code: string;
  request_key: string;
  quote_fingerprint: string;
  requested_amount_minor: number;
  amount_minor: number;
  reserved_at: number;
  expires_at: number;
  committed_order_id: string | null;
  committed_at: number | null;
  released_at: number | null;
  release_reason: string | null;
  settled: number;
}

interface DeliveryFixtureRow {
  id: string;
  order_id: string | null;
  status: "pending" | "processing" | "sent" | "needs_review";
  created_at: number;
  completed_at: number | null;
}

interface EventFixtureRow {
  id: string;
  event_type: string;
  actor_type: "admin" | "service" | "system";
  actor_id: string | null;
  details: string | null;
  created_at: number;
}

interface AdminUserFixtureRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface FixtureTables {
  ledger?: LedgerFixtureRow[];
  reservations?: ReservationFixtureRow[];
  delivery?: DeliveryFixtureRow | null;
  events?: EventFixtureRow[];
  adminUsers?: AdminUserFixtureRow[];
}

/** Hand-written D1 fake: prepare/bind/all/first, routed by table name in the SQL text. */
function fakeDatabase(tables: FixtureTables): D1Database {
  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      all: async <T>() => {
        if (sql.includes("FROM gift_card_ledger_entries")) {
          return { results: (tables.ledger ?? []) as unknown as T[] };
        }
        if (sql.includes("FROM gift_card_reservations")) {
          return { results: (tables.reservations ?? []) as unknown as T[] };
        }
        if (sql.includes("FROM gift_card_events")) {
          return { results: (tables.events ?? []) as unknown as T[] };
        }
        if (sql.includes("FROM admin_users")) {
          const ids = params as string[];
          return {
            results: (tables.adminUsers ?? []).filter((row) => ids.includes(row.user_id)) as unknown as T[],
          };
        }
        return { results: [] as unknown as T[] };
      },
      first: async <T>() => {
        if (sql.includes("FROM gift_card_deliveries")) {
          return (tables.delivery ?? null) as unknown as T | null;
        }
        return null as unknown as T | null;
      },
    }),
  });
  return { prepare } as unknown as D1Database;
}

const now = 1_800_000_000;

describe("buildGiftCardTimeline", () => {
  it("merges all four sources, oldest first, regardless of source order", async () => {
    const database = fakeDatabase({
      ledger: [{
        id: "ledger_issuance", entry_type: "issuance", amount_delta_minor: 1_000,
        order_id: "order_1", created_at: now - 400,
      }],
      reservations: [{
        id: "reservation_1", gift_card_id: "gift_1", currency_code: "USD",
        request_key: "checkout-1", quote_fingerprint: "f".repeat(64),
        requested_amount_minor: 500, amount_minor: 500,
        reserved_at: now - 300, expires_at: now + 600,
        committed_order_id: null, committed_at: null,
        released_at: null, release_reason: null, settled: 0,
      }],
      delivery: {
        id: "delivery_1", order_id: "order_1", status: "sent",
        created_at: now - 350, completed_at: now - 200,
      },
      events: [{
        id: "event_1", event_type: "note", actor_type: "admin", actor_id: "admin_1",
        details: JSON.stringify({ text: "called the customer" }), created_at: now - 100,
      }],
    });

    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });

    expect(entries.map((entry) => entry.source)).toEqual(["ledger", "delivery", "reservation", "delivery", "event"]);
    const createdAts = entries.map((entry) => entry.createdAt);
    expect(createdAts).toEqual([...createdAts].sort((left, right) => left - right));
  });

  it("attributes a ledger entry produced by an order to that order, with no label when there is none", async () => {
    const database = fakeDatabase({
      ledger: [
        { id: "l1", entry_type: "issuance", amount_delta_minor: 1_000, order_id: "order_9", created_at: now - 300 },
        { id: "l2", entry_type: "adjustment", amount_delta_minor: -1_000, order_id: null, created_at: now - 100 },
      ],
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    expect(entries[0]).toMatchObject({
      type: "issuance", actorType: "system", actorId: "order_9", actorLabel: "order order_9",
      details: { amountMinor: 1_000, orderId: "order_9" },
    });
    expect(entries[1]).toMatchObject({
      type: "adjustment", actorType: "system", actorId: null, actorLabel: null,
      details: { amountMinor: -1_000 },
    });
    expect(entries[1]?.details).not.toHaveProperty("orderId");
  });

  it("labels a restoration entry as a refund back to the card", async () => {
    const database = fakeDatabase({
      ledger: [{
        id: "l1", entry_type: "restoration", amount_delta_minor: 500, order_id: "order_5", created_at: now,
      }],
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    expect(entries[0]?.type).toBe("refund");
    expect(entries[0]?.details).toMatchObject({ amountMinor: 500, orderId: "order_5" });
  });

  it("gives a committed-unsettled reservation an awaiting-settlement entry and no release entry", async () => {
    const database = fakeDatabase({
      reservations: [{
        id: "reservation_unsettled", gift_card_id: "gift_1", currency_code: "USD",
        request_key: "checkout-2", quote_fingerprint: "a".repeat(64),
        requested_amount_minor: 300, amount_minor: 300,
        reserved_at: now - 200, expires_at: now + 400,
        committed_order_id: "order_2", committed_at: now - 150,
        released_at: null, release_reason: null, settled: 0,
      }],
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    const types = entries.map((entry) => entry.type);
    expect(types).toEqual(["hold", "awaiting_settlement"]);
    expect(types).not.toContain("released");
    const awaiting = entries.find((entry) => entry.type === "awaiting_settlement");
    expect(awaiting).toMatchObject({ actorType: "system", actorId: "order_2", actorLabel: "order order_2" });
  });

  it("gives a released reservation a hold entry and a release entry carrying the reason", async () => {
    const database = fakeDatabase({
      reservations: [{
        id: "reservation_released", gift_card_id: "gift_1", currency_code: "USD",
        request_key: "checkout-3", quote_fingerprint: "b".repeat(64),
        requested_amount_minor: 200, amount_minor: 200,
        reserved_at: now - 500, expires_at: now + 100,
        committed_order_id: null, committed_at: null,
        released_at: now - 450, release_reason: "admin:admin_1", settled: 0,
      }],
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    // reserved_at (now - 500) precedes released_at (now - 450): hold, then release.
    expect(entries.map((entry) => entry.type)).toEqual(["hold", "released"]);
    const released = entries.find((entry) => entry.type === "released");
    expect(released?.details).toMatchObject({ reason: "admin:admin_1" });
  });

  it("contributes only a hold entry for a settled reservation, leaving settlement to the ledger", async () => {
    const database = fakeDatabase({
      ledger: [{
        id: "l1", entry_type: "redemption", amount_delta_minor: -600, order_id: "order_3", created_at: now - 50,
      }],
      reservations: [{
        id: "reservation_settled", gift_card_id: "gift_1", currency_code: "USD",
        request_key: "checkout-4", quote_fingerprint: "c".repeat(64),
        requested_amount_minor: 600, amount_minor: 600,
        reserved_at: now - 100, expires_at: now + 100,
        committed_order_id: "order_3", committed_at: now - 80,
        released_at: null, release_reason: null, settled: 1,
      }],
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    const types = entries.map((entry) => entry.type);
    expect(types).toEqual(["hold", "redemption"]);
  });

  it("contributes a delivery-created entry and, once completed, an entry naming the terminal status", async () => {
    const database = fakeDatabase({
      delivery: {
        id: "delivery_1", order_id: "order_7", status: "needs_review",
        created_at: now - 200, completed_at: now - 50,
      },
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    expect(entries.map((entry) => entry.type)).toEqual(["delivery_created", "delivery_needs_review"]);
  });

  it("contributes only a delivery-created entry while the delivery has not completed", async () => {
    const database = fakeDatabase({
      delivery: { id: "delivery_1", order_id: null, status: "pending", created_at: now, completed_at: null },
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    expect(entries.map((entry) => entry.type)).toEqual(["delivery_created"]);
  });

  it("passes gift_card_events rows through with their own type, actor, and details", async () => {
    const database = fakeDatabase({
      events: [{
        id: "event_1", event_type: "disabled", actor_type: "admin", actor_id: "admin_2",
        details: JSON.stringify({ reason: "fraud recovery" }), created_at: now,
      }],
      adminUsers: [{ user_id: "admin_2", email: "ops@example.com", display_name: "Ops Team" }],
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    expect(entries).toEqual([{
      id: "event_1", type: "disabled", source: "event",
      actorType: "admin", actorId: "admin_2", actorLabel: "Ops Team",
      details: { reason: "fraud recovery" }, createdAt: now,
    }]);
  });

  it("resolves an admin actor's label from admin_users and yields null, not a throw, for an unresolvable id", async () => {
    const database = fakeDatabase({
      events: [
        {
          id: "e1", event_type: "note", actor_type: "admin", actor_id: "admin_known",
          details: null, created_at: now - 10,
        },
        {
          id: "e2", event_type: "note", actor_type: "admin", actor_id: "admin_ghost",
          details: null, created_at: now,
        },
      ],
      adminUsers: [{ user_id: "admin_known", email: "known@example.com", display_name: null }],
    });
    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    expect(entries[0]).toMatchObject({ actorId: "admin_known", actorLabel: "known@example.com" });
    expect(entries[1]).toMatchObject({ actorId: "admin_ghost", actorLabel: null });
  });

  it("does not throw when the admin_users lookup itself fails, and degrades every admin label to null", async () => {
    const database: D1Database = {
      prepare: (sql: string) => ({
        bind: (..._params: unknown[]) => ({
          all: async <T>() => {
            if (sql.includes("FROM admin_users")) throw new Error("d1 unavailable");
            if (sql.includes("FROM gift_card_events")) {
              return {
                results: [{
                  id: "e1", event_type: "note", actor_type: "admin", actor_id: "admin_1",
                  details: null, created_at: now,
                }] as unknown as T[],
              };
            }
            return { results: [] as unknown as T[] };
          },
          first: async <T>() => null as unknown as T | null,
        }),
      }),
    } as unknown as D1Database;

    const { entries } = await buildGiftCardTimeline({ database, giftCardId: "gift_1", now });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actorLabel).toBeNull();
  });
});
