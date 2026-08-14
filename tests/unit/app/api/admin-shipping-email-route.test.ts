import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  getOrderById: vi.fn(),
  latestOrderEvent: vi.fn(),
  recordEmailEvent: vi.fn(),
  buildShippingConfirmationData: vi.fn(),
  initialShippingEmailKey: vi.fn(),
  isConcurrentShippingEmailAttempt: vi.fn(),
  recordTelemetry: vi.fn(),
  sendShippingConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/auth/admin-middleware", () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
}));
vi.mock("@/lib/models/mach/orders", () => ({ getOrderById: mocks.getOrderById }));
vi.mock("@/lib/fulfillment/service", () => ({
  latestOrderEvent: mocks.latestOrderEvent,
  recordEmailEvent: mocks.recordEmailEvent,
}));
vi.mock("@/lib/fulfillment/shipping-email", () => ({
  buildShippingConfirmationData: mocks.buildShippingConfirmationData,
  initialShippingEmailKey: mocks.initialShippingEmailKey,
  isConcurrentShippingEmailAttempt: mocks.isConcurrentShippingEmailAttempt,
  shippingEmailTelemetryProvider: (provider: string | undefined) =>
    provider === "cloudflare" ? "cloudflare_email" : provider,
  sendShippingConfirmationEmail: mocks.sendShippingConfirmationEmail,
  shippingEmailFailureDetails: (key: string, result: Record<string, unknown>) => ({
    idempotencyKey: key,
    error: result.error,
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    ...(result.needsReview ? { needsReview: true } : {}),
    ...(result.errorCode === "concurrent_idempotent_requests"
      ? { concurrentDuplicate: true }
      : {}),
  }),
  shippingEmailSuccessfulEventTypes: ["shipping_email_sent", "shipping_email_resent"],
  SHIPPING_EMAIL_TEMPLATE_VERSION: 1,
}));
vi.mock("@/lib/observability/telemetry", () => ({
  recordTelemetry: mocks.recordTelemetry,
}));

import { GET, POST } from "@/app/api/admin/orders/[id]/shipping-email/route";

const context = { params: Promise.resolve({ id: "ORD-1" }) };
const order = { id: "ORD-1", status: "shipped" };
const data = { orderNumber: "ORD-1", customerEmail: "customer@example.test" };

function request(mode: unknown, body?: string) {
  return new NextRequest("https://shop.example.test/api/admin/orders/ORD-1/shipping-email", {
    method: "POST",
    body: body ?? JSON.stringify({ mode }),
  });
}

function statusRequest() {
  return new NextRequest("https://shop.example.test/api/admin/orders/ORD-1/shipping-email");
}

function sentEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "sent-root",
    event_type: "shipping_email_sent",
    details: { idempotencyKey: "initial-key" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: "admin-1" });
  mocks.getOrderById.mockResolvedValue(order);
  mocks.latestOrderEvent.mockResolvedValue(null);
  mocks.buildShippingConfirmationData.mockResolvedValue(data);
  mocks.initialShippingEmailKey.mockReturnValue("stable-initial-key");
  mocks.isConcurrentShippingEmailAttempt.mockImplementation(
    (result: { errorCode?: string }) => result.errorCode === "concurrent_idempotent_requests",
  );
  mocks.sendShippingConfirmationEmail.mockResolvedValue({
    success: true,
    providerId: "provider-1",
  });
  mocks.recordEmailEvent.mockResolvedValue("event-new");
});

