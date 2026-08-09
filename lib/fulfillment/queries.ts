import { sql, type SQL } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { orders } from "@/lib/db/schema/order";
import { SHIPMENT_NO_UNSETTLED_REFUNDS_SQL } from "@/lib/utils/refund-validation";

export const ADMIN_ORDER_VIEWS = ["awaiting", "shipped", "cancelled", "all"] as const;
export type AdminOrderView = (typeof ADMIN_ORDER_VIEWS)[number];

export const DEFAULT_ADMIN_ORDER_LIMIT = 20;
export const MAX_ADMIN_ORDER_LIMIT = 100;
/** D1 limits LIKE/GLOB patterns by their UTF-8 byte length, not JS characters. */
export const MAX_ADMIN_SEARCH_PATTERN_BYTES = 50;
export const MAX_ADMIN_SEARCH_TERM_BYTES = MAX_ADMIN_SEARCH_PATTERN_BYTES - 2;

export function isAdminOrderView(value: unknown): value is AdminOrderView {
  return typeof value === "string" && (ADMIN_ORDER_VIEWS as readonly string[]).includes(value);
}

function cleanSearchTerm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.normalize("NFKC").replace(/[%_\\]/g, "").trim().toLowerCase();
  return cleaned || null;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function truncateUtf8(value: string, maxBytes: number): string {
  let result = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = utf8Length(character);
    if (bytes + characterBytes > maxBytes) break;
    result += character;
    bytes += characterBytes;
  }
  return result;
}

/** Strip LIKE metacharacters and keep D1's wildcarded pattern at most 50 bytes. */
export function normalizeSearchTerm(raw: unknown): string | null {
  const cleaned = cleanSearchTerm(raw);
  if (!cleaned) return null;
  return truncateUtf8(cleaned, MAX_ADMIN_SEARCH_TERM_BYTES) || null;
}

/** Validate the same normalized byte budget enforced by normalizeSearchTerm(). */
export function isAdminSearchWithinLimit(raw: unknown): boolean {
  const cleaned = cleanSearchTerm(raw);
  return cleaned === null || utf8Length(cleaned) <= MAX_ADMIN_SEARCH_TERM_BYTES;
}

export function viewPredicate(view: AdminOrderView): SQL {
  switch (view) {
    case "awaiting":
      return sql`status = 'processing' AND payment_status = 'paid'
        AND ${sql.raw(SHIPMENT_NO_UNSETTLED_REFUNDS_SQL)}`;
    case "shipped":
      return sql`status IN ('shipped', 'delivered')`;
    case "cancelled":
      return sql`status IN ('cancelled', 'refunded')`;
    case "all":
      return sql`NOT (status = 'pending' AND COALESCE(payment_status, 'pending') <> 'paid')`;
  }
}

export function searchPredicate(term: string): SQL {
  const pattern = `%${term}%`;
  // Legacy order data can be malformed, scalar, or JSON encoded twice. Keep
  // json_extract behind nested json_valid/json_type CASE guards so one bad row
  // cannot abort the entire D1 queue search.
  const addressEmail = safeJsonText(orders.shipping_address, "$.email");
  const extensionEmail = safeJsonText(orders.extensions, "$.email");
  const addressRecipient = safeJsonText(orders.shipping_address, "$.recipient");
  const addressCompany = safeJsonText(orders.shipping_address, "$.company");
  return sql`(
    lower(id) LIKE ${pattern}
    OR lower(${addressEmail}) LIKE ${pattern}
    OR lower(${extensionEmail}) LIKE ${pattern}
    OR lower(${addressRecipient}) LIKE ${pattern}
    OR lower(${addressCompany}) LIKE ${pattern}
  )`;
}

function safeJsonText(
  column: typeof orders.shipping_address | typeof orders.extensions,
  path: string,
): SQL {
  const decoded = sql`json_extract(${column}, '$')`;
  return sql`CASE
    WHEN json_valid(${column}) THEN CASE
      WHEN json_type(${column}) = 'object'
        THEN COALESCE(CAST(json_extract(${column}, ${path}) AS TEXT), '')
      WHEN json_type(${column}) = 'text' THEN CASE
        WHEN json_valid(${decoded}) THEN CASE
          WHEN json_type(${decoded}) = 'object'
            THEN COALESCE(CAST(json_extract(${decoded}, ${path}) AS TEXT), '')
          ELSE ''
        END
        ELSE ''
      END
      ELSE ''
    END
    ELSE ''
  END`;
}

export function whereForView(view: AdminOrderView, term: string | null): SQL {
  const base = viewPredicate(view);
  return term ? sql`(${base}) AND (${searchPredicate(term)})` : base;
}

/** Oldest paid processing order first; completed views are newest first. */
export function orderByForView(view: AdminOrderView): SQL {
  return view === "awaiting"
    ? sql`created_at ASC, id ASC`
    : sql`created_at DESC, id DESC`;
}

export interface AdminOrderQuery {
  view: AdminOrderView;
  q?: string;
  limit: number;
  offset: number;
}

export type AdminOrderCounts = Record<AdminOrderView, number>;

/**
 * Scalar-only projection for the fulfillment queue.
 *
 * Do not select JSON-mode order columns directly here: Drizzle eagerly
 * JSON.parse()s them while mapping a row, which would let one malformed legacy
 * value abort the whole queue before application safeguards can run.
 */
