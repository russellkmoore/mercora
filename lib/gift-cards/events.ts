import { desc, eq } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { giftCardEvents, type GiftCardEventRow } from "@/lib/db/schema/gift-cards";
import type { Actor } from "@/lib/fulfillment/types";

/**
 * D-03: the closed application-side event vocabulary for `gift_card_events`.
 * The database column has no CHECK (matching `order_events`), so this const
 * tuple — and the source contract in
 * `tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts` — are
 * what pin it.
 */
export const GIFT_CARD_EVENT_TYPES = [
  "note",
  "disabled",
  "reissued",
  "reissued_from",
  "delivery_resent",
  "delivery_requeued",
  "hold_released",
  "admin_created",
  "code_revealed",
] as const;

export type GiftCardEventType = (typeof GIFT_CARD_EVENT_TYPES)[number];

/**
 * D-03/D-14: a `gift_card_events.details` payload — written by a route or
 * read at timeline-assembly time — must never carry any of these, nor any key
 * ending in `business_key`/`businessKey`. Kept as one exported array so the
 * runtime check here and the source-contract grep in
 * `admin-gift-card-forbidden-columns.test.ts` read from the same list.
 */
export const GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS = [
  "code_hash",
  "code_ciphertext",
  "code_nonce",
  "code_key_version",
  "claim_token",
  "email_idempotency_key",
] as const;

const DEFAULT_GIFT_CARD_EVENT_LIMIT = 100;
const MAX_GIFT_CARD_EVENT_LIMIT = 500;

/** Strips underscores and case so `code_hash`, `codeHash`, and `CodeHash` all compare equal. */
function normalizeDetailKey(key: string): string {
  return key.replace(/_/g, "").toLowerCase();
}

const NORMALIZED_FORBIDDEN_KEYS = new Set(
  GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS.map(normalizeDetailKey),
);

function isForbiddenDetailKey(key: string): boolean {
  const normalized = normalizeDetailKey(key);
  return NORMALIZED_FORBIDDEN_KEYS.has(normalized) || normalized.endsWith("businesskey");
}

/**
 * D-03/D-14: throws when `details` (or any object nested inside it, at any
 * depth, including inside arrays) carries a forbidden key. Called before
 * every `appendGiftCardEvent` insert, and reused by `timeline.ts` so the same
 * check applies to entries assembled at read time.
 */
export function assertGiftCardEventDetails(details: Record<string, unknown> | undefined): void {
  if (details === undefined) return;
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenDetailKey(key)) {
        throw new TypeError(`gift-card event details must not contain the forbidden key "${key}"`);
      }
      walk(nested);
    }
  };
  walk(details);
}

export interface AppendGiftCardEventInput {
  giftCardId: string;
  eventType: GiftCardEventType;
  actor: Actor;
  details?: Record<string, unknown>;
  /** Epoch seconds. Defaults to now — callers pass an explicit value in tests. */
  createdAt?: number;
  /**
   * Pre-minted event id (D-08): resend needs the event id *before* the write
   * so it can fold it into the sender's idempotency key
   * (`gift-card-resend/{deliveryId}/{eventId}`) and still have the audit row
   * land under that same id. Defaults to a fresh `crypto.randomUUID()` —
   * every other caller is unaffected.
   */
  id?: string;
}

/**
 * D-03/D-11: write one durable, attributed audit row. Uses the plain
 * `db.insert(...).values({...})` idiom from `recordEmailEvent`
 * (`lib/fulfillment/service.ts`) rather than an idempotent upsert — unlike the
 * ledger, an audit row has no natural retry key, and the one event this table
 * must refuse to duplicate (`reissued`) is enforced by the D-01 partial
 * UNIQUE index, whose rejection is left to propagate rather than swallowed.
 */
export async function appendGiftCardEvent(input: AppendGiftCardEventInput): Promise<string> {
  assertGiftCardEventDetails(input.details);
  const db = await getDbAsync();
  const id = input.id ?? crypto.randomUUID();
  await db.insert(giftCardEvents).values({
    id,
    giftCardId: input.giftCardId,
    eventType: input.eventType,
    actorType: input.actor.type,
    actorId: input.actor.id,
    details: input.details ?? null,
    createdAt: input.createdAt ?? Math.floor(Date.now() / 1_000),
  });
  return id;
}

/** D-04: every event for one card, newest first, bounded to a maximum page size. */
export async function listGiftCardEvents(
  giftCardId: string,
  limit: number = DEFAULT_GIFT_CARD_EVENT_LIMIT,
): Promise<GiftCardEventRow[]> {
  const bounded = Math.max(1, Math.min(Math.trunc(limit) || DEFAULT_GIFT_CARD_EVENT_LIMIT, MAX_GIFT_CARD_EVENT_LIMIT));
  const db = await getDbAsync();
  return db
    .select()
    .from(giftCardEvents)
    .where(eq(giftCardEvents.giftCardId, giftCardId))
    .orderBy(desc(giftCardEvents.createdAt), desc(giftCardEvents.id))
    .limit(bounded);
}
