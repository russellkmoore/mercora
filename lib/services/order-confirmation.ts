import { Money } from '@/lib/money';
import type { Order } from '@/lib/types/order';
import { sendOrderConfirmationEmail, type EmailResult } from '@/lib/utils/email';

function localizedText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const values = value as Record<string, unknown>;
    const localized = values.en ?? Object.values(values)[0];
    if (typeof localized === 'string') return localized;
  }
  return '';
}

export async function sendOrderConfirmation(
  order: Order,
  idempotencyKey: string
): Promise<EmailResult> {
  const address = order.shipping_address;
  const extensions = order.extensions ?? {};
  const email = typeof extensions.email === 'string'
    ? extensions.email
    : address?.email;
  if (!email || !address || !order.id) return { success: true };

  return sendOrderConfirmationEmail({
    orderNumber: order.id,
    customerName: address.recipient || address.company || 'Customer',
    customerEmail: email,
    items: order.items.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      price: Money.fromStored(item.unit_price, order.currency_code).toJSON(),
      quantity: item.quantity,
    })),
    subtotal: Money.fromStored(
      extensions.checkout_catalog_subtotal ?? extensions.checkout_subtotal ?? 0,
      order.currency_code
    ).toJSON(),
    shipping: Money.fromStored(
      extensions.checkout_shipping_before_discount ?? extensions.checkout_shipping ?? 0,
      order.currency_code
    ).toJSON(),
    tax: Money.fromStored(extensions.checkout_tax ?? 0, order.currency_code).toJSON(),
    discount: Money.fromStored(extensions.checkout_discount ?? 0, order.currency_code).toJSON(),
    tender: Money.fromStored(extensions.checkout_tender ?? 0, order.currency_code).toJSON(),
    total: Money.fromStored(order.total_amount, order.currency_code).toJSON(),
    shippingAddress: {
      street: [localizedText(address.line1), localizedText(address.line2)].filter(Boolean).join(', '),
      city: localizedText(address.city),
      state: address.region || '',
      zipCode: address.postal_code || '',
      country: address.country,
    },
  }, { idempotencyKey });
}
