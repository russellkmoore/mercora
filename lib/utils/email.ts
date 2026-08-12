import { Money, type StoredMoney } from '@/lib/money';
import { escapeHtmlText } from '@/lib/utils/maintenance-html';
import { getStoreConfig } from '@/lib/store-config';
import { postalFooterHtml, postalFooterText } from '@/lib/email/footer';
import { sendEmail, type EmailResult } from '@/lib/email/sender';

export type { EmailResult } from '@/lib/email/sender';

export interface OrderData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    productId: string;
    name: string;
    price: StoredMoney;
    quantity: number;
    imageUrl?: string;
  }>;
  subtotal: StoredMoney;
  shipping: StoredMoney;
  tax: StoredMoney;
  discount?: StoredMoney;
  tender?: StoredMoney;
  total: StoredMoney;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  estimatedDelivery?: string;
}

export type MerchantOrderData = Omit<OrderData, 'customerEmail'> & {
  customerEmail?: string;
};

export interface OrderStatusUpdateData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  cancellationReason?: string;
  items: Array<{
    productId: string;
    name: string;
    price: StoredMoney;
    quantity: number;
    imageUrl?: string;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

function safeHttps(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : undefined;
  } catch { return undefined; }
}

export async function sendOrderConfirmationEmail(
  orderData: OrderData,
  options: { idempotencyKey?: string } = {}
): Promise<EmailResult> {
  const store = getStoreConfig();
  return sendEmail({
    from: store.contact.senderEmail,
    to: [orderData.customerEmail],
    ...(store.contact.replyToEmail ? { replyTo: store.contact.replyToEmail } : {}),
    subject: `Order Confirmation #${orderData.orderNumber} - ${store.identity.name}`,
    html: generateOrderConfirmationHTML(orderData),
    text: generateOrderConfirmationText(orderData),
  }, options);
}

export function generateOrderConfirmationText(orderData: OrderData): string {
  const store = getStoreConfig();
  const itemLines = orderData.items.map((item) =>
    `${item.quantity} x ${item.name} — ${Money.fromStored(item.price).times(item.quantity).format()}`
  );
  return [
    `${store.identity.name}: Order confirmation #${orderData.orderNumber}`,
    `Hi ${orderData.customerName},`,
    'Thank you for your order. It is being prepared for shipment.',
    ...itemLines,
    `Subtotal: ${Money.fromStored(orderData.subtotal).format()}`,
    `Shipping: ${Money.fromStored(orderData.shipping).format()}`,
    `Tax: ${Money.fromStored(orderData.tax).format()}`,
    `Total: ${Money.fromStored(orderData.total).format()}`,
    `Ship to: ${orderData.shippingAddress.street}, ${orderData.shippingAddress.city}, ${orderData.shippingAddress.state} ${orderData.shippingAddress.zipCode}, ${orderData.shippingAddress.country}`,
    `Questions? Contact ${store.contact.supportEmail}.`,
    postalFooterText(),
  ].join('\n\n');
}