describe("GET /api/admin/orders/[id]/shipping-email", () => {
  it("requires admin authentication before reading order state", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Sign in" });
    const response = await GET(statusRequest(), context);
    expect(response.status).toBe(401);
    expect(mocks.getOrderById).not.toHaveBeenCalled();
    expect(mocks.latestOrderEvent).not.toHaveBeenCalled();
  });

  it("uses separate bounded filtered lookups for lifetime success and latest attempt", async () => {
    mocks.latestOrderEvent
      .mockResolvedValueOnce(sentEvent())
      .mockResolvedValueOnce({
        id: "failure-60",
        event_type: "shipping_email_failed",
        details: { error: " provider timeout " },
      });
    const response = await GET(statusRequest(), context);
    expect(response.status).toBe(200);
    expect(mocks.latestOrderEvent).toHaveBeenNthCalledWith(1, "ORD-1", [
      "shipping_email_sent",
      "shipping_email_resent",
    ]);
    expect(mocks.latestOrderEvent).toHaveBeenNthCalledWith(2, "ORD-1", [
      "shipping_email_sent",
      "shipping_email_failed",
      "shipping_email_resent",
    ]);
    expect(await response.json()).toEqual({
      status: {
        hasSuccessfulSend: true,
        latestAttempt: {
          type: "shipping_email_failed",
          error: "provider timeout",
          needsReview: false,
        },
      },
    });
  });

  it("projects an unresolved accepted-state for the queue UI", async () => {
    mocks.latestOrderEvent
      .mockResolvedValueOnce(sentEvent())
      .mockResolvedValueOnce({
        id: "failure-review",
        event_type: "shipping_email_failed",
        details: { error: "Accepted-state unknown", needsReview: true },
      });

    const response = await GET(statusRequest(), context);
    expect(await response.json()).toMatchObject({
      status: {
        hasSuccessfulSend: true,
        latestAttempt: {
          type: "shipping_email_failed",
          needsReview: true,
        },
      },
    });
  });

  it("returns a no-attempt retry state without reading mixed event history", async () => {
    const response = await GET(statusRequest(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: { hasSuccessfulSend: false, latestAttempt: null },
    });
  });
});

