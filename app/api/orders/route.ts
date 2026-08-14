/**
 * MACH-Compliant Orders API - Unified Order Management
 * 
 * This endpoint consolidates all order functionality:
 * - GET: List owner-scoped or authorized admin orders
 * - POST: Verify payment and finalize a durable pending order
 * - PUT: Update non-lifecycle metadata with optimistic concurrency
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDbAsync } from "@/lib/db";
import { orders } from "@/lib/db/schema/order";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { authenticateRequest, PERMISSIONS } from "@/lib/auth/unified-auth";
import type { Order } from "@/lib/types/order";
import { Money } from "@/lib/money";
import {
  mergeOrderExtensions,
  mergeOrderExternalReferences,
  validateOrderMetadataUpdate,
} from '@/lib/utils/order-update-guards';
import {
  finalizeOrderPayment,
  PaymentVerificationError,
} from '@/lib/services/order-finalization';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { toAdminOrder, toCustomerOrder } from '@/lib/models/mach/order-serializer';



/**
 * GET /api/orders - List orders (consolidates user-orders functionality)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const url = new URL(request.url);
    
    const rawLimit = url.searchParams.get('limit');
    const rawOffset = url.searchParams.get('offset');
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    const offset = rawOffset === null ? 0 : Number(rawOffset);
    if (
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0
    ) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
    }
    const status = url.searchParams.get('status');
    const requestedUserId = url.searchParams.get('userId');
    const orderId = url.searchParams.get('orderId');
    const isAdminRequest = url.searchParams.has('admin');

    const db = await getDbAsync();
    
    if (isAdminRequest) {
      // Admin request - requires API key authentication
      const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_READ);
      if (!authResult.success) {
        return authResult.response!;
      }
    } else if (requestedUserId) {
      // User-specific orders - requires user to be authenticated and match
      if (!userId || requestedUserId !== userId) {
        return NextResponse.json(
          { error: "Unauthorized - can only access your own orders" },
          { status: 403 }
        );
      }
    } else {
      // Public access not allowed without specific auth
      return NextResponse.json(
        { error: "Authentication required. Use ?userId=<id> or admin=true with API key" },
        { status: 401 }
      );
    }

    const predicates = [];
    if (!isAdminRequest && requestedUserId) predicates.push(eq(orders.customer_id, requestedUserId));
    if (orderId) predicates.push(eq(orders.id, orderId));
    if (status) {
      const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
      if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
        return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
      }
      predicates.push(eq(orders.status, status as (typeof validStatuses)[number]));
    }

    const filteredOrders = await db
      .select()
      .from(orders)
      .where(predicates.length ? and(...predicates) : undefined)
      .orderBy(desc(orders.created_at));
    const total = filteredOrders.length;
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);
    const hydratedOrders = paginatedOrders.map(hydrateOrder);
    
    const response = {
      data: hydratedOrders.map(isAdminRequest ? toAdminOrder : toCustomerOrder),
      meta: {
        total,
        limit,
        offset,
        schema: "mach:order"
      },
      links: {
        self: `/api/orders?limit=${limit}&offset=${offset}`,
        first: `/api/orders?limit=${limit}&offset=0`,
        ...(offset + limit < total && {
          next: `/api/orders?limit=${limit}&offset=${offset + limit}`
        }),
        ...(offset > 0 && {
          prev: `/api/orders?limit=${limit}&offset=${Math.max(0, offset - limit)}`
        }),
        last: `/api/orders?limit=${limit}&offset=${Math.max(0, Math.floor((total - 1) / limit) * limit)}`
      }
    };
    return NextResponse.json(response);

  } catch (error) {
    recordTelemetry('order.query_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1',
      retryable: true, path: '/api/orders', trigger: 'request',
    }, error);
    return NextResponse.json(
      { error: 'Failed to retrieve orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders - Finalize the durable pending order created at checkout.
 * Client item names, prices, totals, ownership and paid state are ignored.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(
      'PUBLIC_RATE_LIMITER',
      `order-finalize:${getClientIp(request)}`
    );
    if (limited) return limited;

    const { userId } = await auth();
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const extensions = input.extensions && typeof input.extensions === 'object'
      ? input.extensions as Record<string, unknown>
      : {};
    const paymentIntentId = typeof input.paymentIntentId === 'string'
      ? input.paymentIntentId
      : typeof extensions.payment_intent_id === 'string'
        ? extensions.payment_intent_id
        : undefined;
    let orderId = typeof input.orderId === 'string'
      ? input.orderId
      : typeof input.order_id === 'string'
        ? input.order_id
        : undefined;
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 });
    }
    if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId) || paymentIntentId.length > 255) {
      return NextResponse.json({ error: 'Invalid paymentIntentId' }, { status: 400 });
    }
    if (
      orderId !== undefined &&
      (orderId.length > 200 || !/^WEB-[A-Z0-9]+-\d+(?:-[A-Z0-9]+)?$/.test(orderId))
    ) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    // Compatibility for inline clients that know the PI but did not yet retain
    // the new server-returned order id. This still proves the immutable binding.
    if (!orderId) {
      const db = await getDbAsync();
      const [bound] = await db.select({ id: orders.id }).from(orders).where(and(
        sql`json_extract(${orders.extensions}, '$.payment_intent_id') = ${paymentIntentId}`,
        sql`json_extract(${orders.external_references}, '$.payment_intent_id') = ${paymentIntentId}`
      )).limit(1);
      orderId = bound?.id;
    }
    if (!orderId) {
      return NextResponse.json({ error: 'Pending order not found' }, { status: 404 });
    }

    const result = await finalizeOrderPayment({
      orderId,
      paymentIntentId,
      customerId: userId ?? undefined,
      enforceOwnership: true,
      sendEmail: true,
    });
    return NextResponse.json({
      data: { id: result.order.id },
      meta: { schema: 'mach:order', idempotent: !result.promoted },
    });

  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      recordTelemetry('order.payment_verification_rejected', {
        operation: 'validate', outcome: 'rejected', path: '/api/orders',
      }, error);
      return NextResponse.json(
        { error: 'Payment could not be verified for this order' },
        { status: 409 }
      );
    }
    recordTelemetry('order.finalization_failed', {
      operation: 'finalize', outcome: 'failed', retryable: true, path: '/api/orders',
    }, error);
    return NextResponse.json({ error: 'Failed to finalize order' }, { status: 500 });
  }
}

/**
 * PUT /api/orders - Update non-authoritative order metadata.
 *
 * Lifecycle, fulfillment, customer linkage, totals and payment state each have
 * a dedicated server-owned path and are rejected here.
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate with admin permissions
    const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_UPDATE);
    if (!authResult.success) {
      return authResult.response!;
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const orderId = input.orderId;
    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['orderId is required in the request body']
      }, { status: 400 });
    }
    const validation = validateOrderMetadataUpdate(input);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const db = await getDbAsync();
    
    // Check if order exists
    const existingOrder = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (existingOrder.length === 0) {
      return NextResponse.json({
        error: 'Order not found'
      }, { status: 404 });
    }

    const currentOrder = existingOrder[0];
    const updateData: Partial<typeof orders.$inferInsert> = {};

    if ('notes' in validation.value) {
      const notes = validation.value.notes;
      if (notes !== null && typeof notes !== 'string') {
        return NextResponse.json({ error: 'notes must be a string or null' }, { status: 400 });
      }
      updateData.notes = notes;
    }
    if ('extensions' in validation.value) {
      const merged = mergeOrderExtensions(validation.value.extensions, currentOrder.extensions);
      if (!merged.ok) {
        return NextResponse.json({ error: merged.error }, { status: merged.status });
      }
      updateData.extensions = merged.value;
    }
    if ('external_references' in validation.value) {
      const merged = mergeOrderExternalReferences(
        validation.value.external_references,
        currentOrder.external_references
      );
      if (!merged.ok) {
        return NextResponse.json({ error: merged.error }, { status: merged.status });
      }
      updateData.external_references = merged.value;
    }
    const updatedAt = new Date().toISOString();
    updateData.updated_at = updatedAt;

    // Update the order
    const [updatedOrder] = await db.update(orders)
      .set(updateData)
      .where(and(
        eq(orders.id, orderId),
        currentOrder.updated_at === null
          ? isNull(orders.updated_at)
          : eq(orders.updated_at, currentOrder.updated_at)
      ))
      .returning();
    if (!updatedOrder) {
      return NextResponse.json(
        { error: 'Order changed while it was being updated; retry with fresh data' },
        { status: 409 }
      );
    }

    const response = {
      data: toAdminOrder(hydrateOrder(updatedOrder)),
      meta: {
        schema: "mach:order"
      }
    };
    return NextResponse.json(response);

  } catch (error) {
    recordTelemetry('order.metadata_update_failed', {
      operation: 'persist', outcome: 'failed', provider: 'd1',
      retryable: true, path: '/api/orders', trigger: 'request',
    }, error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

/**
 * Hydrate order data from MACH database format to Order type
 */
