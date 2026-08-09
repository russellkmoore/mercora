import { and, asc, desc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { orderEvents, type OrderEventRow } from "@/lib/db/schema/order-events";
import { orders } from "@/lib/db/schema/order";
import { hydrateOrder } from "@/lib/models/mach/orders";
import type { Order } from "@/lib/types/order";
import {
  SHIPMENT_NO_UNSETTLED_REFUNDS_SQL,
  hasPendingRefund,
  type OrderExtensions,
} from "@/lib/utils/refund-validation";
import { buildTrackingUrl } from "./tracking";
import {
  canEditTracking,
  decideShipment,
  type OrderFulfillmentSnapshot,
} from "./transitions";
import {
  DEFAULT_CARRIER_REGISTRY,
  type Actor,
  type CarrierRegistry,
  type OrderEventType,
  type ShipmentInput,
} from "./types";

export type { OrderEventRow };

export type ShipOrderResult =
  | { outcome: "shipped"; order: Order; eventId: string }
  | { outcome: "already_shipped"; order: Order }
  | { outcome: "not_found" }
  | { outcome: "conflict"; order: Order }
  | {
      outcome: "not_fulfillable";
      status: string;
      paymentStatus: string | null;
      refundPending?: true;
    };

function parseExtensions(value: unknown): OrderExtensions | null {
  if (value == null) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as OrderExtensions)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? (value as OrderExtensions)
    : null;
}

function toSnapshot(row: typeof orders.$inferSelect): OrderFulfillmentSnapshot {
  return {
    status: row.status,
    payment_status: row.payment_status ?? null,
    shipping_carrier: row.shipping_carrier ?? null,
    tracking_number: row.tracking_number ?? null,
    refund_pending: hasPendingRefund(parseExtensions(row.extensions)),
  };
}

/**
 * Atomically move one paid processing order to shipped and append its audit event.
 * The refund predicate is repeated inside the UPDATE so a reservation cannot race
 * the pre-read. D1 serializes each batch; the marker + NOT EXISTS pair prevents a
 * losing same-millisecond request from appending a phantom event.
 */
export async function shipOrder(
  orderId: string,
  input: ShipmentInput,
  actor: Actor,
  registry: CarrierRegistry = DEFAULT_CARRIER_REGISTRY,
): Promise<ShipOrderResult> {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const details = JSON.stringify({
    carrier: input.carrier,
    trackingNumber: input.trackingNumber,
    trackingUrl: buildTrackingUrl(input.carrier, input.trackingNumber, registry),
  });

  const guardedUpdate = db
    .update(orders)
    .set({
      status: "shipped",
      shipping_carrier: input.carrier,
      tracking_number: input.trackingNumber,
      shipped_at: now,
      updated_at: now,
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "processing"),
        eq(orders.payment_status, "paid"),
        sql.raw(SHIPMENT_NO_UNSETTLED_REFUNDS_SQL),
      ),
    )
    .returning();

  const eventAtThisMarker = db
    .select({ one: sql`1` })
    .from(orderEvents)
    .where(
      and(
        eq(orderEvents.order_id, orderId),
        eq(orderEvents.event_type, "shipment_created"),
        eq(orderEvents.created_at, now),
      ),
    );

  const conditionalEventInsert = db.insert(orderEvents).select(
    db
      .select({
        id: sql<string>`${eventId}`.as("id"),
        order_id: sql<string>`${orderId}`.as("order_id"),
        event_type: sql<string>`${"shipment_created"}`.as("event_type"),
        actor_type: sql<string>`${actor.type}`.as("actor_type"),
        actor_id: sql<string | null>`${actor.id}`.as("actor_id"),
        from_status: sql<string | null>`${"processing"}`.as("from_status"),
        to_status: sql<string | null>`${"shipped"}`.as("to_status"),
        details: sql<string | null>`${details}`.as("details"),
        created_at: sql<string>`${now}`.as("created_at"),
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "shipped"),
          eq(orders.shipped_at, now),
          notExists(eventAtThisMarker),
        ),
      ),
  );

  const [updatedRows] = await db.batch([guardedUpdate, conditionalEventInsert]);
  if (updatedRows.length > 0) {
    return { outcome: "shipped", order: hydrateOrder(updatedRows[0]), eventId };
  }

  const [current] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!current) return { outcome: "not_found" };

  const decision = decideShipment(toSnapshot(current), input, registry);
  switch (decision.kind) {
    case "idempotent":
      return { outcome: "already_shipped", order: hydrateOrder(current) };
    case "conflict":
      return { outcome: "conflict", order: hydrateOrder(current) };
    case "not_fulfillable":
      return {
        outcome: "not_fulfillable",
        status: decision.status,
        paymentStatus: decision.paymentStatus,
        ...(decision.refundPending ? { refundPending: true as const } : {}),
      };
    case "ship":
      // The row cycled back to a fulfillable state after this request lost its CAS.
      // Surface a retryable conflict without claiming this request shipped it.
      return {
        outcome: "not_fulfillable",
        status: current.status,
        paymentStatus: current.payment_status ?? null,
      };
  }
}

export type UpdateTrackingResult =
  | { outcome: "updated"; order: Order; eventId: string }
  | { outcome: "unchanged"; order: Order }
  | { outcome: "not_found" }
  | { outcome: "conflict"; order: Order }
  | { outcome: "not_shipped"; status: string };

function matchesObserved(
  column: typeof orders.shipping_carrier | typeof orders.tracking_number,
  value: string | null,
) {
  return value === null ? isNull(column) : eq(column, value);
}

