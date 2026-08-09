import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildQueueQuery,
  clampOffsetAfterRemoval,
  createPerKeyGate,
  createRequestGate,
  deriveEmailState,
  formatQueueMoney,
  formatTimeline,
  shipmentSubmitPayload,
  trackingPreview,
  validateShipmentDraft,
} from "@/app/admin/orders/queue-model";

describe("admin fulfillment queue model", () => {
  it("builds server-side view/search/pagination queries", () => {
    expect(buildQueueQuery({ view: "shipped", query: "  Ada  ", limit: 20, offset: 40 }))
      .toBe("view=shipped&limit=20&offset=40&q=Ada");
  });

  it("aborts and invalidates a superseded list request", () => {
    const gate = createRequestGate();
    const first = gate.start();
    const second = gate.start();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.isCurrent()).toBe(true);
    gate.abort();
    expect(second.signal.aborted).toBe(true);
    expect(second.isCurrent()).toBe(false);
  });

  it("keeps independent per-order actions locked until each one finishes", () => {
    const gate = createPerKeyGate();
    expect(gate.start("order-a")).toBe(true);
    expect(gate.start("order-b")).toBe(true);
    expect(gate.start("order-a")).toBe(false);
    expect([...gate.snapshot()].sort()).toEqual(["order-a", "order-b"]);

    gate.finish("order-b");
    expect(gate.start("order-a")).toBe(false);
    expect([...gate.snapshot()]).toEqual(["order-a"]);

    gate.finish("order-a");
    expect(gate.start("order-a")).toBe(true);
  });

  it("moves backward after shipping the last row on a page", () => {
    expect(clampOffsetAfterRemoval(20, 20, 20)).toBe(0);
    expect(clampOffsetAfterRemoval(40, 20, 21)).toBe(20);
    expect(clampOffsetAfterRemoval(0, 20, 0)).toBe(0);
  });

  it("derives retry versus resend from the authoritative server projection", () => {
    expect(deriveEmailState({ hasSuccessfulSend: false, latestAttempt: null }))
      .toMatchObject({ mode: "retry", label: "Send email" });
    expect(deriveEmailState({
      hasSuccessfulSend: false,
      latestAttempt: { type: "shipping_email_failed", error: null },
    }))
      .toMatchObject({ mode: "retry", tone: "error" });
    expect(deriveEmailState({
      hasSuccessfulSend: true,
      latestAttempt: { type: "shipping_email_failed", error: "provider timeout" },
    })).toMatchObject({ mode: "resend", label: "Retry resend", tone: "error" });
  });

  it("formats valid fractional wire money and rejects null or malformed values", () => {
    expect(formatQueueMoney({ amount: 12.5, currency: "usd", precision: 2 })).toBe("$12.50");
    expect(formatQueueMoney(null)).toBeNull();
    expect(formatQueueMoney({ amount: "12.5", currency: "USD" })).toBeNull();
    expect(formatQueueMoney({ amount: Number.NaN, currency: "USD" })).toBeNull();
    expect(formatQueueMoney({ amount: 12.5, currency: "not-a-currency" })).toBeNull();
  });

  it("builds previews only from HTTPS server-projected templates", () => {
    expect(trackingPreview({
      code: "configured",
      label: "Configured",
      trackingUrlTemplate: "https://carrier.example/track/{trackingNumber}",
    }, "A-B")).toBe("https://carrier.example/track/A-B");
    expect(trackingPreview({
      code: "bad",
      label: "Bad",
      trackingUrlTemplate: "javascript:alert('{trackingNumber}')",
    }, "123")).toBeNull();
  });

  it("rejects surrounding tracking whitespace instead of normalizing it", () => {
    expect(validateShipmentDraft("ship", "ups", " 1Z999 "))
      .toBe("Tracking numbers must be 1–100 ASCII letters, numbers, or hyphens.");
    expect(validateShipmentDraft("ship", "ups", "A".repeat(101)))
      .toBe("Tracking numbers must be 1–100 ASCII letters, numbers, or hyphens.");
    expect(validateShipmentDraft("ship", "ups", "1Z999")).toBeNull();
  });

  it("submits the exact validated tracking number", () => {
    expect(shipmentSubmitPayload("ups", "1Z999"))
      .toEqual({ carrier: "ups", trackingNumber: "1Z999" });
    expect(shipmentSubmitPayload("", ""))
      .toEqual({ carrier: null, trackingNumber: null });
  });

  it("formats only allowlisted event details, never opaque tracking URLs", () => {
    const [entry] = formatTimeline([{
      id: "evt",
      type: "shipment_created",
      actorType: "admin",
      actorId: "user_a_very_long_identifier",
      fromStatus: "processing",
      toStatus: "shipped",
      details: { carrier: "ups", trackingNumber: "1Z", trackingUrl: "https://secret.example" },
      createdAt: "2026-08-01T00:00:00.000Z",
    }]);
    expect(entry.title).toBe("Marked shipped");
    expect(entry.details.join(" ")).toContain("1Z");
    expect(entry.details.join(" ")).not.toContain("secret.example");
    expect(entry.actor).toContain("…");
  });
});

describe("admin queue client source contract", () => {
  const source = readFileSync("app/admin/orders/OrdersQueueClient.tsx", "utf8");
  it("uses abort signals and a request-generation guard", () => {
    expect(source).toContain("signal: request.signal");
    expect(source).toContain("request.isCurrent()");
  });
  it("does not inspect order extensions or build links from tracking numbers", () => {
    expect(source).not.toContain(".extensions");
    expect(source).not.toContain("generateTrackingUrl");
    expect(source).toContain("order.shipment.trackingUrl");
  });
  it("loads authoritative email status instead of inferring it from mixed events", () => {
    expect(source).toContain("/shipping-email`");
    expect(source).not.toContain("/events?limit=50");
    expect(source).toContain("deriveEmailState(emailStatus)");
  });
  it("uses a synchronous per-order gate for overlapping email actions", () => {
    expect(source).toContain("createPerKeyGate()");
    expect(source).toContain("emailBusy.has(order.id)");
    expect(source).not.toContain("emailBusy === order.id");
  });
  it("renders explicit fallbacks for unavailable and omitted checkout money", () => {
    expect(source).toContain('formatQueueMoney(order.totalAmount) ?? "Unavailable"');
    expect(source).toContain("No stored checkout breakdown.");
    expect(source).not.toContain("Money.fromStored");
  });
  it("bounds fulfillment timeline reads", () => {
    const detail = readFileSync("app/admin/orders/[id]/page.tsx", "utf8");
    expect(detail).toContain("/events?limit=100");
  });
  it("keeps modal tracking validation aligned with the server allowlist", () => {
    const modal = readFileSync("app/admin/orders/ShipmentModal.tsx", "utf8");
    expect(modal).toContain("validateShipmentDraft(mode, carrier, tracking)");
    expect(modal).toContain("shipmentSubmitPayload(carrier, tracking)");
    expect(modal).not.toContain("tracking.trim()");
    expect(modal).not.toContain("maxLength={100}");
    expect(modal).toContain('rel="noreferrer noopener"');
  });
});
