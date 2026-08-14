import { sendEmail, type EmailProvider } from "@/lib/email/sender";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { getStoreConfig } from "@/lib/store-config";
import { escapeHtmlText } from "@/lib/utils/maintenance-html";
import { getOrderById } from "@/lib/models/mach/orders";
import { getOrderCustomerEmail } from "@/lib/orders/customer-email";
import {
  createOrderStatusToken,
  isOrderStatusTokenConfigured,
} from "@/lib/order-status/token";
import type { Order } from "@/lib/types/order";
import { getCarrierRegistry } from "./carrier-config";
import { latestOrderEvent, recordEmailEvent } from "./service";
import { buildShipmentView, type ShipmentView } from "./shipment-view";
import type { Actor, OrderEventType } from "./types";
import { postalFooterHtml, postalFooterText } from "@/lib/email/footer";

export const SHIPPING_EMAIL_TEMPLATE_VERSION = 1;
export const CONCURRENT_EMAIL_SEND_ERROR = "concurrent_idempotent_requests";
/** @deprecated Use the provider-neutral name. */
export const RESEND_CONCURRENT_SEND_ERROR = CONCURRENT_EMAIL_SEND_ERROR;

const MAX_PREVIEW_ITEMS = 5;
const SUCCESSFUL_SEND_EVENTS = [
  "shipping_email_sent",
  "shipping_email_resent",
] as const satisfies readonly OrderEventType[];

interface ShippingStoreSnapshot {
  name: string;
  tagline: string;
  senderEmail: string;
  supportEmail: string;
  siteUrl: string;
  replyToEmail?: string;
}

export interface ShippingConfirmationData {
  orderNumber: string;
  customerName: string | null;
  customerEmail: string;
  items: Array<{ name: string; quantity: number }>;
  shipment: ShipmentView;
  orderStatusUrl: string | null;
  store: ShippingStoreSnapshot;
}

export interface ShippingEmailResult {
  success: boolean;
  provider?: EmailProvider;
  /** The provider is still resolving another request with the same stable key. */
  pending?: boolean;
  /** The provider may have accepted the message; an operator must reconcile before retrying. */
  needsReview?: boolean;
  providerId?: string;
  error?: string;
  errorCode?: string;
}

export interface InitialShippingEmailResult extends ShippingEmailResult {
  attempted: boolean;
  idempotent?: boolean;
  eventId?: string | null;
}

export function shippingEmailTelemetryProvider(
  provider: EmailProvider | undefined,
): "cloudflare_email" | "resend" | undefined {
  return provider === "cloudflare" ? "cloudflare_email" : provider;
}

function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

function absoluteStoreUrl(siteUrl: string, pathname: string): string | null {
  try {
    const url = new URL(pathname, siteUrl);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function customerName(order: Order): string | null {
  const recipient = order.shipping_address?.recipient;
  return typeof recipient === "string" && recipient.trim() ? recipient.trim() : null;
}

/** Build the narrow customer-safe payload from a server-read order. */
export async function buildShippingConfirmationData(
  order: Order,
): Promise<ShippingConfirmationData | null> {
  const customerEmail = getOrderCustomerEmail(order);
  if (!customerEmail || !order.id) return null;

  const config = getStoreConfig();
  let orderStatusUrl: string | null = null;

  if (order.customer_id) {
    orderStatusUrl = absoluteStoreUrl(
      config.urls.site,
      "/orders",
    );
  } else if (isOrderStatusTokenConfigured()) {
    const token = await createOrderStatusToken(order.id);
    if (token) {
      const guestUrl = absoluteStoreUrl(
        config.urls.site,
        `/order-status/${encodeURIComponent(order.id)}`,
      );
      if (guestUrl) {
        const url = new URL(guestUrl);
        url.searchParams.set("token", token);
        orderStatusUrl = url.href;
      }
    }
  }

  return {
    orderNumber: order.id,
    customerName: customerName(order),
    customerEmail,
    items: order.items.slice(0, MAX_PREVIEW_ITEMS).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
    })),
    shipment: buildShipmentView(order, getCarrierRegistry()),
    orderStatusUrl,
    store: {
      name: config.identity.name,
      tagline: config.identity.tagline,
      senderEmail: config.contact.senderEmail,
      supportEmail: config.contact.supportEmail,
      siteUrl: config.urls.site,
      replyToEmail: config.contact.replyToEmail,
    },
  };
}

