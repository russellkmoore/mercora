import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../components/OrderCard.tsx", import.meta.url), "utf8");

describe("OrderCard shipment boundary", () => {
  it("accepts an allowlisted order type and a shared ShipmentView", () => {
    expect(source).toContain("export type OrderCardOrder = Pick<");
    expect(source).toContain("shipment: ShipmentView");
    expect(source).not.toContain("order.extensions");
  });

  it("renders only shipment values supplied by the safe projection", () => {
    expect(source).toContain("shipment.carrierLabel");
    expect(source).toContain("shipment.trackingNumber");
    expect(source).toContain("href={shipment.trackingUrl}");
    expect(source).not.toContain("extensions.trackingUrl");
    expect(source).not.toContain("tracking_number");
  });

  it("hardens the outbound carrier link and keeps copy store-neutral", () => {
    expect(source).toContain('rel="noreferrer noopener"');
    expect(source).toContain("once your order arrives");
    expect(source).not.toContain("gear arrives");
    expect(source).not.toContain("teas arrive");
  });
});
