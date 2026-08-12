import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { buildShipmentView } from "@/lib/fulfillment/shipment-view";
import {
  DEFAULT_ADMIN_ORDER_LIMIT,
  MAX_ADMIN_ORDER_LIMIT,
  MAX_ADMIN_SEARCH_TERM_BYTES,
  isAdminSearchWithinLimit,
  isAdminOrderView,
  normalizeSearchTerm,
  queryAdminOrders,
} from "@/lib/fulfillment/queries";
import { carrierRegistryFromConfig } from "@/lib/fulfillment/carrier-config";
import { Money, type MachMoney } from "@/lib/money";
import { getStoreConfig } from "@/lib/store-config";
import type { AdminQueueRow } from "@/lib/fulfillment/queries";
import { recordTelemetry } from "@/lib/observability/telemetry";

const MAX_ADMIN_ORDER_OFFSET = 1_000_000;

function parseBoundedInteger(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function normalizedQueueMoney(value: unknown, currencyCode: string): MachMoney | null {
  const currency = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  try {
    const money = Money.fromStored(value, currency);
    return money.currency === currency ? money.toMach() : null;
  } catch {
    return null;
  }
}

function normalizedCheckoutMoney(
  value: string | null,
  currencyCode: string,
): MachMoney | null | undefined {
  return value === null ? undefined : normalizedQueueMoney(value, currencyCode);
}

function queueOrder(
  order: AdminQueueRow,
  registry: ReturnType<typeof carrierRegistryFromConfig>,
) {
  const totalAmount = normalizedQueueMoney(order.totalAmountRaw, order.currencyCode);
  const checkoutCatalogSubtotal = normalizedCheckoutMoney(
    order.checkoutCatalogSubtotalRaw,
    order.currencyCode,
  );
  const checkoutShippingBeforeDiscount = normalizedCheckoutMoney(
    order.checkoutShippingBeforeDiscountRaw,
    order.currencyCode,
  );
  const checkoutTax = normalizedCheckoutMoney(order.checkoutTaxRaw, order.currencyCode);
  const checkoutDiscount = normalizedCheckoutMoney(
    order.checkoutDiscountRaw,
    order.currencyCode,
  );
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount,
    currencyCode: order.currencyCode,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
    },
    itemCount: order.itemCount,
    createdAt: order.createdAt,
    shipment: buildShipmentView({
      shipping_carrier: order.shippingCarrier,
      tracking_number: order.trackingNumber,
    }, registry),
    shippedAt: order.shippedAt,
    notes: order.notes,
    pricing: {
      ...(checkoutCatalogSubtotal !== undefined
        ? { checkout_catalog_subtotal: checkoutCatalogSubtotal }
        : {}),
      ...(checkoutShippingBeforeDiscount !== undefined
        ? { checkout_shipping_before_discount: checkoutShippingBeforeDiscount }
        : {}),
      ...(checkoutTax !== undefined
        ? { checkout_tax: checkoutTax }
        : {}),
      ...(checkoutDiscount !== undefined
        ? { checkout_discount: checkoutDiscount }
        : {}),
    },
  };
}

/** SQL-filtered and counted projection used only by the admin fulfillment queue. */
export async function GET(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return NextResponse.json(
      { code: "unauthorized", error: auth.error ?? "Admin access required" },
      { status: 401 },
    );
  }

  const search = request.nextUrl.searchParams;
  const rawView = search.get("view");
  if (search.getAll("view").length > 1 || (rawView !== null && !isAdminOrderView(rawView))) {
    return NextResponse.json(
      { code: "invalid_view", error: "Unknown fulfillment queue view" },
      { status: 400 },
    );
  }

  const rawQuery = search.get("q");
  if (search.getAll("q").length > 1 || !isAdminSearchWithinLimit(rawQuery)) {
    return NextResponse.json(
      {
        code: "invalid_search",
        error: `Search must be at most ${MAX_ADMIN_SEARCH_TERM_BYTES} UTF-8 bytes`,
      },
      { status: 400 },
    );
  }
  const query = normalizeSearchTerm(rawQuery);

  const limit = parseBoundedInteger(
    search.get("limit"),
    DEFAULT_ADMIN_ORDER_LIMIT,
    1,
    MAX_ADMIN_ORDER_LIMIT,
  );
  const offset = parseBoundedInteger(search.get("offset"), 0, 0, MAX_ADMIN_ORDER_OFFSET);
  if (
    search.getAll("limit").length > 1 ||
    search.getAll("offset").length > 1 ||
    limit === null ||
    offset === null
  ) {
    return NextResponse.json(
      { code: "invalid_pagination", error: "Invalid pagination parameters" },
      { status: 400 },
    );
  }

  const view = rawView ?? "awaiting";
  try {
    const config = getStoreConfig();
    const registry = carrierRegistryFromConfig(config);
    const result = await queryAdminOrders({
      view,
      q: query ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      orders: result.orders.map((order) => queueOrder(order, registry)),
      total: result.total,
      counts: result.counts,
      carriers: config.commerce.carriers.map(({ code, label, trackingUrlTemplate }) => ({
        code,
        label,
        ...(trackingUrlTemplate ? { trackingUrlTemplate } : {}),
      })),
      meta: { view, limit, offset },
    });
  } catch (error) {
    recordTelemetry("fulfillment.query_failed", {
      operation: "process", outcome: "failed", provider: "d1", retryable: true,
      path: "/api/admin/orders", trigger: "request",
    }, error);
    return NextResponse.json(
      { code: "orders_read_failed", error: "Failed to load orders" },
      { status: 500 },
    );
  }
}