interface PreparedEmail {
  from: string;
  to: [string];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

function prepareShippingEmail(data: ShippingConfirmationData): PreparedEmail {
  const storeName = escapeHtmlText(data.store.name);
  const tagline = escapeHtmlText(data.store.tagline);
  const orderNumber = escapeHtmlText(data.orderNumber);
  const greeting = escapeHtmlText(data.customerName || "there");
  const supportEmail = escapeHtmlText(data.store.supportEmail);
  const carrierLabel = data.shipment.carrierLabel
    ? escapeHtmlText(data.shipment.carrierLabel)
    : "Shipment";
  const trackingNumber = data.shipment.trackingNumber
    ? escapeHtmlText(data.shipment.trackingNumber)
    : null;

  const itemRows = data.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #e6ebf1;color:#1e293b;font-size:15px"><strong>${escapeHtmlText(String(item.quantity))} &times;</strong> ${escapeHtmlText(item.name)}</td></tr>`,
    )
    .join("");

  const trackingBlock = trackingNumber
    ? `<div style="margin:0 32px 24px;background:#f8fafc;border-radius:12px;padding:24px;text-align:center"><p style="color:#64748b;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">${carrierLabel}</p><p style="color:#1e293b;font-size:20px;font-weight:bold;letter-spacing:1px;margin:0;font-family:monospace">${trackingNumber}</p></div>`
    : "";
  const trackingButton = data.shipment.trackingUrl
    ? `<div style="text-align:center;margin:0 0 16px"><a href="${escapeHtmlText(data.shipment.trackingUrl)}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold">Track your package</a></div>`
    : "";
  const statusButton = data.orderStatusUrl
    ? `<div style="text-align:center;margin:0 0 24px"><a href="${escapeHtmlText(data.orderStatusUrl)}" style="display:inline-block;border:1px solid #f97316;color:#c2410c;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold">View your order</a></div>`
    : "";
  const itemsBlock = itemRows
    ? `<div style="padding:0 32px 8px"><h3 style="color:#1e293b;font-size:16px;margin:0 0 8px">In this shipment</h3><table style="border-collapse:collapse;width:100%;margin:0 0 8px">${itemRows}</table></div>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your order has shipped - ${storeName}</title></head><body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,sans-serif"><div style="background:#fff;margin:0 auto;padding:20px 0 48px;max-width:600px"><div style="text-align:center;padding:32px 0;border-bottom:1px solid #e6ebf1"><h1 style="color:#f97316;font-size:32px;margin:0">${storeName}</h1><p style="color:#64748b;font-size:14px;margin:8px 0 0">${tagline}</p></div><div style="padding:24px 32px"><h2 style="color:#1e293b;font-size:24px;margin:0 0 16px">Your order has shipped</h2><p style="color:#64748b;font-size:16px;line-height:24px;margin:0 0 16px">Hi ${greeting},</p><p style="color:#64748b;font-size:16px;line-height:24px;margin:0">Good news &mdash; order <strong>#${orderNumber}</strong> is on its way.</p></div>${trackingBlock}${trackingButton}${statusButton}${itemsBlock}<div style="text-align:center;padding:32px 32px 0;border-top:1px solid #e6ebf1;margin-top:24px"><p style="color:#64748b;font-size:12px;line-height:16px;margin:0 0 8px">Questions about your delivery? Contact ${supportEmail}.</p><p style="color:#64748b;font-size:12px;line-height:16px;margin:0">Thank you for choosing ${storeName}.</p>${postalFooterHtml()}</div></div></body></html>`;

  const textLines = [
    `${data.store.name}: Your order has shipped`,
    `Hi ${data.customerName || "there"},`,
    `Order #${data.orderNumber} is on its way.`,
    data.shipment.carrierLabel ? `Carrier: ${data.shipment.carrierLabel}` : null,
    data.shipment.trackingNumber ? `Tracking: ${data.shipment.trackingNumber}` : null,
    data.shipment.trackingUrl ? `Track your package: ${data.shipment.trackingUrl}` : null,
    data.orderStatusUrl ? `View your order: ${data.orderStatusUrl}` : null,
    `Questions? Contact ${data.store.supportEmail}.`,
    postalFooterText(),
  ].filter((line): line is string => line !== null);

  return {
    from: data.store.senderEmail,
    to: [data.customerEmail],
    subject: `Your order has shipped! #${singleLine(data.orderNumber)} - ${singleLine(data.store.name)}`,
    html,
    text: textLines.join("\n\n"),
    ...(data.store.replyToEmail ? { replyTo: data.store.replyToEmail } : {}),
  };
}

/**
 * Stable across retries, including retries that mint a fresh expiring guest
 * token or resolve updated runtime copy. A template change must bump the
 * version; explicit operator resends use a separate nonce-bearing key.
 */
