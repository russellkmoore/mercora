import { describe, expect, it } from "vitest";
import { buildShipmentView } from "@/lib/fulfillment/shipment-view";
import { MAX_TRACKING_LENGTH } from "@/lib/fulfillment/tracking";

describe("buildShipmentView", () => {
  it("derives carrier-owned URLs from server columns", () => {
    expect(buildShipmentView({
      shipping_carrier: "ups",
      tracking_number: "1Z999AA10123456784",
    })).toEqual({
      carrier: "ups",
      carrierLabel: "UPS",
      trackingNumber: "1Z999AA10123456784",
      trackingUrl: "https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784",
    });
  });

  it("never reads a stored extension URL and does not link unknown carriers", () => {
    const view = buildShipmentView({
      shipping_carrier: "Unknown Express",
      tracking_number: "SAFE-123",
      extensions: { trackingUrl: "https://attacker.example" },
    } as Parameters<typeof buildShipmentView>[0] & { extensions: unknown });
    expect(view.carrier).toBe("other");
    expect(view.trackingNumber).toBe("SAFE-123");
    expect(view.trackingUrl).toBeNull();
  });

  it("sanitizes legacy display values and rejects over-length numbers", () => {
    const sanitized = buildShipmentView({
      shipping_carrier: "ups",
      tracking_number: "1Z999\u202E487",
    });
    expect(sanitized.trackingNumber).toBe("1Z999487");
    expect(sanitized.trackingUrl).not.toContain("%E2%80%AE");

    expect(buildShipmentView({
      shipping_carrier: "ups",
      tracking_number: "X".repeat(MAX_TRACKING_LENGTH + 1),
    }).trackingUrl).toBeNull();
  });
});
