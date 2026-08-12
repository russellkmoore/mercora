import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getOrderById: vi.fn(),
  latestOrderEvent: vi.fn(),
  recordEmailEvent: vi.fn(),
  getStoreConfig: vi.fn(),
  recordTelemetry: vi.fn(),
}));

vi.mock("@/lib/email/sender", () => ({ sendEmail: mocks.send }));
vi.mock("@/lib/models/mach/orders", () => ({ getOrderById: mocks.getOrderById }));
vi.mock("@/lib/fulfillment/service", () => ({
  latestOrderEvent: mocks.latestOrderEvent,
  recordEmailEvent: mocks.recordEmailEvent,
}));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.getStoreConfig }));
vi.mock("@/lib/observability/telemetry", () => ({
  recordTelemetry: mocks.recordTelemetry,
}));

import {
  buildShippingConfirmationData,
  initialShippingEmailKey,
  sendInitialShippingEmail,
  SHIPPING_EMAIL_TEMPLATE_VERSION,
} from "@/lib/fulfillment/shipping-email";
import type { Actor } from "@/lib/fulfillment/types";
import type { Order } from "@/lib/types/order";

const actor: Actor = { type: "admin", id: "admin-1" };

function store(name = "Example Store") {
  return {
    identity: { name, tagline: "Useful things" },
    contact: {
      senderEmail: `${name} <orders@example.test>`,
      supportEmail: "help@example.test",
    },
    urls: { site: "https://shop.example.test" },
    commerce: {
      carriers: [
        {
          code: "ups",
          label: "UPS",
          legacyAliases: ["ups"],
          trackingUrlTemplate:
            "https://www.ups.com/track?loc=en_US&tracknum={trackingNumber}",
        },
        { code: "other", label: "Other", legacyAliases: [] },
      ],
    },
  };
}

function shippedOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ORD-1",
    status: "shipped",
    payment_status: "paid",
    currency_code: "USD",
    total_amount: { amount: 2500, currency: "USD" },
    items: [
      {
        product_id: "product-1",
        sku: "SKU-1",
        quantity: 2,
        unit_price: { amount: 1250, currency: "USD" },
        total_price: { amount: 2500, currency: "USD" },
        product_name: "Travel mug",
      },
    ],
    shipping_address: {
      line1: "1 Main Street",
      city: "Denver",
      country: "US",
      recipient: "Ada Lovelace",
      email: "ADA@EXAMPLE.TEST",
    },
    extensions: {},
    shipping_carrier: "ups",
    tracking_number: "1Z999AA10123456784",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStoreConfig.mockReturnValue(store());
  mocks.getOrderById.mockResolvedValue(shippedOrder());
  mocks.latestOrderEvent.mockResolvedValue(null);
  mocks.recordEmailEvent.mockResolvedValue("event-1");
  mocks.send.mockResolvedValue({ success: true, id: "provider-1", provider: "resend" });
  delete process.env.ORDER_STATUS_SECRET;
});

