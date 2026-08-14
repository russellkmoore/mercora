import { describe, expect, it } from "vitest";
import { resolveStoreConfig, storeDefaults } from "@/lib/store-config";

describe("resolveStoreConfig", () => {
  it("uses neutral defaults without requiring process environment at import time", () => {
    expect(resolveStoreConfig({})).toEqual(storeDefaults);
  });

  it("accepts only https origins for public host configuration", () => {
    const config = resolveStoreConfig({
      NEXT_PUBLIC_SITE_URL: "https://shop.example.test/a-path",
      NEXT_PUBLIC_IMAGE_CDN: "https://images.example.test/assets",
      NEXT_PUBLIC_CLERK_HOST: "http://not-accepted.example.test",
    });

    expect(config.urls.site).toBe("https://shop.example.test");
    expect(config.urls.imageCdn).toBe("https://images.example.test");
    expect(config.urls.clerkHost).toBeUndefined();
  });

  it("keeps previews non-indexable unless the deployment opts in", () => {
    expect(resolveStoreConfig({ NODE_ENV: "production" }).deployment.indexable).toBe(false);
    expect(resolveStoreConfig({ NEXT_PUBLIC_ROBOTS_INDEX: "true" }).deployment.indexable).toBe(true);
  });

  it("derives sender identity from a renamed store", () => {
    const config = resolveStoreConfig({
      NEXT_PUBLIC_STORE_NAME: "Acme Store",
      STORE_SUPPORT_EMAIL: "help@acme.example",
    });

    expect(config.contact.senderEmail).toBe("Acme Store <help@acme.example>");
  });

  it("accepts only validated email and policy-link configuration", () => {
    const config = resolveStoreConfig({
      STORE_REPLY_TO_EMAIL: "support@example.com",
      STORE_MERCHANT_NOTIFICATION_EMAIL: "not an email",
      NEXT_PUBLIC_TERMS_URL: "javascript:alert(1)",
      NEXT_PUBLIC_PRIVACY_URL: "https://policies.example.com/privacy",
    });
    expect(config.contact.replyToEmail).toBe("support@example.com");
    expect(config.contact.merchantNotificationEmail).toBeUndefined();
    expect(config.urls.terms).toBe(storeDefaults.urls.terms);
    expect(config.urls.privacy).toBe("https://policies.example.com/privacy");
  });

  it("distinguishes the unresolved default returns route from configured policies", () => {
    expect(resolveStoreConfig({}).urls.returnsConfigured).toBe(false);
    expect(resolveStoreConfig({ NEXT_PUBLIC_RETURNS_URL: "/returns" }).urls.returnsConfigured).toBe(true);
    expect(resolveStoreConfig({ NEXT_PUBLIC_RETURNS_URL: "https://policies.example.com/returns" }).urls.returnsConfigured).toBe(true);
    expect(resolveStoreConfig({ NEXT_PUBLIC_RETURNS_URL: "javascript:alert(1)" }).urls.returnsConfigured).toBe(false);
  });

  it("parses a validated runtime carrier registry", () => {
    const carriers = [
      {
        code: "dhl",
        label: "DHL Express",
        trackingUrlTemplate: "https://www.dhl.example/track/{trackingNumber}",
        legacyAliases: ["DHL Global", "dhl-global"],
      },
      { code: "other", label: "Manual carrier", legacyAliases: [] },
    ];

    expect(resolveStoreConfig({ STORE_CARRIERS_JSON: JSON.stringify(carriers) }).commerce.carriers)
      .toEqual(carriers);
  });

  it("allows equivalent aliases within one carrier definition", () => {
    const carriers = [{
      code: "dhl",
      label: "DHL",
      legacyAliases: ["DHL", "d-h-l", "DHL Global", "dhl-global"],
    }];

    expect(resolveStoreConfig({ STORE_CARRIERS_JSON: JSON.stringify(carriers) }).commerce.carriers)
      .toEqual(carriers);
  });

  it("rejects duplicate normalized carrier definition codes", () => {
    const carriers = [
      { code: "dhl", label: "DHL", legacyAliases: [] },
      { code: "DHL", label: "DHL duplicate", legacyAliases: [] },
    ];

    expect(resolveStoreConfig({ STORE_CARRIERS_JSON: JSON.stringify(carriers) }).commerce.carriers)
      .toEqual(storeDefaults.commerce.carriers);
  });

  it.each([
    "not-json",
    JSON.stringify([]),
    JSON.stringify([{ code: "DHL!", label: "DHL", legacyAliases: [] }]),
    JSON.stringify([{ code: "dhl", label: "DHL", legacyAliases: [], trackingUrlTemplate: "http://dhl.example/{trackingNumber}" }]),
    JSON.stringify([{ code: "dhl", label: "DHL", legacyAliases: [], trackingUrlTemplate: "https://{trackingNumber}.attacker.example/" }]),
    JSON.stringify([{ code: "dhl", label: "DHL", legacyAliases: [], trackingUrlTemplate: "https://dhl.example/no-placeholder" }]),
    JSON.stringify([
      { code: "dhl", label: "DHL", legacyAliases: [] },
      { code: "dhlx", label: "DHL X", legacyAliases: [] },
    ]),
    JSON.stringify([
      { code: "alpha", label: "Alpha", legacyAliases: ["parcel"] },
      { code: "beta", label: "Beta", legacyAliases: ["parcel express"] },
    ]),
  ])("falls back atomically for an unsafe carrier registry: %s", (value) => {
    expect(resolveStoreConfig({ STORE_CARRIERS_JSON: value }).commerce.carriers)
      .toEqual(storeDefaults.commerce.carriers);
  });
});
