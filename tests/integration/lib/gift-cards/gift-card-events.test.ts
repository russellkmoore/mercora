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