describe("shipping confirmation payload", () => {
  it("resolves store configuration at call time and uses only the safe shipment view", async () => {
    const first = await buildShippingConfirmationData(shippedOrder());
    mocks.getStoreConfig.mockReturnValue(store("Second Store"));
    const second = await buildShippingConfirmationData(shippedOrder());

    expect(first).toMatchObject({
      customerEmail: "ada@example.test",
      store: { name: "Example Store", siteUrl: "https://shop.example.test" },
      shipment: {
        carrier: "ups",
        carrierLabel: "UPS",
        trackingNumber: "1Z999AA10123456784",
      },
    });
    expect(first?.shipment.trackingUrl).toContain("ups.com");
    expect(second?.store.name).toBe("Second Store");
    expect(mocks.getStoreConfig).toHaveBeenCalledTimes(4);
  });

  it("uses configured carriers for the customer-safe projection", async () => {
    const custom = store();
    custom.commerce.carriers = [
      {
        code: "local",
        label: "Local Courier",
        legacyAliases: ["local"],
        trackingUrlTemplate: "https://tracking.example.test/{trackingNumber}",
      },
    ];
    mocks.getStoreConfig.mockReturnValue(custom);
    const data = await buildShippingConfirmationData(
      shippedOrder({ shipping_carrier: "local", tracking_number: "LOCAL-123" }),
    );
    expect(data?.shipment).toEqual({
      carrier: "local",
      carrierLabel: "Local Courier",
      trackingNumber: "LOCAL-123",
      trackingUrl: "https://tracking.example.test/LOCAL-123",
    });
  });

  it("links registered customers to the existing order history route", async () => {
    const data = await buildShippingConfirmationData(
      shippedOrder({ customer_id: "customer-1" }),
    );
    expect(data?.orderStatusUrl).toBe("https://shop.example.test/orders");
  });

  it("returns no payload when the persisted order has no recipient email", async () => {
    const data = await buildShippingConfirmationData(
      shippedOrder({ extensions: {}, shipping_address: undefined }),
    );
    expect(data).toBeNull();
  });
});