describe("POST /api/admin/orders/[id]/shipping-email", () => {
  it("uses dedicated admin auth before reading the request or order", async () => {
    mocks.checkAdminPermissions.mockResolvedValue({ success: false, error: "Sign in" });
    const response = await POST(request("retry"), context);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized", error: "Sign in" });
    expect(mocks.getOrderById).not.toHaveBeenCalled();
  });

  it("rejects malformed, unknown, and oversized bodies", async () => {
    const malformed = await POST(request(null, "{"), context);
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: "invalid_json" });

    const unknown = await POST(request("send"), context);
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ code: "invalid_mode" });

    const oversized = await POST(request(null, JSON.stringify({ mode: "retry", pad: "x".repeat(1100) })), context);
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ code: "body_too_large" });
    expect(mocks.getOrderById).not.toHaveBeenCalled();
  });

  it("uses bounded success and latest-attempt lookups and the stable key for retry", async () => {
    const response = await POST(request("retry"), context);
    expect(response.status).toBe(200);
    expect(mocks.latestOrderEvent).toHaveBeenCalledWith("ORD-1", [
      "shipping_email_sent",
      "shipping_email_resent",
    ]);
    expect(mocks.latestOrderEvent).toHaveBeenCalledWith("ORD-1", [
      "shipping_email_sent",
      "shipping_email_failed",
      "shipping_email_resent",
    ]);
    expect(mocks.sendShippingConfirmationEmail).toHaveBeenCalledWith(
      data,
      "stable-initial-key",
    );
    expect(mocks.recordEmailEvent).toHaveBeenCalledWith(
      "ORD-1",
      "shipping_email_sent",
      { type: "admin", id: "admin-1" },
      {
        idempotencyKey: "stable-initial-key",
        providerId: "provider-1",
      },
    );
  });

  it("rejects retry after success and resend before success", async () => {
    mocks.latestOrderEvent
      .mockResolvedValueOnce(sentEvent())
      .mockResolvedValueOnce(sentEvent());
    const retry = await POST(request("retry"), context);
    expect(retry.status).toBe(409);
    expect(await retry.json()).toMatchObject({ code: "wrong_mode" });

    mocks.latestOrderEvent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const resend = await POST(request("resend"), context);
    expect(resend.status).toBe(409);
    expect(await resend.json()).toMatchObject({ code: "wrong_mode" });
    expect(mocks.sendShippingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("gives each explicit resend a fresh key and preserves root lineage", async () => {
    mocks.latestOrderEvent.mockResolvedValue(
      sentEvent({
        id: "resend-latest",
        event_type: "shipping_email_resent",
        details: { resendOfEventId: "sent-root" },
      }),
    );
    await POST(request("resend"), context);
    const firstKey = mocks.sendShippingConfirmationEmail.mock.calls[0][1] as string;
    await POST(request("resend"), context);
    const secondKey = mocks.sendShippingConfirmationEmail.mock.calls[1][1] as string;

    expect(firstKey).toMatch(/^shipping-confirmation\/ORD-1\/resend\/v1\//);
    expect(secondKey).not.toBe(firstKey);
    expect(mocks.recordEmailEvent).toHaveBeenCalledWith(
      "ORD-1",
      "shipping_email_resent",
      { type: "admin", id: "admin-1" },
      expect.objectContaining({ resendOfEventId: "sent-root" }),
    );
  });

  it("reports a concurrent stable-key request as pending without a failure event", async () => {
    mocks.sendShippingConfirmationEmail.mockResolvedValue({
      success: false,
      error: "A matching request is still running",
      errorCode: "concurrent_idempotent_requests",
    });
    const response = await POST(request("retry"), context);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      email: {
        success: false,
        pending: true,
        errorCode: "concurrent_idempotent_requests",
      },
      eventId: null,
      auditRecorded: false,
    });
    expect(mocks.recordEmailEvent).not.toHaveBeenCalled();
  });

  it("exposes an indeterminate delivery as needing manual review", async () => {
    mocks.sendShippingConfirmationEmail.mockResolvedValue({
      success: false,
      needsReview: true,
      provider: "cloudflare",
      error: "Accepted-state unknown",
      errorCode: "E_DELIVERY_INDETERMINATE",
    });
    const response = await POST(request("retry"), context);
    expect(await response.json()).toMatchObject({
      email: {
        success: false,
        needsReview: true,
        errorCode: "E_DELIVERY_INDETERMINATE",
      },
    });
    expect(mocks.recordEmailEvent).toHaveBeenCalledWith(
      "ORD-1",
      "shipping_email_failed",
      { type: "admin", id: "admin-1" },
      expect.objectContaining({ needsReview: true }),
    );
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "email.delivery_failed",
      {
        operation: "send",
        outcome: "needs_review",
        provider: "cloudflare_email",
        retryable: false,
        path: "/api/admin/orders/:id/shipping-email",
        trigger: "manual",
      },
    );
  });

  it("blocks a second resend after a successful send has an ambiguous resend", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID");
    const events: Array<ReturnType<typeof sentEvent>> = [sentEvent()];
    mocks.latestOrderEvent.mockImplementation(async (_orderId, types: string[]) =>
      [...events].reverse().find((event) => types.includes(event.event_type)) ?? null,
    );
    mocks.recordEmailEvent.mockImplementation(async (_orderId, type, _actor, details) => {
      events.push({ id: `event-${events.length}`, event_type: type, details });
      return `event-${events.length}`;
    });
    mocks.sendShippingConfirmationEmail.mockResolvedValueOnce({
      success: false,
      needsReview: true,
      error: "Accepted-state unknown",
      errorCode: "E_DELIVERY_INDETERMINATE",
    });

    const ambiguous = await POST(request("resend"), context);
    expect(ambiguous.status).toBe(200);
    expect(await ambiguous.json()).toMatchObject({ email: { needsReview: true } });
    const firstKey = mocks.sendShippingConfirmationEmail.mock.calls[0][1];
    expect(firstKey).toMatch(/^shipping-confirmation\/ORD-1\/resend\/v1\//);

    const blocked = await POST(request("resend"), context);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ code: "shipping_email_needs_review" });
    expect(mocks.sendShippingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendShippingConfirmationEmail.mock.calls.map((call) => call[1]))
      .toEqual([firstKey]);
    expect(uuid).toHaveBeenCalledTimes(1);
    uuid.mockRestore();
  });

  it("blocks a second initial attempt after its accepted-state becomes ambiguous", async () => {
    const events: Array<ReturnType<typeof sentEvent>> = [];
    mocks.latestOrderEvent.mockImplementation(async (_orderId, types: string[]) =>
      [...events].reverse().find((event) => types.includes(event.event_type)) ?? null,
    );
    mocks.recordEmailEvent.mockImplementation(async (_orderId, type, _actor, details) => {
      events.push({ id: `event-${events.length}`, event_type: type, details });
      return `event-${events.length}`;
    });
    mocks.sendShippingConfirmationEmail.mockResolvedValueOnce({
      success: false,
      needsReview: true,
      error: "Accepted-state unknown",
      errorCode: "E_DELIVERY_INDETERMINATE",
    });

    await POST(request("retry"), context);
    const blocked = await POST(request("retry"), context);

    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ code: "shipping_email_needs_review" });
    expect(mocks.initialShippingEmailKey).toHaveBeenCalledTimes(1);
    expect(mocks.sendShippingConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it("reports provider success even if the post-send audit write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.recordEmailEvent.mockRejectedValue(new Error("D1 unavailable"));
    const response = await POST(request("retry"), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      email: { success: true },
      eventId: null,
      auditRecorded: false,
    });
  });
});
