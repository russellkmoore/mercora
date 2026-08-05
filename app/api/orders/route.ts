/**
 * MACH-Compliant Orders API - Unified Order Management
 * 
 * This endpoint consolidates all order functionality:
 * - GET: List orders (replaces user-orders) 
 * - POST: Create orders (replaces submit-order)
 * - PUT: Update orders (replaces update-order)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDbAsync } from "@/lib/db";
import { orders } from "@/lib/db/schema/order";
import { eq, desc, and, isNull } from "drizzle-orm";
import { authenticateRequest, PERMISSIONS } from "@/lib/auth/unified-auth";
import { sendOrderConfirmationEmail, type OrderData } from "@/lib/utils/email";
import type { Order, CreateOrderRequest } from "@/lib/types/order";
import { getCustomer, createCustomer } from "@/lib/models/mach/customer";
import { Money, toWireMoney, type MachMoney } from "@/lib/money";
import {
  mergeOrderExtensions,
  mergeOrderExternalReferences,
  validateOrderMetadataUpdate,
} from '@/lib/utils/order-update-guards';



/**
 * GET /api/orders - List orders (consolidates user-orders functionality)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const url = new URL(request.url);
    
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
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
      data: hydratedOrders.map(toWireOrder),
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
        last: `/api/orders?limit=${limit}&offset=${Math.floor(total / limit) * limit}`
      }
    };
    return NextResponse.json(response);

  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders - Create order (consolidates submit-order functionality)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await request.json() as CreateOrderRequest;
    
    // Validate required fields

    // Validate MACH-compliant order fields
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['items array is required and must not be empty']
      }, { status: 400 });
    }
    if (!body.total_amount || !Number.isSafeInteger(body.total_amount.amount)) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['total_amount is required and must be a Money object']
      }, { status: 400 });
    }
    if (!body.currency_code) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['currency_code is required']
      }, { status: 400 });
    }

    // Generate order ID
    const now = Date.now();
    let baseId = userId ?? "guest";
    if (baseId.includes("@")) baseId = baseId.split("@")[0];
    const safeUserId = baseId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const orderId = `WEB-${safeUserId}-${now}`;

    const db = await getDbAsync();
    
    // Handle customer_id - ensure there's a valid customer record or null for guest orders
    let customerId = userId || body.customer_id || null;
    if (customerId === "guest") {
      customerId = null;
    }
    
    // If we have a customer ID, make sure the customer exists in the database
    if (customerId) {
      try {
        let customer = await getCustomer(customerId);
        if (!customer) {
          // Create a customer record if it doesn't exist
          const user = await currentUser();
          customer = await createCustomer({
            id: customerId,
            type: "person",
            person: {
              email: user?.emailAddresses?.[0]?.emailAddress || body.extensions?.email || '',
              first_name: user?.firstName || '',
              last_name: user?.lastName || '',
              full_name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
            }
          });
        }
      } catch (error) {
        console.error('Error handling customer record:', error);
        // If customer creation fails, proceed as guest order
        customerId = null;
      }
    }

    const machOrder: any = {
      id: orderId,
      customer_id: customerId,
      status: 'pending',
      total_amount: Money.fromStored(body.total_amount, body.currency_code).toJSON(),
      currency_code: body.currency_code,
      shipping_address: body.shipping_address ? JSON.stringify(body.shipping_address) : null,
      billing_address: body.billing_address ? JSON.stringify(body.billing_address) : null,
      items: JSON.stringify(body.items),
      shipping_method: body.shipping_method || null,
      payment_method: body.payment_method || null,
      payment_status: 'pending',
      notes: body.notes || null,
      external_references: body.external_references ? JSON.stringify(body.external_references) : null,
      extensions: body.extensions ? JSON.stringify(body.extensions) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create the order
    const [newOrder] = await db.insert(orders).values(machOrder).returning();


    // Send order confirmation email (MACH-compliant)
    try {
      const user = await currentUser();
      const shippingAddr = body.shipping_address;
      let customerName = 'Valued Customer';
      if (user?.firstName && user?.lastName) {
        customerName = `${user.firstName} ${user.lastName}`;
      } else if (shippingAddr?.recipient) {
        customerName = shippingAddr.recipient;
      } else if (shippingAddr?.company) {
        customerName = shippingAddr.company;
      }
      const customerEmail = body.extensions?.email || shippingAddr?.email || '';
      const orderData: OrderData = {
        orderNumber: orderId,
        customerName,
        customerEmail,
        items: body.items.map(item => ({
          productId: item.product_id,
          name: item.product_name,
          price: Money.fromStored(item.unit_price, body.currency_code).toJSON(),
          quantity: item.quantity,
          imageUrl: (item as any).imageUrl || '',
        })),
        subtotal: Money.fromStored(body.extensions?.subtotal ?? 0, body.currency_code).toJSON(),
        shipping: Money.fromStored(body.extensions?.shipping_cost ?? 0, body.currency_code).toJSON(),
        tax: Money.fromStored(body.extensions?.tax_amount ?? 0, body.currency_code).toJSON(),
        total: Money.fromStored(body.total_amount, body.currency_code).toJSON(),
        shippingAddress: shippingAddr ? {
          street: [shippingAddr.line1, shippingAddr.line2].filter(Boolean).join(', '),
          city: typeof shippingAddr.city === 'string' ? shippingAddr.city : (shippingAddr.city ? Object.values(shippingAddr.city)[0] : ''),
          state: shippingAddr.region || '',
          zipCode: shippingAddr.postal_code || '',
          country: shippingAddr.country || 'US',
        } : {
          street: '', city: '', state: '', zipCode: '', country: ''
        },
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      };
      const emailResult = await sendOrderConfirmationEmail(orderData);
      if (emailResult.success) {
        console.log('Order confirmation email sent successfully:', emailResult.id);
      } else {
        console.error('Failed to send confirmation email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Email preparation failed:', emailError);
    }
    

    const response = {
      data: toWireOrder(hydrateOrder(newOrder)),
      meta: {
        schema: "mach:order"
      }
    };
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Orders API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({
        error: 'Validation failed',
        message: error.message
      }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
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
      data: toWireOrder(hydrateOrder(updatedOrder)),
      meta: {
        schema: "mach:order"
      }
    };
    return NextResponse.json(response);

  } catch (error) {
    console.error('Orders API error:', error);
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

type WireOrderItem = Omit<Order['items'][number], 'unit_price' | 'total_price'> & {
  unit_price: MachMoney;
  total_price: MachMoney;
};
type WireOrder = Omit<Order, 'total_amount' | 'items'> & { total_amount: MachMoney; items: WireOrderItem[] };

/** Apply decimal MACH serialization last, after all internal minor-unit work. */
function toWireOrder(order: Order): WireOrder {
  return {
    ...order,
    total_amount: toWireMoney(order.total_amount),
    items: order.items.map((item) => ({
      ...item,
      unit_price: toWireMoney(item.unit_price),
      total_price: toWireMoney(item.total_price),
    })),
  };
}