describe("shipping email idempotency and delivery", () => {
  it("uses a stable versioned key for the exact provider payload", async () => {
    const data = await buildShippingConfirmationData(shippedOrder());
    expect(data).not.toBeNull();
    const first = initialShippingEmailKey("ORD-1");
    const second = initialShippingEmailKey("ORD-1");
    expect(first).toBe(second);
    expect(first).toBe(
      `shipping-confirmation/ORD-1/initial/v${SHIPPING_EMAIL_TEMPLATE_VERSION}`,
    );
  });

  it("keeps the key stable across separately issued guest status tokens", async () => {
    process.env.ORDER_STATUS_SECRET = "unit-test-order-status-secret-0123456789";
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1_800_000_000_000)
      .mockReturnValueOnce(1_800_000_010_000);
    const firstData = await buildShippingConfirmationData(shippedOrder());
    const secondData = await buildShippingConfirmationData(shippedOrder());
    clock.mockRestore();

    expect(firstData?.orderStatusUrl).not.toBe(secondData?.orderStatusUrl);
    expect(firstData).not.toBeNull();
    expect(secondData).not.toBeNull();
    expect(initialShippingEmailKey("ORD-1")).toBe(initialShippingEmailKey("ORD-1"));
  });

  it("sends escaped HTML and text with a deterministic key, then records success", async () => {
    mocks.getOrderById.mockResolvedValue(
      shippedOrder({
        shipping_address: {
          line1: "1 Main Street",
          city: "Denver",
          country: "US",
          recipient: '<script>alert("x")</script>',
          email: "customer@example.test",
        },
        items: [
          {
            product_id: "p1",
            sku: "S1",
            quantity: 1,
            unit_price: { amount: 100, currency: "USD" },
            total_price: { amount: 100, currency: "USD" },
            product_name: '<img src=x onerror="alert(1)">',
          },
        ],
      }),
    );

    const result = await sendInitialShippingEmail("ORD-1", actor);

    expect(result).toMatchObject({ attempted: true, success: true, eventId: "event-1" });
    const [message, options] = mocks.send.mock.calls[0];
    expect(message.from).toBe("Example Store <orders@example.test>");
    expect(message.to).toEqual(["customer@example.test"]);
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(message.html).not.toContain('<script>alert("x")</script>');
    expect(message.text).toContain("Your order has shipped");
    expect(options.idempotencyKey).toBe("shipping-confirmation/ORD-1/initial/v1");
    expect(mocks.recordEmailEvent).toHaveBeenCalledWith(
      "ORD-1",
      "shipping_email_sent",
      actor,
      { idempotencyKey: options.idempotencyKey, providerId: "provider-1" },
    );
  });

  it("does not send again after any recorded successful send", async () => {
    mocks.latestOrderEvent.mockResolvedValue({ id: "event-success" });
    const result = await sendInitialShippingEmail("ORD-1", actor);
    expect(result).toMatchObject({
      attempted: false,
      success: true,
      idempotent: true,
      eventId: "event-success",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("treats a concurrent stable-key attempt as pending without recording a failure", async () => {
    mocks.send.mockResolvedValue({
      success: false,
      pending: true,
      errorCode: "concurrent_idempotent_requests",
      error: "A matching request is still running",
    });
    const result = await sendInitialShippingEmail("ORD-1", actor);
    expect(result).toMatchObject({
      attempted: true,
      success: false,
      pending: true,
      errorCode: "concurrent_idempotent_requests",
      eventId: null,
    });
    expect(mocks.recordEmailEvent).not.toHaveBeenCalled();
  });

  it("records an indeterminate provider outcome as requiring manual review", async () => {
    mocks.send.mockResolvedValue({
      success: false,
      needsReview: true,
      errorCode: "E_DELIVERY_INDETERMINATE",
      error: "Accepted-state unknown",
    });
    const result = await sendInitialShippingEmail("ORD-1", actor);
    expect(result).toMatchObject({
      attempted: true,
      success: false,
      needsReview: true,
      errorCode: "E_DELIVERY_INDETERMINATE",
    });
    expect(mocks.recordEmailEvent).toHaveBeenCalledWith(
      "ORD-1",
      "shipping_email_failed",
      actor,
      expect.objectContaining({ needsReview: true }),
    );
  });

  it("gives concurrent initial attempts one key and never reports two provider successes", async () => {
    let arrivals = 0;
    let release!: () => void;
    const bothArrived = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.send.mockImplementation(async () => {
      arrivals += 1;
      const position = arrivals;
      if (arrivals === 2) release();
      await bothArrived;
      return position === 1
        ? { success: true, id: "provider-1", provider: "resend" }
        : {
            success: false,
            pending: true,
            errorCode: "concurrent_idempotent_requests",
            error: "A matching request is still running",
          };
    });

    const results = await Promise.all([
      sendInitialShippingEmail("ORD-1", actor),
      sendInitialShippingEmail("ORD-1", actor),
    ]);

    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][1].idempotencyKey).toBe(
      mocks.send.mock.calls[1][1].idempotencyKey,
    );
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => result.pending)).toHaveLength(1);
    expect(mocks.recordEmailEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordEmailEvent).toHaveBeenCalledWith(
      "ORD-1",
      "shipping_email_sent",
      actor,
      expect.any(Object),
    );
  });

  it("never mutates shipment state or throws when transport fails", async () => {
    mocks.send.mockRejectedValue(new Error("network down"));
    await expect(sendInitialShippingEmail("ORD-1", actor)).resolves.toMatchObject({
      attempted: true,
      success: false,
      error: "network down",
    });
    expect(mocks.recordEmailEvent).toHaveBeenCalledWith(
      "ORD-1",
      "shipping_email_failed",
      actor,
      expect.objectContaining({ error: "network down" }),
    );
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "email.delivery_failed",
      {
        operation: "send", outcome: "failed", provider: "resend",
        retryable: true, trigger: "request",
      },
    );
  });

  it("reports an audit failure without turning provider success into delivery failure", async () => {
    const auditError = new Error("D1 audit unavailable");
    mocks.recordEmailEvent.mockRejectedValue(auditError);

    const result = await sendInitialShippingEmail("ORD-1", actor);

    expect(result).toMatchObject({ attempted: true, success: true, eventId: null });
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "email.audit_write_failed",
      {
        operation: "audit_write", outcome: "failed", provider: "d1",
        retryable: true, trigger: "request",
      },
      auditError,
    );
    expect(mocks.recordTelemetry).not.toHaveBeenCalledWith(
      "email.delivery_failed",
      expect.anything(),
      expect.anything(),
    );
  });
});