export function generateOrderConfirmationHTML(orderData: OrderData): string {
  const store = getStoreConfig();
  const safeStoreName = escapeHtmlText(store.identity.name);
  const safeTagline = escapeHtmlText(store.identity.tagline);

  // Helper function to ensure absolute URLs for images using Cloudflare Image service
  const getAbsoluteImageUrl = (imageUrl: string | undefined): string | undefined => {
    if (!imageUrl) return undefined;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        const parsed = new URL(imageUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          ? parsed.toString()
          : undefined;
      } catch {
        return undefined;
      }
    }
    
    // Resolve relative catalog paths under the configured store/image origin.
    // URL serialization percent-encodes quotes/spaces before HTML escaping.
    try {
      const normalizedPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
      const transform = store.urls.imageCdn && store.deployment.imageTransformsEnabled;
      const path = transform
        ? `/cdn-cgi/image/width=100,quality=80,format=auto/${normalizedPath}`
        : `/${normalizedPath}`;
      return new URL(path, store.urls.imageCdn ?? store.urls.site).href;
    } catch {
      return undefined;
    }
  };

  const itemsHTML = orderData.items.map(item => {
    const absoluteImageUrl = getAbsoluteImageUrl(item.imageUrl);
    const safeName = escapeHtmlText(item.name);
    return `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 0; vertical-align: top; width: 60px;">
        ${absoluteImageUrl ? `<img src="${escapeHtmlText(absoluteImageUrl)}" alt="${safeName}" style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover; display: block;">` : `<div style="width: 50px; height: 50px; background-color: #f1f5f9; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 12px; text-align: center;">No Image</div>`}
      </td>
      <td style="padding: 12px 0 12px 16px; vertical-align: top;">
        <div style="color: #1e293b; font-size: 16px; font-weight: bold; margin: 0 0 4px;">${safeName}</div>
        <div style="color: #64748b; font-size: 14px; margin: 0;">Quantity: ${escapeHtmlText(String(item.quantity))} × ${Money.fromStored(item.price).format()}</div>
      </td>
      <td style="padding: 12px 0; text-align: right; vertical-align: top;">
        <div style="color: #1e293b; font-size: 16px; font-weight: bold; margin: 0;">${Money.fromStored(item.price).times(item.quantity).format()}</div>
      </td>
    </tr>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - ${safeStoreName}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif;">
      <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0 48px; margin-bottom: 64px; max-width: 600px;">
        
        <!-- Header -->
        <div style="text-align: center; padding: 32px 0; border-bottom: 1px solid #e6ebf1;">
          <h1 style="color: #f97316; font-size: 32px; font-weight: bold; margin: 0; padding: 0;">${safeStoreName}</h1>
          <p style="color: #64748b; font-size: 14px; margin: 8px 0 0;">${safeTagline}</p>
        </div>

        <!-- Order Confirmation -->
        <div style="padding: 24px 32px;">
          <h2 style="color: #1e293b; font-size: 24px; font-weight: bold; margin: 0 0 16px;">Order Confirmed!</h2>
          <p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Hi ${escapeHtmlText(orderData.customerName)},</p>
          <p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Thank you for your order! It is being prepared and will be shipped soon.</p>
          
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 8px;">Order #${escapeHtmlText(orderData.orderNumber)}</p>
            ${orderData.estimatedDelivery ? `<p style="color: #64748b; font-size: 14px; margin: 0;">Estimated delivery: ${escapeHtmlText(orderData.estimatedDelivery)}</p>` : ''}
          </div>
        </div>

        <!-- Order Items -->
        <div style="padding: 24px 32px;">
          <h3 style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 12px;">Your Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${itemsHTML}
          </table>
        </div>

        <!-- Order Summary -->
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 32px;">
          <table style="width: 100%;">
            <tr style="padding: 4px 0;">
              <td style="color: #64748b; font-size: 14px;">Subtotal:</td>
              <td style="text-align: right; color: #1e293b; font-size: 14px;">${Money.fromStored(orderData.subtotal).format()}</td>
            </tr>
            <tr style="padding: 4px 0;">
              <td style="color: #64748b; font-size: 14px;">Shipping:</td>
              <td style="text-align: right; color: #1e293b; font-size: 14px;">${Money.fromStored(orderData.shipping).format()}</td>
            </tr>
            ${orderData.discount && !Money.fromStored(orderData.discount).isZero() ? `
            <tr style="padding: 4px 0;">
              <td style="color: #64748b; font-size: 14px;">Discount:</td>
              <td style="text-align: right; color: #1e293b; font-size: 14px;">${Money.fromStored(orderData.discount).negate().format()}</td>
            </tr>` : ''}
            <tr style="padding: 4px 0;">
              <td style="color: #64748b; font-size: 14px;">Tax:</td>
              <td style="text-align: right; color: #1e293b; font-size: 14px;">${Money.fromStored(orderData.tax).format()}</td>
            </tr>
            ${orderData.tender && !Money.fromStored(orderData.tender).isZero() ? `
            <tr style="padding: 4px 0;">
              <td style="color: #64748b; font-size: 14px;">Other tender:</td>
              <td style="text-align: right; color: #1e293b; font-size: 14px;">${Money.fromStored(orderData.tender).negate().format()}</td>
            </tr>` : ''}
            <tr style="border-top: 2px solid #e2e8f0; padding: 12px 0 0; margin: 12px 0 0;">
              <td style="color: #1e293b; font-size: 16px; font-weight: bold; padding-top: 12px;">Total:</td>
              <td style="text-align: right; color: #f97316; font-size: 18px; font-weight: bold; padding-top: 12px;">${Money.fromStored(orderData.total).format()}</td>
            </tr>
          </table>
        </div>

        <!-- Shipping Address -->
        <div style="padding: 24px 32px;">
          <h3 style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 12px;">Shipping Address</h3>
          <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0;">
            ${escapeHtmlText(orderData.shippingAddress.street)}<br>
            ${escapeHtmlText(orderData.shippingAddress.city)}, ${escapeHtmlText(orderData.shippingAddress.state)} ${escapeHtmlText(orderData.shippingAddress.zipCode)}<br>
            ${escapeHtmlText(orderData.shippingAddress.country)}
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 32px 32px 0; border-top: 1px solid #e6ebf1;">
          <p style="color: #64748b; font-size: 12px; line-height: 16px; margin: 0 0 8px;">Questions about your order? Reply to this email or contact our support team.</p>
          <p style="color: #64748b; font-size: 12px; line-height: 16px; margin: 0 0 8px;">Thank you for choosing ${safeStoreName}!</p>
          ${postalFooterHtml()}
        </div>

      </div>
    </body>
    </html>
  `;
}

function generateOrderStatusUpdateHTML(orderData: OrderStatusUpdateData): string {
  const store = getStoreConfig();
  // Helper function to ensure absolute URLs for images using Cloudflare Image service
  const getAbsoluteImageUrl = (imageUrl: string | undefined): string | undefined => {
    if (!imageUrl) return undefined;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        const parsed = new URL(imageUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
      } catch { return undefined; }
    }
    
    // Normalize the path (remove leading slash if present)
    const normalizedPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
    
    // Use Cloudflare Image service for optimized delivery in emails
    // Set width to 100px for email images and quality to 80 for good balance
    try {
      const path = store.urls.imageCdn && store.deployment.imageTransformsEnabled
        ? `/cdn-cgi/image/width=100,quality=80,format=auto/${normalizedPath}`
        : `/${normalizedPath}`;
      return new URL(path, store.urls.imageCdn ?? store.urls.site).href;
    } catch { return undefined; }
  };
  const safeTrackingUrl = safeHttps(orderData.trackingUrl);

  // Generate status-specific content
  let statusMessage = "";
  let statusColor = "#64748b";
  let statusContent = "";

  switch (orderData.status) {
    case 'processing':
      statusMessage = "Your order is being processed";
      statusColor = "#3b82f6";
      statusContent = `<p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">We're preparing your order for shipment. You'll receive another email with tracking information once your order ships.</p>`;
      break;

    case 'shipped':
      statusMessage = "Your order has shipped!";
      statusColor = "#10b981";
      statusContent = `
        <p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Great news! Your order is on its way to you.</p>
        ${orderData.carrier ? `
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="color: #1e293b; font-size: 16px; font-weight: bold; margin: 0 0 8px;">Shipping Details</h3>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 4px;"><strong>Carrier:</strong> ${escapeHtmlText(orderData.carrier)}</p>
            ${orderData.trackingNumber ? `<p style="color: #64748b; font-size: 14px; margin: 0 0 4px;"><strong>Tracking Number:</strong> ${escapeHtmlText(orderData.trackingNumber)}</p>` : ''}
            ${safeTrackingUrl ? `
              <a href="${escapeHtmlText(safeTrackingUrl)}" style="display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 12px;">
                Track Your Package
              </a>
            ` : ''}
          </div>
        ` : ''}
      `;
      break;

    case 'delivered':
      statusMessage = "Your order has been delivered!";
      statusColor = "#059669";
      statusContent = `
        <p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Your order has been successfully delivered. We hope you enjoy your purchase!</p>
        <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0 0 16px;">If you have any issues with your order, please don't hesitate to contact our support team.</p>
      `;
      break;

    case 'cancelled':
      statusMessage = "Your order has been cancelled";
      statusColor = "#dc2626";
      statusContent = `
        <p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Your order has been cancelled as requested.</p>
        ${orderData.cancellationReason ? `
          <div style="background-color: #fef3f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0;">
            <p style="color: #7f1d1d; font-size: 14px; margin: 0;"><strong>Reason:</strong> ${escapeHtmlText(orderData.cancellationReason)}</p>
          </div>
        ` : ''}
        <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0 0 16px;">If you have any questions about this cancellation or need assistance with a new order, please contact our support team.</p>
      `;
      break;

    case 'refunded':
      statusMessage = "Your order has been refunded";
      statusColor = "#f97316";
      statusContent = `
        <p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Your order has been refunded and the payment has been processed back to your original payment method.</p>
        <div style="background-color: #fef3f2; border-left: 4px solid #f97316; padding: 12px 16px; margin: 16px 0;">
          <p style="color: #ea580c; font-size: 14px; margin: 0 0 4px;"><strong>Refund Processing:</strong></p>
          <p style="color: #7c2d12; font-size: 14px; margin: 0;">Please allow 5-10 business days for the refund to appear on your statement.</p>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0 0 16px;">If you have any questions about this refund, please contact our support team.</p>
      `;
      break;

    default:
      statusMessage = "Order status updated";
      statusContent = `<p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Your order status has been updated.</p>`;
  }

  // Generate items HTML (simplified for status updates)
  const itemsHTML = orderData.items.slice(0, 3).map(item => {
    const absoluteImageUrl = getAbsoluteImageUrl(item.imageUrl);
    const safeItemName = escapeHtmlText(item.name);
    return `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 0; vertical-align: top; width: 50px;">
        ${absoluteImageUrl ? `<img src="${escapeHtmlText(absoluteImageUrl)}" alt="${safeItemName}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; display: block;">` : `<div style="width: 40px; height: 40px; background-color: #f1f5f9; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 10px; text-align: center;">No Image</div>`}
      </td>
      <td style="padding: 8px 0 8px 12px; vertical-align: top;">
        <div style="color: #1e293b; font-size: 14px; font-weight: bold; margin: 0 0 2px;">${safeItemName}</div>
        <div style="color: #64748b; font-size: 12px; margin: 0;">Qty: ${escapeHtmlText(String(item.quantity))}</div>
      </td>
    </tr>
  `;
  }).join('');

  const hasMoreItems = orderData.items.length > 3;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Update - ${escapeHtmlText(store.identity.name)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif;">
      <div style="background-color: #ffffff; margin: 0 auto; padding: 20px 0 48px; margin-bottom: 64px; max-width: 600px;">
        
        <!-- Header -->
        <div style="text-align: center; padding: 32px 0; border-bottom: 1px solid #e6ebf1;">
          <h1 style="color: #f97316; font-size: 32px; font-weight: bold; margin: 0; padding: 0;">${escapeHtmlText(store.identity.name)}</h1>
          <p style="color: #64748b; font-size: 14px; margin: 8px 0 0;">${escapeHtmlText(store.identity.tagline)}</p>
        </div>

        <!-- Status Update -->
        <div style="padding: 24px 32px;">
          <h2 style="color: ${statusColor}; font-size: 24px; font-weight: bold; margin: 0 0 16px;">${statusMessage}</h2>
          <p style="color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Hi ${escapeHtmlText(orderData.customerName)},</p>
          
          ${statusContent}

          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 16px; font-weight: bold; margin: 0 0 8px;">Order #${escapeHtmlText(orderData.orderNumber)}</p>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Status: <span style="color: ${statusColor}; font-weight: bold;">${escapeHtmlText(orderData.status.charAt(0).toUpperCase() + orderData.status.slice(1))}</span></p>
          </div>
          
          ${orderData.notes ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px; margin: 16px 0;">
              <p style="color: #64748b; font-size: 14px; margin: 0;"><strong>Note:</strong> ${escapeHtmlText(orderData.notes)}</p>
            </div>
          ` : ''}
        </div>

        <!-- Order Items (Preview) -->
        <div style="padding: 24px 32px;">
          <h3 style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 12px;">Your Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${itemsHTML}
          </table>
          ${hasMoreItems ? `
            <p style="color: #64748b; font-size: 12px; margin: 8px 0 0; text-align: center;">
              and ${orderData.items.length - 3} more item${orderData.items.length - 3 > 1 ? 's' : ''}
            </p>
          ` : ''}
        </div>

        <!-- Shipping Address -->
        <div style="padding: 24px 32px;">
          <h3 style="color: #1e293b; font-size: 18px; font-weight: bold; margin: 0 0 12px;">Shipping Address</h3>
          <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0;">
            ${escapeHtmlText(orderData.shippingAddress.street)}<br>
            ${escapeHtmlText(orderData.shippingAddress.city)}, ${escapeHtmlText(orderData.shippingAddress.state)} ${escapeHtmlText(orderData.shippingAddress.zipCode)}<br>
            ${escapeHtmlText(orderData.shippingAddress.country)}
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 32px 32px 0; border-top: 1px solid #e6ebf1;">
          <p style="color: #64748b; font-size: 12px; line-height: 16px; margin: 0 0 8px;">Questions about your order? Reply to this email or contact our support team.</p>
          <p style="color: #64748b; font-size: 12px; line-height: 16px; margin: 0 0 8px;">Thank you for choosing ${escapeHtmlText(store.identity.name)}!</p>
          ${postalFooterHtml()}
        </div>

      </div>
    </body>
    </html>
  `;
}

export async function sendOrderStatusUpdateEmail(
  orderData: OrderStatusUpdateData,
  options: { idempotencyKey?: string } = {},
): Promise<EmailResult> {
  const store = getStoreConfig();
  const trackingUrl = safeHttps(orderData.trackingUrl);
  const subjects: Record<string, string> = {
    shipped: `Your Order Has Shipped! #${orderData.orderNumber}`,
    delivered: `Order Delivered #${orderData.orderNumber}`,
    cancelled: `Order Cancelled #${orderData.orderNumber}`,
    processing: `Order Processing #${orderData.orderNumber}`,
    refunded: `Order Refunded #${orderData.orderNumber}`,
  };
  const text = [
    `${store.identity.name}: ${subjects[orderData.status] ?? `Order Update #${orderData.orderNumber}`}`,
    `Hi ${orderData.customerName},`,
    `Your order status is now ${orderData.status}.`,
    orderData.carrier ? `Carrier: ${orderData.carrier}` : null,
    orderData.trackingNumber ? `Tracking number: ${orderData.trackingNumber}` : null,
    trackingUrl ? `Track your package: ${trackingUrl}` : null,
    orderData.notes ? `Note: ${orderData.notes}` : null,
    `Questions? Contact ${store.contact.supportEmail}.`,
    postalFooterText(),
  ].filter((line): line is string => line !== null).join('\n\n');

  return sendEmail({
    from: store.contact.senderEmail,
    to: [orderData.customerEmail],
    ...(store.contact.replyToEmail ? { replyTo: store.contact.replyToEmail } : {}),
    subject: `${subjects[orderData.status] ?? `Order Update #${orderData.orderNumber}`} - ${store.identity.name}`,
    html: generateOrderStatusUpdateHTML(orderData),
    text,
  }, options);
}

/** Notify a configured merchant independently from the customer confirmation. */
export async function sendNewOrderMerchantNotification(
  orderData: MerchantOrderData,
  options: { idempotencyKey?: string } = {},
): Promise<EmailResult> {
  const store = getStoreConfig();
  const recipient = store.contact.merchantNotificationEmail;
  if (!recipient) return { success: true, skipped: true };

  const adminUrl = new URL(
    `/admin/orders/${encodeURIComponent(orderData.orderNumber)}`,
    store.urls.site,
  ).href;
  const itemText = orderData.items.map((item) =>
    `${item.quantity} x ${item.name} — ${Money.fromStored(item.price).times(item.quantity).format()}`
  );
  const address = [
    orderData.customerName,
    orderData.shippingAddress.street,
    [orderData.shippingAddress.city, orderData.shippingAddress.state, orderData.shippingAddress.zipCode]
      .filter(Boolean).join(', '),
    orderData.shippingAddress.country,
  ].filter(Boolean).join('\n');
  const text = [
    `New order ${orderData.orderNumber}`,
    'Items to ship',
    ...itemText,
    `Subtotal: ${Money.fromStored(orderData.subtotal).format()}`,
    `Shipping: ${Money.fromStored(orderData.shipping).format()}`,
    `Tax: ${Money.fromStored(orderData.tax).format()}`,
    `Total: ${Money.fromStored(orderData.total).format()}`,
    'Ship to',
    address,
    orderData.customerEmail ? `Customer email: ${orderData.customerEmail}` : null,
    `Manage this order: ${adminUrl}`,
  ].filter((line): line is string => line !== null).join('\n\n');
  const rows = orderData.items.map((item) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>${escapeHtmlText(String(item.quantity))} &times;</strong> ${escapeHtmlText(item.name)}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtmlText(Money.fromStored(item.price).times(item.quantity).format())}</td></tr>`
  ).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>New order ${escapeHtmlText(orderData.orderNumber)}</h2><p>${escapeHtmlText(Money.fromStored(orderData.total).format())}${orderData.customerEmail ? ` · ${escapeHtmlText(orderData.customerEmail)}` : ''}</p><h3>Items to ship</h3><table style="border-collapse:collapse;width:100%">${rows}</table><h3>Ship to</h3><p style="white-space:pre-line">${escapeHtmlText(address)}</p><p><a href="${escapeHtmlText(adminUrl)}">Manage this order</a></p>${postalFooterHtml()}</div>`;

  return sendEmail({
    from: store.contact.senderEmail,
    to: [recipient],
    ...(orderData.customerEmail ? { replyTo: orderData.customerEmail } : {}),
    subject: `New order ${orderData.orderNumber} - ${Money.fromStored(orderData.total).format()}`,
    html,
    text,
  }, options);
}
