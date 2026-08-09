import { describe, expect, it } from "vitest";
import { carrierRegistryFromConfig } from "@/lib/fulfillment/carrier-config";
import { buildTrackingUrl, normalizeLegacyCarrier } from "@/lib/fulfillment/tracking";
import { resolveStoreConfig } from "@/lib/store-config";

describe("runtime carrier configuration", () => {
  it("turns a validated template into an encoded carrier URL", () => {
    const config = resolveStoreConfig({
      STORE_CARRIERS_JSON: JSON.stringify([
        {
          code: "dhl",
          label: "DHL Express",
          trackingUrlTemplate: "https://dhl.example/track?piece={trackingNumber}",
          legacyAliases: ["DHL Global"],
        },
        { code: "other", label: "Other", legacyAliases: [] },
      ]),
    });
    const registry = carrierRegistryFromConfig(config);

    expect(buildTrackingUrl("dhl", "ABC-123", registry))
      .toBe("https://dhl.example/track?piece=ABC-123");
    expect(buildTrackingUrl("dhl", "ABC / 123", registry)).toBeNull();
    expect(normalizeLegacyCarrier("DHL Global Parcel", registry)).toBe("dhl");
  });

  it("chooses the longest legacy prefix and rejects equal-length cross-carrier ties", () => {
    expect(normalizeLegacyCarrier("DHLX Parcel", {
      definitions: [
        { code: "dhl", label: "DHL", legacyAliases: ["dhl"] },
        { code: "dhlx", label: "DHL X", legacyAliases: ["dhlx"] },
        { code: "other", label: "Other" },
      ],
    })).toBe("dhlx");

    expect(normalizeLegacyCarrier("Parcel Express", {
      definitions: [
        { code: "alpha", label: "Alpha", legacyAliases: ["parcel"] },
        { code: "beta", label: "Beta", legacyAliases: ["parcel"] },
        { code: "other", label: "Other" },
      ],
    })).toBe("other");
  });
});
