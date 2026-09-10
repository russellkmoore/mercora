import type { ActorType } from "@/lib/fulfillment/types";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { assertGiftCardEventDetails } from "./events";
import { classifyGiftCardReservation, createGiftCardRepository } from "./repository";

/**
 * D-04: "what happened to this card", assembled at read time from four
 * sources — never stored, never backfilled. `source` names which table an
 * entry came from; `type` is a stable label within that source.
 */
export type GiftCardTimelineSource = "ledger" | "reservation" | "delivery" | "event";

export interface GiftCardTimelineEntry {
  id: string;
  type: string;
  source: GiftCardTimelineSource;
  actorType: ActorType;
  actorId: string | null;
  actorLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: number;
}

export interface BuildGiftCardTimelineArgs {
  database: D1Database;
  giftCardId: string;
  /** Bounded page size (T-14-24); default and clamp mirror `events.ts`. */
  limit?: number;
  now: number;
}

const DEFAULT_TIMELINE_LIMIT = 200;
const MAX_TIMELINE_LIMIT = 1_000;

interface LedgerRow {
  id: string;
  entry_type: "issuance" | "redemption" | "restoration" | "adjustment";
  amount_delta_minor: number;
  order_id: string | null;
  created_at: number;
}

interface DeliveryRow {
  id: string;
  order_id: string | null;
  status: "pending" | "processing" | "sent" | "needs_review";
  created_at: number;
  completed_at: number | null;
}

interface EventRow {
  id: string;
  event_type: string;
  actor_type: ActorType;
  actor_id: string | null;
  details: string | null;
  created_at: number;
}

interface AdminUserLabelRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

type SystemActor = Pick<GiftCardTimelineEntry, "actorType" | "actorId" | "actorLabel">;

/**
 * A ledger/reservation/delivery entry produced by an order is attributed to
 * that order — `actorType: "system"`, an `actorLabel` naming it. Entries with
 * no order (an admin-created card, a still-open reservation) get no label.
 */
function orderActor(orderId: string | null): SystemActor {
  return orderId
    ? { actorType: "system", actorId: orderId, actorLabel: `order ${orderId}` }
    : { actorType: "system", actorId: null, actorLabel: null };
}

const NO_ACTOR: SystemActor = { actorType: "system", actorId: null, actorLabel: null };

/**
 * Field-by-field allow-list, never a spread of a database row (T-14-19): a
 * `gift_card_deliveries`/`gift_card_accounts` row spread here is exactly how
 * code material would escape into a response. Every constructed object also
 * runs through `assertGiftCardEventDetails` as a second, independent check.
 */
function buildDetails(fields: Record<string, unknown>): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) details[key] = value;
  }
  assertGiftCardEventDetails(details);
  return details;
}

async function ledgerEntries(database: D1Database, giftCardId: string): Promise<GiftCardTimelineEntry[]> {
  const { results } = await database.prepare(`SELECT id, entry_type, amount_delta_minor, order_id, created_at
    FROM gift_card_ledger_entries WHERE gift_card_id = ?`).bind(giftCardId).all<LedgerRow>();
  return (results ?? []).map((row) => ({
    id: row.id,
    // D-04: a restoration is a refund back to the card, not a raw ledger term.
    type: row.entry_type === "restoration" ? "refund" : row.entry_type,
    source: "ledger" as const,
    ...orderActor(row.order_id),
    details: buildDetails({ amountMinor: row.amount_delta_minor, orderId: row.order_id ?? undefined }),
    createdAt: row.created_at,
  }));
}

async function reservationEntries(
  database: D1Database,
  giftCardId: string,
  now: number,
): Promise<GiftCardTimelineEntry[]> {
  const reservations = await createGiftCardRepository(database).findReservations(giftCardId);
  const entries: GiftCardTimelineEntry[] = [];
  for (const reservation of reservations) {
    entries.push({
      id: `${reservation.id}:hold`,
      type: "hold",
      source: "reservation",
      ...NO_ACTOR,
      details: buildDetails({ amountMinor: reservation.amount.toMinorUnits() }),
      createdAt: reservation.reservedAt,
    });
    const classification = classifyGiftCardReservation(reservation, now);
    if (classification === "committed_unsettled") {
      entries.push({
        id: `${reservation.id}:awaiting_settlement`,
        type: "awaiting_settlement",
        source: "reservation",
        ...orderActor(reservation.committedOrderId ?? null),
        details: buildDetails({ amountMinor: reservation.amount.toMinorUnits() }),
        createdAt: reservation.committedAt ?? reservation.reservedAt,
      });
    } else if (classification === "released") {
      entries.push({
        id: `${reservation.id}:released`,
        type: "released",
        source: "reservation",
        ...NO_ACTOR,
        details: buildDetails({ reason: reservation.releaseReason }),
        createdAt: reservation.releasedAt ?? reservation.reservedAt,
      });
    }
    // "open", "expired", "settled": the hold entry above is the whole story —
    // settlement is represented by the ledger `redemption` entry, not duplicated here.
  }
  return entries;
}

