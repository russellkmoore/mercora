import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A sitemap is an authoritative index. With both gift-card flags off the
 * product page calls `notFound()` (D-10), so a sitemap that keeps advertising
 * `/product/gift-card` hands crawlers a 404 from the one place they trust. The
 * fix is the shared predicate every other listing surface already uses (D-14),
 * which drops the card whenever selling is off.
 */

const mocks = vi.hoisted(() => ({
  getStoreConfig: vi.fn(),
  getSitemapCatalogEntries: vi.fn(),
  getPublishedPages: vi.fn(),
  getPublishedBlogSitemapEntries: vi.fn(),
}));

vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.getStoreConfig }));
vi.mock("@/lib/seo/sitemap-data", () => ({
  getSitemapCatalogEntries: mocks.getSitemapCatalogEntries,
}));
vi.mock("@/lib/models/pages", () => ({ getPublishedPages: mocks.getPublishedPages }));
vi.mock("@/lib/models/blog", () => ({
  getPublishedBlogSitemapEntries: mocks.getPublishedBlogSitemapEntries,
}));

import sitemap from "@/app/sitemap";

function setFeatures(giftCardAcquisition: boolean, giftCardReconciliation: boolean) {
  mocks.getStoreConfig.mockReturnValue({
    urls: { site: "https://store.example" },
    commerce: { features: { giftCardAcquisition, giftCardReconciliation } },
  });
}

async function urls(): Promise<string[]> {
  return (await sitemap()).map((entry) => entry.url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedPages.mockResolvedValue([]);
  mocks.getPublishedBlogSitemapEntries.mockResolvedValue([]);
  mocks.getSitemapCatalogEntries.mockResolvedValue({
    products: [
      { slug: "trail-boots", type: "physical" },
      { slug: "gift-card", type: "gift_card" },
    ],
    categories: [],
  });
});

describe("sitemap gift-card visibility (WR-01, D-07, D-10)", () => {
  it("lists the gift card while selling is on", async () => {
    setFeatures(true, true);
    expect(await urls()).toContain("https://store.example/product/gift-card");
  });

  it("omits the gift card once selling is off", async () => {
    setFeatures(false, true);
    const result = await urls();
    expect(result).not.toContain("https://store.example/product/gift-card");
    // Only the gift card goes; the rest of the catalogue is untouched.
    expect(result).toContain("https://store.example/product/trail-boots");
  });

  it("omits the gift card with both flags off, where the page itself 404s", async () => {
    setFeatures(false, false);
    expect(await urls()).not.toContain("https://store.example/product/gift-card");
  });

  it("never hides a product that is not a gift card, whatever the flags say", async () => {
    setFeatures(false, false);
    mocks.getSitemapCatalogEntries.mockResolvedValue({
      products: [
        { slug: "no-type" },
        { slug: "null-type", type: null },
        { slug: "impostor", type: "giftcard" },
      ],
      categories: [],
    });

    const result = await urls();
    for (const slug of ["no-type", "null-type", "impostor"]) {
      expect(result).toContain(`https://store.example/product/${slug}`);
    }
  });
});
