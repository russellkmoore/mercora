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
import { 
  getOrdersByCustomer, 
  getOrderById, 
  createOrder, 
  updateOrderStatus,
  updateOrderShipping 
} from "@/lib/models/mach/orders";
import { 
  getOrdersByCustomerId, 
  insertOrder
} from "@/lib/models/order";
import { eq, desc, and } from "drizzle-orm";
import { authenticateRequest, PERMISSIONS } from "@/lib/auth/unified-auth";
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail, type OrderData } from "@/lib/utils/email";
import type { Order, CreateOrderRequest, UpdateOrderRequest } from "@/lib/types/order";



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

  let query = db.select().from(orders).orderBy(desc(orders.created_at));
    const allOrders = await query;
    let filteredOrders = allOrders;
    
    // Apply filters based on MACH schema
    if (!isAdminRequest && requestedUserId) {
      filteredOrders = filteredOrders.filter(order => order.customer_id === requestedUserId);
    }
    if (status) {
      filteredOrders = filteredOrders.filter(order => order.status === status);
    }
    
    const total = filteredOrders.length;
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);
    const hydratedOrders = paginatedOrders.map(hydrateOrder);
    
    const response = {
      data: hydratedOrders,
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
    if (!body.total_amount || typeof body.total_amount.amount !== 'number') {
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
    const machOrder: any = {
      id: orderId,
      customer_id: userId || body.customer_id || "guest",
      status: 'pending',
      total_amount: JSON.stringify(body.total_amount),
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
          price: typeof item.unit_price === 'object' ? item.unit_price.amount : item.unit_price,
          quantity: item.quantity,
          imageUrl: (item as any).imageUrl || '',
        })),
        subtotal: body.extensions?.subtotal || 0,
        shipping: body.extensions?.shippingCost || 0,
        tax: body.extensions?.taxAmount || 0,
        total: typeof body.total_amount === 'object' ? body.total_amount.amount : body.total_amount,
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
      data: hydrateOrder(newOrder),
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
 * PUT /api/orders - Update order status (consolidates update-order functionality)
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate with admin permissions
    const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_UPDATE);
    if (!authResult.success) {
      return authResult.response!;
    }

    const body = await request.json() as UpdateOrderRequest;

    const { status, payment_status, shipping_method, tracking_number, shipped_at, delivered_at, notes, external_references, extensions } = body;
    const orderId = (body as any).orderId;
    if (!orderId) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['orderId is required in the request body']
      }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({
        error: 'Validation failed', 
        details: ['status is required']
      }, { status: 400 });
    }

    // Validate status value (must match schema)
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 });
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
    

    // Build update data (MACH-compliant)
    const updateData: any = {
      ...(status && { status }),
      ...(payment_status && { payment_status }),
      ...(shipping_method && { shipping_method }),
      ...(tracking_number && { tracking_number }),
      ...(shipped_at && { shipped_at }),
      ...(delivered_at && { delivered_at }),
      ...(notes && { notes }),
      ...(external_references && { external_references: JSON.stringify(external_references) }),
      ...(extensions && { extensions: JSON.stringify(extensions) }),
      updated_at: new Date().toISOString()
    };

    // Update the order
    const [updatedOrder] = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();

    // Send email notification for status changes
    const emailStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    if (emailStatuses.includes(status) && currentOrder.status !== status) {
      try {
        const orderData = transformOrderForEmail(updatedOrder);
        await sendOrderStatusUpdateEmail(orderData);
        console.log(`Status update email sent for order ${orderId}: ${status}`);
      } catch (emailError) {
        console.error(`Failed to send status update email for order ${orderId}:`, emailError);
      }
    }

    // TODO: Re-implement webhook audit trail in MACH orders model
    // Create webhook record for audit trail
    console.log('Order status update:', {
      orderId,
      previousStatus: currentOrder.status,
      newStatus: status,
      updatedBy: authResult.tokenInfo?.tokenName || 'unknown',
      timestamp: new Date().toISOString(),
    });

    const response = {
      data: hydrateOrder(updatedOrder),
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
    customer_id: dbOrder.customer_id ?? undefined,
    status: dbOrder.status,
    total_amount: typeof dbOrder.total_amount === 'string' ? JSON.parse(dbOrder.total_amount) : { amount: 0, currency: dbOrder.currency_code },
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

/**
 * Transform order data for email notification
 */
function transformOrderForEmail(order: any): any {
  // Use MACH-compliant fields
  const items = order.items ? (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) : [];
  const shippingAddr = order.shipping_address ? (typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address) : {};
  const extensions = order.extensions ? (typeof order.extensions === 'string' ? JSON.parse(order.extensions) : order.extensions) : {};

  // MACHAddress: line1, line2, city, region, postal_code, country, recipient, company
  let customerName = '';
  if (shippingAddr.recipient) {
    customerName = shippingAddr.recipient;
  } else if (shippingAddr.company) {
    customerName = shippingAddr.company;
  } else {
    customerName = 'Valued Customer';
  }

  return {
    orderNumber: order.id,
    customerName,
    customerEmail: extensions.email || shippingAddr.email || '',
    status: order.status,
    carrier: extensions.carrier,
    trackingNumber: order.tracking_number,
    trackingUrl: extensions.trackingUrl,
    notes: order.notes,
    cancellationReason: extensions.cancellationReason,
    items: items.map((item: any) => ({
      productId: item.product_id || item.id,
      name: item.product_name || item.name || item.title,
      price: item.unit_price?.amount || item.unit_price || item.price || 0,
      quantity: item.quantity || 1,
      imageUrl: item.imageUrl || '',
    })),
    shippingAddress: {
      street: [shippingAddr.line1, shippingAddr.line2].filter(Boolean).join(', '),
      city: shippingAddr.city || '',
      state: shippingAddr.region || '',
      zipCode: shippingAddr.postal_code || '',
      country: shippingAddr.country || 'US',
    },
  };
}