/** Correct a shipped order's full carrier/tracking pair with a value-CAS. */
export async function updateTracking(
  orderId: string,
  input: ShipmentInput,
  actor: Actor,
): Promise<UpdateTrackingResult> {
  const db = await getDbAsync();
  const [current] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!current) return { outcome: "not_found" };
  if (!canEditTracking(toSnapshot(current))) {
    return { outcome: "not_shipped", status: current.status };
  }

  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const previousCarrier = current.shipping_carrier ?? null;
  const previousTracking = current.tracking_number ?? null;
  if (previousCarrier === input.carrier && previousTracking === input.trackingNumber) {
    return { outcome: "unchanged", order: hydrateOrder(current) };
  }
  const details = JSON.stringify({
    previous: { carrier: previousCarrier, trackingNumber: previousTracking },
    next: { carrier: input.carrier, trackingNumber: input.trackingNumber },
  });

  const guardedUpdate = db
    .update(orders)
    .set({
      shipping_carrier: input.carrier,
      tracking_number: input.trackingNumber,
      updated_at: now,
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "shipped"),
        matchesObserved(orders.shipping_carrier, previousCarrier),
        matchesObserved(orders.tracking_number, previousTracking),
      ),
    )
    .returning();

  const eventAtThisMarker = db
    .select({ one: sql`1` })
    .from(orderEvents)
    .where(
      and(
        eq(orderEvents.order_id, orderId),
        eq(orderEvents.event_type, "tracking_updated"),
        eq(orderEvents.created_at, now),
      ),
    );

  const conditionalEventInsert = db.insert(orderEvents).select(
    db
      .select({
        id: sql<string>`${eventId}`.as("id"),
        order_id: sql<string>`${orderId}`.as("order_id"),
        event_type: sql<string>`${"tracking_updated"}`.as("event_type"),
        actor_type: sql<string>`${actor.type}`.as("actor_type"),
        actor_id: sql<string | null>`${actor.id}`.as("actor_id"),
        from_status: sql<string | null>`${null}`.as("from_status"),
        to_status: sql<string | null>`${null}`.as("to_status"),
        details: sql<string | null>`${details}`.as("details"),
        created_at: sql<string>`${now}`.as("created_at"),
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "shipped"),
          eq(orders.updated_at, now),
          notExists(eventAtThisMarker),
        ),
      ),
  );

  const [updatedRows] = await db.batch([guardedUpdate, conditionalEventInsert]);
  if (updatedRows.length > 0) {
    return { outcome: "updated", order: hydrateOrder(updatedRows[0]), eventId };
  }

  const [reread] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!reread) return { outcome: "not_found" };
  return canEditTracking(toSnapshot(reread))
    ? { outcome: "conflict", order: hydrateOrder(reread) }
    : { outcome: "not_shipped", status: reread.status };
}

export async function listOrderEvents(orderId: string): Promise<OrderEventRow[]> {
  const db = await getDbAsync();
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.order_id, orderId))
    .orderBy(asc(orderEvents.created_at), asc(orderEvents.id));
}

export async function latestOrderEvent(
  orderId: string,
  eventTypes: readonly OrderEventType[],
): Promise<OrderEventRow | null> {
  if (eventTypes.length === 0) return null;
  const db = await getDbAsync();
  const [row] = await db
    .select()
    .from(orderEvents)
    .where(and(eq(orderEvents.order_id, orderId), inArray(orderEvents.event_type, [...eventTypes])))
    .orderBy(desc(orderEvents.created_at), desc(orderEvents.id))
    .limit(1);
  return row ?? null;
}

/** Newest-first bounded page; callers may reverse for oldest-first display. */
export async function listRecentOrderEvents(
  orderId: string,
  limit: number,
): Promise<OrderEventRow[]> {
  const bounded = Math.max(1, Math.min(Math.trunc(limit), 500));
  const db = await getDbAsync();
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.order_id, orderId))
    .orderBy(desc(orderEvents.created_at), desc(orderEvents.id))
    .limit(bounded);
}

export interface TrackingEventSummary {
  id: string;
  eventType: "shipment_created" | "tracking_updated";
  createdAt: string;
}

/**
 * Customer-safe, scalar-only tracking history. Selecting no JSON-mode columns
 * keeps opaque or historically inconsistent audit details out of order tracking.
 */
export async function listRecentTrackingEventSummaries(
  orderId: string,
  limit = 100,
): Promise<TrackingEventSummary[]> {
  const bounded = Math.max(1, Math.min(Math.trunc(limit), 100));
  const db = await getDbAsync();
  const rows = await db
    .select({
      id: orderEvents.id,
      eventType: orderEvents.event_type,
      createdAt: orderEvents.created_at,
    })
    .from(orderEvents)
    .where(and(
      eq(orderEvents.order_id, orderId),
      inArray(orderEvents.event_type, ["shipment_created", "tracking_updated"]),
    ))
    .orderBy(desc(orderEvents.created_at), desc(orderEvents.id))
    .limit(bounded);

  return rows.flatMap((row) =>
    row.eventType === "shipment_created" || row.eventType === "tracking_updated"
      ? [{ id: row.id, eventType: row.eventType, createdAt: row.createdAt }]
      : []
  );
}

export async function recordEmailEvent(
  orderId: string,
  type: "shipping_email_sent" | "shipping_email_failed" | "shipping_email_resent",
  actor: Actor,
  details: Record<string, unknown>,
): Promise<string> {
  const db = await getDbAsync();
  const id = crypto.randomUUID();
  await db.insert(orderEvents).values({
    id,
    order_id: orderId,
    event_type: type,
    actor_type: actor.type,
    actor_id: actor.id,
    from_status: null,
    to_status: null,
    details,
    created_at: new Date().toISOString(),
  });
  return id;
}
