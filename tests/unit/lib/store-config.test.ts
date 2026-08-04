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
});
