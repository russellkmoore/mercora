import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../app/account/orders/page.tsx", import.meta.url), "utf8");
const compatibility = readFileSync(new URL("../../../app/orders/page.tsx", import.meta.url), "utf8");

describe("orders page customer boundary", () => {
  it("checks authentication before loading customer orders", () => {
    expect(source.indexOf("if (!userId)")).toBeGreaterThan(-1);
    expect(source.indexOf("if (!userId)")).toBeLessThan(source.indexOf("getOrdersByCustomer(userId)"));
  });

  it("preserves the legacy route as a query-compatible redirect", () => {
    expect(compatibility).toContain("searchParams");
    expect(compatibility).toContain("/account/orders");
    expect(compatibility).not.toContain("getOrdersBy");
  });

  it("passes an explicit order allowlist to the client component", () => {
    const cardsStart = source.indexOf("const cards = orders.map");
    const renderStart = source.indexOf("return (", cardsStart);
    const boundary = source.slice(cardsStart, renderStart);

    expect(boundary).toContain("satisfies OrderCardOrder");
    expect(source).toContain("const registry = getCarrierRegistry()");
    expect(boundary).toContain("buildShipmentView(order, registry)");
    for (const privateField of [
      "customer_id",
      "shipping_address",
      "billing_address",
      "payment_method",
      "payment_status",
      "notes",
      "extensions",
      "external_references",
    ]) {
      expect(boundary).not.toContain(`${privateField}:`);
    }
  });

  it("renders only the central safe shipment projection", () => {
    expect(source).toContain("<OrderCard key={order.id} order={order} shipment={shipment} />");
    expect(source).not.toContain("<OrderCard key={order.id} order={order} />");
  });
});
