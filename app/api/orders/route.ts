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
  getOrdersByCustomerId, 
  getOrderById, 
  insertOrder, 
  updateOrderStatus,
  updateOrderShipping 
} from "@/lib/models/order";
import { eq, desc, and } from "drizzle-orm";
import { authenticateRequest, PERMISSIONS } from "@/lib/auth/unified-auth";
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail, type OrderData } from "@/lib/utils/email";
import type { 
  Address, 
  Order, 
  CartItem, 
  ShippingOption, 
  BillingInfo, 
  MACHApiResponse
} from "@/lib/types";

interface CreateOrderRequest {
  items: CartItem[];
  shippingAddress: Address;
  billingAddress?: Address;
  shippingOption: ShippingOption;
  billingInfo: BillingInfo;
  taxAmount: number;
  customerEmail?: string;
}

interface UpdateOrderRequest {
  orderId: string;
  status: "cart" | "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  cancellationReason?: string;
}

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

    let query = db.select().from(orders).orderBy(desc(orders.createdAt));
    const allOrders = await query;
    let filteredOrders = allOrders;
    
    // Apply filters based on MACH schema
    if (!isAdminRequest && requestedUserId) {
      filteredOrders = filteredOrders.filter(order => order.customerId === requestedUserId);
    }
    if (status) {
      filteredOrders = filteredOrders.filter(order => order.status === status);
    }
    
    const total = filteredOrders.length;
    const paginatedOrders = filteredOrders.slice(offset, offset + limit);
    const hydratedOrders = paginatedOrders.map(hydrateOrder);
    
    const response: MACHApiResponse<Order[]> = {
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
    const email = body.customerEmail || (body.shippingAddress as any)?.email;
    if (!email) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['customer email is required']
      }, { status: 400 });
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['items array is required and must not be empty']
      }, { status: 400 });
    }

    if (!body.shippingAddress) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['shippingAddress is required']
      }, { status: 400 });
    }

    // Use MACH-compliant addresses directly
    const shippingAddress = body.shippingAddress;
    const billingAddress = body.billingAddress;

    // Generate order ID  
    const now = Date.now();
    let baseId = userId ?? "guest";

    if (baseId.includes("@")) {
      baseId = baseId.split("@")[0];
    }
    const safeUserId = baseId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const orderId = `WEB-${safeUserId}-${now}`;

    // Calculate totals
    const subtotal = body.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const total = subtotal + body.taxAmount + (body.shippingOption.cost || 0);

    const db = await getDbAsync();
    
    // Create MACH-compliant order structure
    const machOrder = {
      id: orderId,
      orderNumber: orderId,
      customerId: userId || "guest",
      status: 'pending' as const,
      lineItems: JSON.stringify(body.items.map(item => ({
        id: item.productId.toString(),
        productId: item.productId.toString(),
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        currency: 'USD',
        product: {
          name: { en: item.name },
          sku: item.sku,
          image: item.image
        }
      }))),
      shipping: JSON.stringify({
        method: body.shippingOption.name || 'Standard',
        cost: body.shippingOption.cost || 0,
        currency: 'USD',
        address: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          company: shippingAddress.company,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2,
          city: shippingAddress.city,
          province: shippingAddress.province,
          country: shippingAddress.country,
          zip: shippingAddress.zip,
          phone: shippingAddress.phone
        }
      }),
      billing: JSON.stringify({
        method: body.billingInfo.method || 'card',
        address: billingAddress || shippingAddress
      }),
      totals: JSON.stringify({
        subtotal,
        shipping: body.shippingOption.cost || 0,
        tax: body.taxAmount,
        total,
        currency: 'USD'
      }),
      metadata: JSON.stringify({
        email,
        billingInfo: body.billingInfo
      }),
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Create the order
    const [newOrder] = await db.insert(orders).values(machOrder).returning();

    // Send order confirmation email
    try {
      const user = await currentUser();
      const customerName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}`
        : `${shippingAddress.firstName} ${shippingAddress.lastName}` || 'Valued Customer';

      const orderData: OrderData = {
        orderNumber: orderId,
        customerName,
        customerEmail: email,
        items: body.items.map(item => ({
          productId: item.productId.toString(),
          name: item.name,
          price: item.unitPrice,
          quantity: item.quantity,
          imageUrl: item.image,
        })),
        subtotal,
        shipping: body.shippingOption.cost || 0,
        tax: body.taxAmount,
        total,
        shippingAddress: {
          street: shippingAddress.address1 + (shippingAddress.address2 ? `, ${shippingAddress.address2}` : ''),
          city: shippingAddress.city,
          state: shippingAddress.province || '',
          zipCode: shippingAddress.zip,
          country: shippingAddress.country || 'United States',
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
    
    const response: MACHApiResponse<Order> = {
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
    const { orderId, status, carrier, trackingNumber, trackingUrl, cancellationReason, notes } = body;

    if (!orderId) {
      return NextResponse.json({
        error: 'Validation failed',
        details: ['orderId is required']
      }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({
        error: 'Validation failed', 
        details: ['status is required']
      }, { status: 400 });
    }

    // Validate status value
    const validStatuses = ['cart', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
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
    
    // Parse current metadata and shipping info
    const currentMetadata = currentOrder.metadata ? JSON.parse(currentOrder.metadata) : {};
    const currentShipping = currentOrder.shipping ? JSON.parse(currentOrder.shipping) : {};

    // Update metadata with tracking information
    const updatedMetadata = {
      ...currentMetadata,
      ...(carrier && { carrier }),
      ...(trackingNumber && { trackingNumber }),
      ...(trackingUrl && { trackingUrl }),
      ...(cancellationReason && { cancellationReason }),
      ...(status === 'shipped' && { shippedAt: new Date().toISOString() }),
      ...(status === 'delivered' && { deliveredAt: new Date().toISOString() })
    };

    // Update shipping with tracking info
    const updatedShipping = {
      ...currentShipping,
      ...(trackingNumber && { trackingNumber }),
      ...(status === 'delivered' && { 
        estimatedDelivery: new Date().toISOString() 
      })
    };

    // Build update data
    const updateData: any = {
      status,
      shipping: JSON.stringify(updatedShipping),
      metadata: JSON.stringify(updatedMetadata),
      ...(notes && { notes }),
      updatedAt: new Date().toISOString()
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

    const response: MACHApiResponse<Order> = {
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
  const lineItems = JSON.parse(dbOrder.lineItems);
  const shipping = dbOrder.shipping ? JSON.parse(dbOrder.shipping) : null;
  const billing = dbOrder.billing ? JSON.parse(dbOrder.billing) : null;
  const totals = JSON.parse(dbOrder.totals);
  const metadata = dbOrder.metadata ? JSON.parse(dbOrder.metadata) : {};

  return {
    id: dbOrder.id,
    orderNumber: dbOrder.orderNumber || dbOrder.id,
    customerId: dbOrder.customerId,
    status: dbOrder.status as any,
    lineItems: lineItems,
    shipping: shipping,
    billing: billing,
    totals: totals,
    notes: dbOrder.notes || undefined,
    metadata: metadata,
    createdAt: dbOrder.createdAt,
    updatedAt: dbOrder.updatedAt
  };
}

/**
 * Transform order data for email notification
 */
function transformOrderForEmail(order: any): any {
  const lineItems = typeof order.lineItems === 'string' ? JSON.parse(order.lineItems) : order.lineItems || [];
  const shipping = typeof order.shipping === 'string' ? JSON.parse(order.shipping) : order.shipping || {};
  const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata || {};

  const shippingAddr = shipping.address || {};

  return {
    orderNumber: order.id,
    customerName: `${shippingAddr.firstName || ''} ${shippingAddr.lastName || ''}`.trim() || 'Valued Customer',
    customerEmail: metadata.email || '',
    status: order.status,
    carrier: metadata.carrier,
    trackingNumber: metadata.trackingNumber,
    trackingUrl: metadata.trackingUrl,
    notes: order.notes,
    cancellationReason: metadata.cancellationReason,
    items: lineItems.map((item: any) => ({
      productId: item.productId || item.id,
      name: item.product?.name?.en || item.name || item.title,
      price: item.unitPrice || item.price || 0,
      quantity: item.quantity || 1,
      imageUrl: item.product?.image || item.imageUrl || item.image,
    })),
    shippingAddress: {
      street: `${shippingAddr.address1 || ''} ${shippingAddr.address2 || ''}`.trim(),
      city: shippingAddr.city || '',
      state: shippingAddr.province || shippingAddr.state || '',
      zipCode: shippingAddr.zip || '',
      country: shippingAddr.country || 'US',
    },
  };
}