async function deliveryEntries(database: D1Database, giftCardId: string): Promise<GiftCardTimelineEntry[]> {
  const row = await database.prepare(`SELECT id, order_id, status, created_at, completed_at
    FROM gift_card_deliveries WHERE gift_card_id = ? LIMIT 1`).bind(giftCardId).first<DeliveryRow>();
  if (!row) return [];
  const actor = orderActor(row.order_id);
  const entries: GiftCardTimelineEntry[] = [{
    id: `${row.id}:created`,
    type: "delivery_created",
    source: "delivery",
    ...actor,
    details: buildDetails({}),
    createdAt: row.created_at,
  }];
  if (row.completed_at !== null && (row.status === "sent" || row.status === "needs_review")) {
    entries.push({
      id: `${row.id}:completed`,
      // D-04: names its own terminal status rather than a generic "completed".
      type: `delivery_${row.status}`,
      source: "delivery",
      ...actor,
      details: buildDetails({ status: row.status }),
      createdAt: row.completed_at,
    });
  }
  return entries;
}

async function eventEntries(
  database: D1Database,
  giftCardId: string,
  limit: number,
): Promise<GiftCardTimelineEntry[]> {
  const { results } = await database.prepare(`SELECT id, event_type, actor_type, actor_id, details, created_at
    FROM gift_card_events WHERE gift_card_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`)
    .bind(giftCardId, limit).all<EventRow>();
  return (results ?? []).map((row) => {
    const details = row.details ? (JSON.parse(row.details) as Record<string, unknown>) : null;
    if (details) assertGiftCardEventDetails(details);
    return {
      id: row.id,
      type: row.event_type,
      source: "event" as const,
      actorType: row.actor_type,
      actorId: row.actor_id,
      actorLabel: null,
      details,
      createdAt: row.created_at,
    };
  });
}

/**
 * Batch-resolves `actorLabel` for every admin-attributed entry via
 * `admin_users`, exactly the join `app/api/admin/orders/[id]/events/route.ts`
 * uses. Wrapped in a try that records telemetry and degrades to null labels
 * on failure — a timeline that renders without names beats one that 500s.
 */
async function resolveAdminLabels(database: D1Database, entries: GiftCardTimelineEntry[]): Promise<void> {
  const adminIds = [...new Set(
    entries.filter((entry) => entry.actorType === "admin" && entry.actorId).map((entry) => entry.actorId as string),
  )];
  if (adminIds.length === 0) return;
  try {
    const placeholders = adminIds.map(() => "?").join(", ");
    const { results } = await database.prepare(
      `SELECT user_id, email, display_name FROM admin_users WHERE user_id IN (${placeholders})`,
    ).bind(...adminIds).all<AdminUserLabelRow>();
    const labels = new Map<string, string>();
    for (const row of results ?? []) {
      const label = row.display_name?.trim() || row.email?.trim() || "";
      if (label) labels.set(row.user_id, label);
    }
    for (const entry of entries) {
      if (entry.actorType === "admin" && entry.actorId) {
        entry.actorLabel = labels.get(entry.actorId) ?? null;
      }
    }
  } catch (error) {
    recordTelemetry("fulfillment.query_failed", {
      operation: "process", outcome: "partial_failure", provider: "d1", retryable: true, trigger: "request",
    }, error);
    for (const entry of entries) {
      if (entry.actorType === "admin" && entry.actorId) entry.actorLabel = null;
    }
  }
}

/**
 * "What happened to this card": merges the ledger, reservations, the
 * delivery row, and `gift_card_events`, oldest first, with admin actors
 * labelled from `admin_users`. Assembled fresh on every call (D-04) — no
 * historical row is ever backfilled into `gift_card_events`.
 */
export async function buildGiftCardTimeline(
  args: BuildGiftCardTimelineArgs,
): Promise<{ entries: GiftCardTimelineEntry[] }> {
  const bounded = Math.max(
    1,
    Math.min(Math.trunc(args.limit ?? DEFAULT_TIMELINE_LIMIT) || DEFAULT_TIMELINE_LIMIT, MAX_TIMELINE_LIMIT),
  );

  const [ledger, reservations, delivery, events] = await Promise.all([
    ledgerEntries(args.database, args.giftCardId),
    reservationEntries(args.database, args.giftCardId, args.now),
    deliveryEntries(args.database, args.giftCardId),
    eventEntries(args.database, args.giftCardId, bounded),
  ]);

  const merged = [...ledger, ...reservations, ...delivery, ...events]
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  const trimmed = merged.length > bounded ? merged.slice(merged.length - bounded) : merged;

  await resolveAdminLabels(args.database, trimmed);

  return { entries: trimmed };
}
