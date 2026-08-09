import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { getOrderStatus } from "@/lib/mcp/tools/order";
import { applyTestMigrations } from "../../helpers/d1";

vi.mock("@opennextjs/cloudflare", async () => {
  const { env: testEnv } = await import("cloudflare:workers");
  return { getCloudflareContext: async () => ({ env: testEnv }) };
});

const ORDER_ID = "MCP-INTEGRATION-1-ABCDEF12";

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(ORDER_ID).run();
  await env.DB.prepare(`
    INSERT INTO orders (
      id, status, total_amount, currency_code, shipping_address, items,
      shipping_method, payment_status, extensions, shipping_carrier,
      tracking_number, shipped_at, created_at, updated_at
    ) VALUES (?, 'shipped', ?, 'USD', ?, '[]', 'standard', 'paid', ?, 'ups', ?, ?, ?, ?)
  `).bind(
    ORDER_ID,
    JSON.stringify({ amount: 2_500, currency: "USD" }),
    JSON.stringify({ line1: "1 Main", city: "Denver", region: "CO", country: "US" }),
    JSON.stringify({ agent_id: "agent-owner" }),
    "1Z999",
    "2026-08-02T00:00:00.000Z",
    "2026-08-01T00:00:00.000Z",
    "2026-08-03T00:00:00.000Z",
  ).run();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO order_events (
        id, order_id, event_type, actor_type, actor_id,
        from_status, to_status, details, created_at
      ) VALUES (?, ?, 'shipment_created', 'admin', 'private-admin',
        'processing', 'shipped', ?, ?)
    `).bind(
      "mcp-track-ship",
      ORDER_ID,
      JSON.stringify({ carrier: "ups", trackingUrl: "https://stored.example/private" }),
      "2026-08-02T00:00:00.000Z",
    ),
    env.DB.prepare(`
      INSERT INTO order_events (
        id, order_id, event_type, actor_type, actor_id, details, created_at
      ) VALUES (?, ?, 'tracking_updated', 'admin', 'private-admin', ?, ?)
    `).bind(
      "mcp-track-update",
      ORDER_ID,
      JSON.stringify({ next: { trackingNumber: "private-event-value" } }),
      "2026-08-03T00:00:00.000Z",
    ),
    env.DB.prepare(`
      INSERT INTO order_events (
        id, order_id, event_type, actor_type, actor_id, details, created_at
      ) VALUES (?, ?, 'shipping_email_sent', 'system', NULL, ?, ?)
    `).bind("mcp-track-email", ORDER_ID, JSON.stringify({ providerId: "private" }), "2026-08-04T00:00:00.000Z"),
  ]);
});

describe("MCP fulfillment tracking in real D1", () => {
  it("returns the owner a configured shipment and scalar event history", async () => {
    const result = await getOrderStatus(ORDER_ID, "agent-owner");

    expect(result.success).toBe(true);
    expect(result.data.shipment).toMatchObject({
      carrier: "ups",
      carrier_label: "UPS",
      tracking_number: "1Z999",
    });
    expect(result.data.shipment?.tracking_url).toContain("ups.com");
    expect(result.data.tracking_history?.map(({ status }) => status)).toEqual([
      "order_confirmed",
      "shipped",
      "tracking_updated",
    ]);
    expect(JSON.stringify(result.data)).not.toContain("private-admin");
    expect(JSON.stringify(result.data)).not.toContain("providerId");
    expect(JSON.stringify(result.data)).not.toContain("stored.example");
    expect(JSON.stringify(result.data)).not.toContain("private-event-value");
  });

  it("keeps missing and differently owned orders indistinguishable", async () => {
    const notOwned = await getOrderStatus(ORDER_ID, "attacker");
    const missing = await getOrderStatus("MCP-MISSING-1-ABCDEF12", "attacker");
    expect(notOwned.error).toEqual(missing.error);
    expect(notOwned.data).toEqual(missing.data);
  });
});