export function initialShippingEmailKey(orderId: string): string {
  return `shipping-confirmation/${orderId}/initial/v${SHIPPING_EMAIL_TEMPLATE_VERSION}`;
}

export async function sendShippingConfirmationEmail(
  data: ShippingConfirmationData,
  idempotencyKey: string,
): Promise<ShippingEmailResult> {
  try {
    const result = await sendEmail(prepareShippingEmail(data), { idempotencyKey });
    return {
      success: result.success,
      ...(result.provider ? { provider: result.provider } : {}),
      ...(result.pending ? { pending: true } : {}),
      ...(result.needsReview ? { needsReview: true } : {}),
      ...(result.id ? { providerId: result.id } : {}),
      ...(result.error ? { error: result.error } : {}),
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Shipping email failed",
    };
  }
}

function failureDetails(
  idempotencyKey: string,
  result: ShippingEmailResult,
): Record<string, unknown> {
  return {
    idempotencyKey,
    error: result.error || "Shipping email failed",
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    ...(result.needsReview ? { needsReview: true } : {}),
    ...(result.errorCode === CONCURRENT_EMAIL_SEND_ERROR
      ? { concurrentDuplicate: true }
      : {}),
  };
}

export function isConcurrentShippingEmailAttempt(
  result: ShippingEmailResult,
): boolean {
  return result.errorCode === CONCURRENT_EMAIL_SEND_ERROR;
}

/**
 * Best-effort automatic send. The caller must invoke this only after the
 * shipment transaction has committed; this function never mutates order state.
 */
export async function sendInitialShippingEmail(
  orderId: string,
  actor: Actor,
): Promise<InitialShippingEmailResult> {
  try {
    const order = await getOrderById(orderId);
    if (!order) return { attempted: false, success: false, error: "order_not_found" };
    if (order.status !== "shipped") {
      return { attempted: false, success: false, error: "order_not_shipped" };
    }

    const priorSuccess = await latestOrderEvent(orderId, SUCCESSFUL_SEND_EVENTS);
    if (priorSuccess) {
      return {
        attempted: false,
        success: true,
        idempotent: true,
        eventId: priorSuccess.id,
      };
    }

    const data = await buildShippingConfirmationData(order);
    if (!data) {
      const idempotencyKey = `shipping-confirmation/${orderId}/initial/no-recipient`;
      const eventId = await recordEmailEvent(orderId, "shipping_email_failed", actor, {
        idempotencyKey,
        error: "no_customer_email",
      });
      return {
        attempted: false,
        success: false,
        error: "no_customer_email",
        eventId,
      };
    }

    const idempotencyKey = initialShippingEmailKey(orderId);
    const result = await sendShippingConfirmationEmail(data, idempotencyKey);
    if (!result.success) {
      // The provider has accepted another identical stable-key request that is
      // still in flight. Do not turn that into a false failure event: doing so
      // can invite a nonce-bearing resend while the original send is settling.
      if (isConcurrentShippingEmailAttempt(result)) {
        return { attempted: true, ...result, pending: true, eventId: null };
      }
      recordTelemetry("email.delivery_failed", {
        operation: "send",
        outcome: result.needsReview ? "needs_review" : "failed",
        ...(shippingEmailTelemetryProvider(result.provider)
          ? { provider: shippingEmailTelemetryProvider(result.provider) }
          : {}),
        retryable: !result.needsReview,
        trigger: "request",
      });
      const eventId = await recordEmailEvent(
        orderId,
        "shipping_email_failed",
        actor,
        failureDetails(idempotencyKey, result),
      );
      return { attempted: true, ...result, eventId };
    }

    let eventId: string | null = null;
    try {
      eventId = await recordEmailEvent(orderId, "shipping_email_sent", actor, {
        idempotencyKey,
        ...(result.providerId ? { providerId: result.providerId } : {}),
      });
    } catch (error) {
      recordTelemetry("email.audit_write_failed", {
        operation: "audit_write", outcome: "failed", provider: "d1",
        retryable: true, trigger: "request",
      }, error);
    }
    return { attempted: true, ...result, eventId };
  } catch (error) {
    recordTelemetry("email.delivery_failed", {
      operation: "send", outcome: "failed", retryable: true, trigger: "request",
    }, error);
    return {
      attempted: false,
      success: false,
      error: error instanceof Error ? error.message : "Shipping email failed",
    };
  }
}

export const shippingEmailSuccessfulEventTypes = SUCCESSFUL_SEND_EVENTS;
export const shippingEmailFailureDetails = failureDetails;
