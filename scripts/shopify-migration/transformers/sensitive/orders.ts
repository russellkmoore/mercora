import type { MACHAddress } from "../../../../lib/types/mach/Address.js";
import type { OrderItem, OrderStatus, PaymentStatus } from "../../../../lib/types/order.js";
import type { ShopifyCustomerAddress, ShopifyOrder, ShopifyOrderLineItem } from "../../lib/types.js";
import { deterministicProviderId, providerFingerprint } from "../../lib/ids.js";
import {
  SHOPIFY_PROVIDER,
  isoTimestamp,
  majorToStoredMoney,
  requiredMigrationTime,
  requireSupportedCurrency,
} from "../_shared.js";
import {
  MAX_ORDER_ITEMS,
  assertBatchSize,
  boundedText,
  normalizedEmail,
  resolvedProviderId,
  safeClerkUserId,
  type SensitiveTransformResult,
  sourceId,
} from "./_shared.js";

export interface HistoricalOrderInsertRecord {
  id: string;
  customer_id: string | null;
  status: OrderStatus;
  total_amount: string;
  currency_code: string;
  shipping_address: string | null;
  billing_address: string | null;
  items: string;
  shipping_method: null;
  shipping_carrier: null;
  payment_method: null;
  payment_status: PaymentStatus;
  tracking_number: null;
  shipped_at: null;
  delivered_at: null;
  notes: string | null;
  external_references: string;
  extensions: string;
  created_at: string;
  updated_at: string;
}

export interface HistoricalOrderTransformRecord {
  sourceFingerprint: string;
  order: HistoricalOrderInsertRecord;
}

export interface HistoricalOrderTransformOptions {
  generatedAt: string;
  customerIds?: ReadonlyMap<string, string>;
  productIds?: ReadonlyMap<string, string>;
  variantIds?: ReadonlyMap<string, string>;
  unresolvedCustomer: "reject" | "guest";
}

function address(value: ShopifyCustomerAddress | null | undefined): MACHAddress | null {
  if (!value) return null;
  const line1 = boundedText(value.address1, 300);
  const city = boundedText(value.city, 200);
  const rawCountry = boundedText(value.country_code ?? value.country, 2)?.toUpperCase();
  if (!line1 || !city || !rawCountry || !/^[A-Z]{2}$/.test(rawCountry)) return null;
  const firstName = boundedText(value.first_name, 100);
  const lastName = boundedText(value.last_name, 100);
  const recipient = [firstName, lastName].filter(Boolean).join(" ") || null;
  const line2 = boundedText(value.address2, 300);
  const region = boundedText(value.province ?? value.province_code, 200);
  const postalCode = boundedText(value.zip, 32);
  const company = boundedText(value.company, 200);
  const phone = boundedText(value.phone, 50);
  return {
    line1,
    city,
    country: rawCountry,
    status: "unverified",
    ...(line2 ? { line2 } : {}),
    ...(region ? { region } : {}),
    ...(postalCode ? { postal_code: postalCode } : {}),
    ...(company ? { company } : {}),
    ...(recipient ? { recipient } : {}),
    ...(phone ? { phone } : {}),
  };
}

function conservativeOrderStatus(order: ShopifyOrder): OrderStatus {
  const financial = order.financial_status?.trim().toLowerCase();
  const fulfillment = order.fulfillment_status?.trim().toLowerCase();
  if (order.cancelled_at || financial === "voided" || financial === "cancelled") return "cancelled";
  if (financial === "refunded") return "refunded";
  if (fulfillment === "fulfilled" || fulfillment === "partial") return "shipped";
  if (financial === "paid" || financial === "partially_paid") return "processing";
  return "pending";
}

/** Never mark external history paid: paid is Mercora's Stripe/effect authority. */
function nonAuthoritativePaymentStatus(order: ShopifyOrder): PaymentStatus {
  const financial = order.financial_status?.trim().toLowerCase();
  if (financial === "refunded") return "refunded";
  if (financial === "voided" || financial === "cancelled") return "failed";
  return "pending";
}

function checkedLineItem(
  item: ShopifyOrderLineItem,
  orderSourceId: string,
  position: number,
  currency: string,
  options: HistoricalOrderTransformOptions,
): OrderItem {
  if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000) {
    throw new RangeError("Order item quantity is invalid");
  }
  const itemSource = item.id === undefined ? `position:${position}` : sourceId(item.id);
  const lineIdentity = `${orderSourceId}:line:${itemSource}`;
  const productSource = item.product_id === null || item.product_id === undefined
    ? lineIdentity
    : sourceId(item.product_id);
  const productId = item.product_id === null || item.product_id === undefined
    ? deterministicProviderId(SHOPIFY_PROVIDER, "historical_product", productSource)
    : resolvedProviderId(options.productIds, "product", productSource)
      ?? deterministicProviderId(SHOPIFY_PROVIDER, "historical_product", productSource);
  const variantSource = item.variant_id === null || item.variant_id === undefined
    ? null
    : sourceId(item.variant_id);
  const variantId = variantSource
    ? resolvedProviderId(options.variantIds, "variant", variantSource)
      ?? deterministicProviderId(SHOPIFY_PROVIDER, "historical_variant", variantSource)
    : undefined;
  const unitPrice = majorToStoredMoney(item.price, currency);
  const gross = unitPrice.amount * item.quantity;
  if (!Number.isSafeInteger(gross)) throw new RangeError("Order item total overflows safe money storage");
  const discount = item.total_discount ? majorToStoredMoney(item.total_discount, currency).amount : 0;
  if (discount > gross) throw new RangeError("Order item discount exceeds its gross total");
  const id = deterministicProviderId(SHOPIFY_PROVIDER, "order_item", lineIdentity);
  return {
    id,
    product_id: productId,
    ...(variantId ? { variant_id: variantId } : {}),
    sku: boundedText(item.sku, 128)
      ?? `IMPORTED-${providerFingerprint(SHOPIFY_PROVIDER, "order_item", lineIdentity).slice(0, 12).toUpperCase()}`,
    quantity: item.quantity,
    unit_price: unitPrice,
    total_price: { amount: gross - discount, currency },
    product_name: boundedText(item.title, 300, { required: true })!,
  };
}

