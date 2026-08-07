import type { MachMoney } from "@/lib/money";

export const QUEUE_VIEWS = ["awaiting", "shipped", "cancelled", "all"] as const;
export type QueueView = (typeof QUEUE_VIEWS)[number];

export const QUEUE_VIEW_LABELS: Record<QueueView, string> = {
  awaiting: "Awaiting shipment",
  shipped: "Shipped",
  cancelled: "Cancelled / refunded",
  all: "All",
};

export interface CarrierOption {
  code: string;
  label: string;
  trackingUrlTemplate?: string;
}

export interface ShipmentSubmit {
  carrier: string | null;
  trackingNumber: string | null;
}

const TRACKING_PATTERN = /^[A-Za-z0-9-]{1,100}$/;

/** Validate the exact operator-entered values; shipment data is never normalized. */
export function validateShipmentDraft(
  mode: "ship" | "tracking",
  carrier: string,
  trackingNumber: string,
): string | null {
  if (trackingNumber && !TRACKING_PATTERN.test(trackingNumber)) {
    return "Tracking numbers must be 1–100 ASCII letters, numbers, or hyphens.";
  }
  if (mode === "tracking" && !carrier) return "Choose a carrier.";
  if (mode === "tracking" && !trackingNumber) return "Enter a tracking number.";
  if (Boolean(carrier) !== Boolean(trackingNumber)) {
    return "Carrier and tracking number must be provided together, or both left blank.";
  }
  return null;
}

/** Build the request body without changing any operator-entered shipment data. */
export function shipmentSubmitPayload(
  carrier: string,
  trackingNumber: string,
): ShipmentSubmit {
  return {
    carrier: carrier || null,
    trackingNumber: trackingNumber || null,
  };
}

export interface ShipmentProjection {
  carrier: string | null;
  carrierLabel: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

export interface AdminQueueOrder {
  id: string;
  status: string;
  paymentStatus: string | null;
  totalAmount: MachMoney | null;
  currencyCode: string;
  customer: { name: string; email: string | null };
  itemCount: number;
  createdAt: string | null;
  shipment: ShipmentProjection;
  shippedAt: string | null;
  notes: string | null;
  pricing: {
    checkout_catalog_subtotal?: MachMoney | null;
    checkout_shipping_before_discount?: MachMoney | null;
    checkout_tax?: MachMoney | null;
    checkout_discount?: MachMoney | null;
  };
}

/** Format only a validated decimal-major wire value; malformed API data is inert. */
export function formatQueueMoney(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { amount?: unknown; currency?: unknown };
  if (
    typeof candidate.amount !== "number" ||
    !Number.isFinite(candidate.amount) ||
    typeof candidate.currency !== "string" ||
    !/^[A-Za-z]{3}$/.test(candidate.currency)
  ) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: candidate.currency.toUpperCase(),
    }).format(candidate.amount);
  } catch {
    return null;
  }
}

