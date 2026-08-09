import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { shipOrder, updateTracking } from "@/lib/fulfillment/service";
import { applyTestMigrations } from "../../helpers/d1";

vi.mock("@opennextjs/cloudflare", async () => {
  const { env: testEnv } = await import("cloudflare:workers");
  return { getCloudflareContext: async () => ({ env: testEnv }) };
});

const actor = { type: "admin", id: "user_test" } as const;

async function insertOrder(
  id: string,
  options: {
    status?: string;
    paymentStatus?: string;
    extensions?: unknown;
    carrier?: string | null;
    tracking?: string | null;
  } = {},
) {
  const now = "2026-08-06T12:00:00.000Z";
  await env.DB.prepare(`
    INSERT INTO orders (
      id, status, total_amount, currency_code, items, payment_status,
      extensions, shipping_carrier, tracking_number, shipped_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'USD', '[]', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    options.status ?? "processing",
    JSON.stringify({ amount: 2500, currency: "USD" }),
    options.paymentStatus ?? "paid",
    options.extensions === undefined ? null : JSON.stringify(options.extensions),
    options.carrier ?? null,
    options.tracking ?? null,
    (options.status ?? "processing") === "shipped" ? now : null,
    now,
    now,
  ).run();
}

async function eventsFor(orderId: string) {
  return env.DB.prepare(`
    SELECT event_type, details FROM order_events WHERE order_id = ? ORDER BY created_at, id
  `).bind(orderId).all<{ event_type: string; details: string }>();
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare("DELETE FROM orders WHERE id LIKE 'U13-CAS-%'").run();
});

describe("shipment CAS", () => {
  it("ships once and turns the identical retry into an idempotent read", async () => {
    await insertOrder("U13-CAS-IDEMPOTENT");
    const input = { carrier: "ups", trackingNumber: "1Z999AA10123456784" } as const;

    const first = await shipOrder("U13-CAS-IDEMPOTENT", input, actor);
    const retry = await shipOrder("U13-CAS-IDEMPOTENT", input, actor);

    expect(first.outcome).toBe("shipped");
    expect(retry.outcome).toBe("already_shipped");
    const events = await eventsFor("U13-CAS-IDEMPOTENT");
    expect(events.results.map((event) => event.event_type)).toEqual(["shipment_created"]);
  });

  it("reports a conflicting retry without a phantom event", async () => {
    await insertOrder("U13-CAS-CONFLICT");
    await shipOrder(
      "U13-CAS-CONFLICT",
      { carrier: "ups", trackingNumber: "1Z111" },
      actor,
    );
    const conflict = await shipOrder(
      "U13-CAS-CONFLICT",
      { carrier: "fedex", trackingNumber: "222222" },
      actor,
    );

    expect(conflict.outcome).toBe("conflict");
    expect((await eventsFor("U13-CAS-CONFLICT")).results).toHaveLength(1);
  });

  it("allows one of two competing shipment batches to win without a phantom event", async () => {
    await insertOrder("U13-CAS-RACE");

    const results = await Promise.all([
      shipOrder(
        "U13-CAS-RACE",
        { carrier: "ups", trackingNumber: "1ZRACEA" },
        actor,
      ),
      shipOrder(
        "U13-CAS-RACE",
        { carrier: "fedex", trackingNumber: "222RACEB" },
        actor,
      ),
    ]);

    expect(results.map(({ outcome }) => outcome).sort()).toEqual(["conflict", "shipped"]);
    const events = (await eventsFor("U13-CAS-RACE")).results;
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("shipment_created");
  });

  it.each(["pending", "requires_action"])(
    "blocks a %s refund inside the atomic update",
    async (refundStatus) => {
      const id = `U13-CAS-REFUND-${refundStatus}`;
      await insertOrder(id, { extensions: { refunds: [{ status: refundStatus }] } });

      const result = await shipOrder(
        id,
        { carrier: "ups", trackingNumber: "1Z123" },
        actor,
      );

      expect(result).toMatchObject({ outcome: "not_fulfillable", refundPending: true });
      const row = await env.DB.prepare(
        "SELECT status, shipped_at FROM orders WHERE id = ?",
      ).bind(id).first<{ status: string; shipped_at: string | null }>();
      expect(row).toEqual({ status: "processing", shipped_at: null });
      expect((await eventsFor(id)).results).toEqual([]);
    },
  );

  it("requires processing + paid", async () => {
    await insertOrder("U13-CAS-UNPAID", { paymentStatus: "pending" });
    const result = await shipOrder(
      "U13-CAS-UNPAID",
      { carrier: null, trackingNumber: null },
      actor,
    );
    expect(result).toMatchObject({
      outcome: "not_fulfillable",
      status: "processing",
      paymentStatus: "pending",
    });
  });
});

describe("tracking value-CAS", () => {
  it("updates the full pair and records the observed previous pair", async () => {
    await insertOrder("U13-CAS-TRACK", {
      status: "shipped",
      carrier: "ups",
      tracking: "1ZOLD",
    });
    const result = await updateTracking(
      "U13-CAS-TRACK",
      { carrier: "fedex", trackingNumber: "222222" },
      actor,
    );

    expect(result.outcome).toBe("updated");
    const [event] = (await eventsFor("U13-CAS-TRACK")).results;
    expect(event.event_type).toBe("tracking_updated");
    expect(JSON.parse(event.details)).toEqual({
      previous: { carrier: "ups", trackingNumber: "1ZOLD" },
      next: { carrier: "fedex", trackingNumber: "222222" },
    });
  });

  it("allows one of two competing tracking corrections to win", async () => {
    await insertOrder("U13-CAS-TRACK-RACE", {
      status: "shipped",
      carrier: "ups",
      tracking: "1ZOLD",
    });

    const results = await Promise.all([
      updateTracking(
        "U13-CAS-TRACK-RACE",
        { carrier: "fedex", trackingNumber: "222RACEA" },
        actor,
      ),
      updateTracking(
        "U13-CAS-TRACK-RACE",
        { carrier: "usps", trackingNumber: "9400RACEB" },
        actor,
      ),
    ]);

    expect(results.map(({ outcome }) => outcome).sort()).toEqual(["conflict", "updated"]);
    const events = (await eventsFor("U13-CAS-TRACK-RACE")).results;
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("tracking_updated");
  });

  it("treats concurrent same-value corrections as idempotent without phantom events", async () => {
    await insertOrder("U13-CAS-TRACK-NOOP", {
      status: "shipped",
      carrier: "ups",
      tracking: "1ZSAME",
    });

    const results = await Promise.all([
      updateTracking(
        "U13-CAS-TRACK-NOOP",
        { carrier: "ups", trackingNumber: "1ZSAME" },
        actor,
      ),
      updateTracking(
        "U13-CAS-TRACK-NOOP",
        { carrier: "ups", trackingNumber: "1ZSAME" },
        actor,
      ),
    ]);

    expect(results.map(({ outcome }) => outcome)).toEqual(["unchanged", "unchanged"]);
    expect((await eventsFor("U13-CAS-TRACK-NOOP")).results).toEqual([]);
  });

  it("rejects tracking writes before shipment", async () => {
    await insertOrder("U13-CAS-NOT-SHIPPED");
    const result = await updateTracking(
      "U13-CAS-NOT-SHIPPED",
      { carrier: "ups", trackingNumber: "1Z123" },
      actor,
    );
    expect(result).toEqual({ outcome: "not_shipped", status: "processing" });
  });
});