export function transformHistoricalOrders(
  orders: readonly ShopifyOrder[],
  options: HistoricalOrderTransformOptions,
): SensitiveTransformResult<HistoricalOrderTransformRecord> {
  assertBatchSize(orders.length);
  if (options.unresolvedCustomer !== "reject" && options.unresolvedCustomer !== "guest") {
    throw new TypeError("unresolvedCustomer must explicitly be reject or guest");
  }
  const generatedAt = requiredMigrationTime(options.generatedAt);
  const records: HistoricalOrderTransformRecord[] = [];
  const idMap = new Map<string, string>();
  const skipped: Array<{ sourceFingerprint: string | null; reason: string }> = [];
  const warnings: string[] = [];
  const seenSources = new Set<string>();

  for (const order of orders) {
    let failedFingerprint: string | null = null;
    try {
      const providerId = sourceId(order.id);
      const sourceFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "order", providerId);
      failedFingerprint = sourceFingerprint;
      if (seenSources.has(sourceFingerprint)) throw new TypeError("Duplicate order source identity");
      if (!Array.isArray(order.line_items) || !order.line_items.length || order.line_items.length > MAX_ORDER_ITEMS) {
        throw new RangeError(`Orders require 1-${MAX_ORDER_ITEMS} line items`);
      }
      const currency = requireSupportedCurrency(boundedText(order.currency, 3, { required: true })!);
      const total = majorToStoredMoney(order.total_price, currency);
      const items = order.line_items.map((item, position) =>
        checkedLineItem(item, providerId, position + 1, currency, options));
      let customerId: string | null = null;
      if (order.customer?.id !== undefined) {
        const customerSource = sourceId(order.customer.id);
        const customerFingerprint = providerFingerprint(SHOPIFY_PROVIDER, "customer", customerSource);
        customerId = safeClerkUserId(options.customerIds?.get(customerFingerprint));
        if (!customerId) {
          if (options.unresolvedCustomer === "reject") {
            throw new TypeError("Order customer requires a resolved Clerk user ID");
          }
          warnings.push(`Order ${sourceFingerprint} has no resolved Clerk customer; retained as explicit guest history`);
        }
      }
      const shippingAddress = address(order.shipping_address);
      const billingAddress = address(order.billing_address);
      if (order.shipping_address && !shippingAddress) {
        warnings.push(`Order ${sourceFingerprint} has an incomplete shipping address; address omitted`);
      }
      if (order.billing_address && !billingAddress) {
        warnings.push(`Order ${sourceFingerprint} has an incomplete billing address; address omitted`);
      }
      const email = normalizedEmail(order.email);
      const createdAt = isoTimestamp(order.created_at, generatedAt);
      const updatedAt = isoTimestamp(order.updated_at, createdAt);
      const id = deterministicProviderId(SHOPIFY_PROVIDER, "order", providerId);
      const sourceFinancialStatus = boundedText(order.financial_status, 64)?.toLowerCase() ?? null;
      const sourceFulfillmentStatus = boundedText(order.fulfillment_status, 64)?.toLowerCase() ?? null;

      records.push({
        sourceFingerprint,
        order: {
          id,
          customer_id: customerId,
          status: conservativeOrderStatus(order),
          total_amount: JSON.stringify(total),
          currency_code: currency,
          shipping_address: shippingAddress ? JSON.stringify(shippingAddress) : null,
          billing_address: billingAddress ? JSON.stringify(billingAddress) : null,
          items: JSON.stringify(items),
          shipping_method: null,
          shipping_carrier: null,
          payment_method: null,
          payment_status: nonAuthoritativePaymentStatus(order),
          tracking_number: null,
          shipped_at: null,
          delivered_at: null,
          notes: boundedText(order.note, 2_000, { multiline: true }),
          external_references: JSON.stringify({ shopify_fingerprint: sourceFingerprint }),
          extensions: JSON.stringify({
            migration: {
              provider: SHOPIFY_PROVIDER,
              imported: true,
              historical: true,
              read_only: true,
              generated_at: generatedAt,
              source_fingerprint: sourceFingerprint,
            },
            payment_provenance: {
              authority: "external_unverified",
              refundable: false,
              paid_effects_eligible: false,
              source_status: sourceFinancialStatus,
            },
            fulfillment_provenance: { source_status: sourceFulfillmentStatus },
            ...(email ? { email } : {}),
          }),
          created_at: createdAt,
          updated_at: updatedAt,
        },
      });
      seenSources.add(sourceFingerprint);
      idMap.set(sourceFingerprint, id);
    } catch (error) {
      skipped.push({
        sourceFingerprint: failedFingerprint,
        reason: error instanceof Error ? error.message : "Order is invalid",
      });
    }
  }

  return { records, idMap, skipped, warnings };
}