export interface FulfillmentEvent {
  id: string;
  type: string;
  actorType?: string | null;
  actorId?: string | null;
  actorLabel?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export type EmailMode = "retry" | "resend";
export interface ShippingEmailStatus {
  hasSuccessfulSend: boolean;
  latestAttempt: {
    type: "shipping_email_sent" | "shipping_email_failed" | "shipping_email_resent";
    error: string | null;
  } | null;
}

export interface EmailState {
  tone: "success" | "error" | "muted";
  mode: EmailMode;
  label: string;
  message: string;
}

export function deriveEmailState(status: ShippingEmailStatus): EmailState {
  const mode: EmailMode = status.hasSuccessfulSend ? "resend" : "retry";
  if (!status.latestAttempt) {
    return { tone: "muted", mode, label: "Send email", message: "No shipping email sent yet" };
  }
  if (status.latestAttempt.type === "shipping_email_failed") {
    const error = status.latestAttempt.error ? `: ${status.latestAttempt.error}` : "";
    return {
      tone: "error",
      mode,
      label: mode === "resend" ? "Retry resend" : "Retry email",
      message: `Shipping email failed${error}`,
    };
  }
  return { tone: "success", mode: "resend", label: "Resend email", message: "Shipping email sent" };
}

export function buildQueueQuery(params: {
  view: QueueView;
  query: string;
  limit: number;
  offset: number;
}): string {
  const search = new URLSearchParams({
    view: params.view,
    limit: String(params.limit),
    offset: String(params.offset),
  });
  const query = params.query.trim();
  if (query) search.set("q", query);
  return search.toString();
}

export function clampOffsetAfterRemoval(offset: number, pageSize: number, totalAfter: number): number {
  if (totalAfter <= 0) return 0;
  return Math.min(offset, Math.floor((totalAfter - 1) / pageSize) * pageSize);
}

/** Abort the superseded fetch and still guard state writes if a runtime ignores abort. */
export function createRequestGate() {
  let generation = 0;
  let controller: AbortController | null = null;
  return {
    start() {
      controller?.abort();
      controller = new AbortController();
      const current = ++generation;
      return {
        signal: controller.signal,
        isCurrent: () => current === generation && !controller?.signal.aborted,
      };
    },
    abort() {
      controller?.abort();
      generation += 1;
    },
  };
}

export function trackingPreview(option: CarrierOption | null, trackingNumber: string): string | null {
  const tracking = trackingNumber.trim();
  if (!option?.trackingUrlTemplate || !tracking) return null;
  const candidate = option.trackingUrlTemplate.replace(
    "{trackingNumber}",
    encodeURIComponent(tracking),
  );
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mergeShipmentResult(
  order: AdminQueueOrder,
  result: { order?: { status?: string }; tracking?: ShipmentProjection },
): AdminQueueOrder {
  return {
    ...order,
    status: result.order?.status ?? order.status,
    shipment: result.tracking ?? order.shipment,
    shippedAt:
      result.order?.status === "shipped" && !order.shippedAt
        ? new Date().toISOString()
        : order.shippedAt,
  };
}

export interface TimelineEntry {
  id: string;
  title: string;
  details: string[];
  actor: string;
  timestamp: string;
  tone: "info" | "success" | "error";
}

function actorLabel(event: FulfillmentEvent): string {
  const kind = event.actorType === "admin"
    ? "Admin"
    : event.actorType === "service"
      ? "Service token"
      : event.actorType === "system"
        ? "System"
        : "Unknown actor";
  if (event.actorLabel?.trim()) return `${kind} (${event.actorLabel.trim()})`;
  const id = event.actorId?.trim();
  return id ? `${kind} (${id.length > 12 ? `…${id.slice(-6)}` : id})` : kind;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function formatTimeline(events: FulfillmentEvent[]): TimelineEntry[] {
  return events.map((event) => {
    const payload = event.details ?? {};
    const details: string[] = [];
    let title = "Fulfillment update";
    let tone: TimelineEntry["tone"] = "info";
    if (event.type === "shipment_created") {
      title = "Marked shipped";
      tone = "success";
      details.push(`Carrier: ${text(payload.carrier, "not recorded")}`);
      details.push(`Tracking: ${text(payload.trackingNumber, "none")}`);
      if (event.fromStatus && event.toStatus) details.push(`Status: ${event.fromStatus} → ${event.toStatus}`);
    } else if (event.type === "tracking_updated") {
      title = "Tracking updated";
      const previous = payload.previous && typeof payload.previous === "object"
        ? payload.previous as Record<string, unknown>
        : {};
      const next = payload.next && typeof payload.next === "object"
        ? payload.next as Record<string, unknown>
        : {};
      details.push(`Carrier: ${text(previous.carrier, "none")} → ${text(next.carrier, "none")}`);
      details.push(`Tracking: ${text(previous.trackingNumber, "none")} → ${text(next.trackingNumber, "none")}`);
    } else if (event.type === "shipping_email_failed") {
      title = "Shipping email failed";
      tone = "error";
      if (typeof payload.error === "string" && payload.error.trim()) details.push(`Error: ${payload.error.trim()}`);
    } else if (event.type === "shipping_email_resent") {
      title = "Shipping email resent";
      tone = "success";
    } else if (event.type === "shipping_email_sent") {
      title = "Shipping email sent";
      tone = "success";
    }
    return { id: event.id, title, details, actor: actorLabel(event), timestamp: event.createdAt, tone };
  });
}
