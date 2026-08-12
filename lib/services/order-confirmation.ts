import { Money } from '@/lib/money';
import type { Order } from '@/lib/types/order';
import { sendOrderConfirmationEmail, type EmailResult } from '@/lib/utils/email';
import { getDbAsync } from '@/lib/db';
import { products } from '@/lib/db/schema/products';
import { inArray } from 'drizzle-orm';

const MAX_IMAGE_PRODUCT_IDS = 100;

function firstImage(primary: unknown, media: unknown): string | undefined {
  const parse = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  };
  const primaryValue = parse(primary);
  if (typeof primaryValue === 'string' && primaryValue) return primaryValue;
  if (primaryValue && typeof primaryValue === 'object' && 'url' in primaryValue && typeof primaryValue.url === 'string') return primaryValue.url;
  const list = parse(media);
  const candidate = Array.isArray(list) ? list[0] : undefined;
  if (typeof candidate === 'string') return candidate;
  return candidate && typeof candidate === 'object' && 'url' in candidate && typeof candidate.url === 'string'
    ? candidate.url
    : undefined;
}

/** One bounded, deduplicated catalog query for all persisted order lines. */
export async function resolveOrderLineImages(
  productIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(productIds.filter(Boolean))].slice(0, MAX_IMAGE_PRODUCT_IDS);
  if (!unique.length) return new Map();
  try {
    const db = await getDbAsync();
    const rows = await db.select({ id: products.id, primary: products.primary_image, media: products.media })
      .from(products).where(inArray(products.id, unique));
    return new Map(rows.flatMap((row) => {
      const image = firstImage(row.primary, row.media);
      return image ? [[row.id, image] as const] : [];
    }));
  } catch {
    return new Map();
  }
}

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
  const images = await resolveOrderLineImages(order.items.map((item) => item.product_id));

  return sendOrderConfirmationEmail({
    orderNumber: order.id,
    customerName: address.recipient || address.company || 'Customer',
    customerEmail: email,
    items: order.items.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      price: Money.fromStored(item.unit_price, order.currency_code).toJSON(),
      quantity: item.quantity,
      imageUrl: images.get(item.product_id),
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
