import { describe, expect, it } from "vitest";
import { parseShipmentInput } from "@/lib/fulfillment/transitions";

describe("parseShipmentInput", () => {
  it("accepts exact allowlisted tracking input without mutation", () => {
    expect(parseShipmentInput({ carrier: "ups", trackingNumber: "1Z-ABC123" }))
      .toEqual({ ok: true, input: { carrier: "ups", trackingNumber: "1Z-ABC123" } });
  });

  it.each([
    " AB123",
    "AB123 ",
    "AB/C123",
    "AB C123",
    "AB_C123",
    "AB.123",
    "AB\u202e123",
  ])("rejects tracking input that would require mutation: %j", (trackingNumber) => {
    expect(parseShipmentInput({ carrier: "ups", trackingNumber })).toMatchObject({ ok: false });
  });
});