export interface AdminQueueRow {
  id: string;
  status: typeof orders.$inferSelect.status;
  paymentStatus: typeof orders.$inferSelect.payment_status;
  totalAmountRaw: string;
  currencyCode: string;
  customerName: string;
  customerEmail: string | null;
  itemCount: number;
  createdAt: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  notes: string | null;
  checkoutCatalogSubtotalRaw: string | null;
  checkoutShippingBeforeDiscountRaw: string | null;
  checkoutTaxRaw: string | null;
  checkoutDiscountRaw: string | null;
}

export interface AdminOrderQueryResult {
  orders: AdminQueueRow[];
  total: number;
  counts: AdminOrderCounts;
}

function safeJsonValueText(
  column: typeof orders.shipping_address | typeof orders.extensions,
  path: string,
): SQL<string | null> {
  const decoded = sql`json_extract(${column}, '$')`;
  return sql<string | null>`CASE
    WHEN json_valid(${column}) THEN CASE
      WHEN json_type(${column}) = 'object'
        THEN CAST(json_extract(${column}, ${path}) AS TEXT)
      WHEN json_type(${column}) = 'text' AND json_valid(${decoded})
        AND json_type(${decoded}) = 'object'
        THEN CAST(json_extract(${decoded}, ${path}) AS TEXT)
      ELSE NULL
    END
    ELSE NULL
  END`;
}

function safeItemCount(): SQL<number> {
  const safeItems = sql`CASE
    WHEN json_valid(${orders.items}) AND json_type(${orders.items}) = 'array'
      THEN ${orders.items}
    ELSE '[]'
  END`;
  return sql<number>`COALESCE((
    SELECT SUM(CASE
      WHEN item.type = 'object' THEN CASE
        WHEN json_type(item.value, '$.quantity') = 'integer'
          AND json_extract(item.value, '$.quantity') > 0
          THEN json_extract(item.value, '$.quantity')
        ELSE 0
      END
      ELSE 0
    END)
    FROM json_each(${safeItems}) AS item
  ), 0)`;
}

/** SQL-filtered, SQL-counted admin fulfillment queue page. */
export async function queryAdminOrders(params: AdminOrderQuery): Promise<AdminOrderQueryResult> {
  const db = await getDbAsync();
  const term = normalizeSearchTerm(params.q);
  const limit = Math.max(1, Math.min(Math.trunc(params.limit), MAX_ADMIN_ORDER_LIMIT));
  const offset = Math.max(0, Math.trunc(params.offset));
  const where = whereForView(params.view, term);

  const customerName = sql<string>`COALESCE(
    NULLIF(${safeJsonText(orders.shipping_address, "$.recipient")}, ''),
    NULLIF(${safeJsonText(orders.shipping_address, "$.company")}, ''),
    'Guest'
  )`;
  const customerEmail = sql<string | null>`NULLIF(COALESCE(
    NULLIF(${safeJsonText(orders.extensions, "$.email")}, ''),
    NULLIF(${safeJsonText(orders.shipping_address, "$.email")}, '')
  ), '')`;
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentStatus: orders.payment_status,
      totalAmountRaw: sql<string>`CAST(${orders.total_amount} AS TEXT)`,
      currencyCode: orders.currency_code,
      customerName,
      customerEmail,
      itemCount: safeItemCount(),
      createdAt: orders.created_at,
      shippingCarrier: orders.shipping_carrier,
      trackingNumber: orders.tracking_number,
      shippedAt: orders.shipped_at,
      notes: orders.notes,
      checkoutCatalogSubtotalRaw: safeJsonValueText(
        orders.extensions,
        "$.checkout_catalog_subtotal",
      ),
      checkoutShippingBeforeDiscountRaw: safeJsonValueText(
        orders.extensions,
        "$.checkout_shipping_before_discount",
      ),
      checkoutTaxRaw: safeJsonValueText(orders.extensions, "$.checkout_tax"),
      checkoutDiscountRaw: safeJsonValueText(orders.extensions, "$.checkout_discount"),
    })
    .from(orders)
    .where(where)
    .orderBy(orderByForView(params.view))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(orders)
    .where(where);

  const countsQuery = db
    .select({
      awaiting: sql<number>`SUM(CASE WHEN ${viewPredicate("awaiting")} THEN 1 ELSE 0 END)`,
      shipped: sql<number>`SUM(CASE WHEN ${viewPredicate("shipped")} THEN 1 ELSE 0 END)`,
      cancelled: sql<number>`SUM(CASE WHEN ${viewPredicate("cancelled")} THEN 1 ELSE 0 END)`,
      all: sql<number>`SUM(CASE WHEN ${viewPredicate("all")} THEN 1 ELSE 0 END)`,
    })
    .from(orders);

  const [countsRow] = await (term ? countsQuery.where(searchPredicate(term)) : countsQuery);

  return {
    orders: rows,
    total: Number(totalRow?.value ?? 0),
    counts: {
      awaiting: Number(countsRow?.awaiting ?? 0),
      shipped: Number(countsRow?.shipped ?? 0),
      cancelled: Number(countsRow?.cancelled ?? 0),
      all: Number(countsRow?.all ?? 0),
    },
  };
}