function hydrateOrder(dbOrder: typeof orders.$inferSelect): Order {
  return {
    id: dbOrder.id ?? undefined,
    customer_id: dbOrder.customer_id || undefined,
    status: dbOrder.status,
    total_amount: Money.fromStored(dbOrder.total_amount, dbOrder.currency_code).toJSON(),
    currency_code: dbOrder.currency_code,
    shipping_address: dbOrder.shipping_address ? (typeof dbOrder.shipping_address === 'string' ? JSON.parse(dbOrder.shipping_address) : dbOrder.shipping_address) : undefined,
    billing_address: dbOrder.billing_address ? (typeof dbOrder.billing_address === 'string' ? JSON.parse(dbOrder.billing_address) : dbOrder.billing_address) : undefined,
    items: dbOrder.items ? (typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : dbOrder.items) : [],
    shipping_method: dbOrder.shipping_method ?? undefined,
    shipping_carrier: dbOrder.shipping_carrier ?? undefined,
    payment_method: dbOrder.payment_method ?? undefined,
    payment_status: dbOrder.payment_status ?? 'pending',
    tracking_number: dbOrder.tracking_number ?? undefined,
    shipped_at: dbOrder.shipped_at ?? undefined,
    delivered_at: dbOrder.delivered_at ?? undefined,
    notes: dbOrder.notes ?? undefined,
    external_references: dbOrder.external_references ? (typeof dbOrder.external_references === 'string' ? JSON.parse(dbOrder.external_references) : dbOrder.external_references) : undefined,
    extensions: dbOrder.extensions ? (typeof dbOrder.extensions === 'string' ? JSON.parse(dbOrder.extensions) : dbOrder.extensions) : undefined,
    created_at: dbOrder.created_at ?? undefined,
    updated_at: dbOrder.updated_at ?? undefined
  };
}
