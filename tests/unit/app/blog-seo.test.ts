import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedBlogPosts: vi.fn(),
  getPublishedBlogPost: vi.fn(),
  getPublishedPages: vi.fn(),
  getSitemapCatalogEntries: vi.fn(),
  getStoreConfig: vi.fn(),
}));
vi.mock("@/lib/models/blog", () => ({
  getPublishedBlogPosts: mocks.getPublishedBlogPosts,
  getPublishedBlogPost: mocks.getPublishedBlogPost,
  getRelatedBlogPosts: vi.fn(() => []),
}));
vi.mock("@/lib/models/pages", () => ({ getPublishedPages: mocks.getPublishedPages }));
vi.mock("@/lib/seo/sitemap-data", () => ({ getSitemapCatalogEntries: mocks.getSitemapCatalogEntries }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.getStoreConfig }));
vi.mock("@/lib/utils/sanitize-html-server", () => ({ sanitizeRichHtmlServer: (html: string) => html }));

import sitemap from "@/app/sitemap";
import { GET as rss } from "@/app/blog/rss.xml/route";
import { generateMetadata } from "@/app/blog/[slug]/page";

describe("Blog SEO surfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoreConfig.mockReturnValue({
      identity: { name: "Example Store" },
      urls: { site: "https://store.example.test", imageCdn: undefined },
    });
    mocks.getPublishedBlogPosts.mockResolvedValue([]);
    mocks.getPublishedPages.mockResolvedValue([]);
    mocks.getSitemapCatalogEntries.mockResolvedValue({ products: [], categories: [] });
  });

  it("builds a configured dynamic sitemap from public content only", async () => {
    mocks.getSitemapCatalogEntries.mockResolvedValue({
      products: [{ slug: "widget", updatedAt: new Date("2026-01-01") }],
      categories: [{ slug: "new" }],
    });
    mocks.getPublishedPages.mockResolvedValue([{ slug: "about", updated_at: 100 }]);
    mocks.getPublishedBlogPosts.mockResolvedValue([{ slug: "launch", updatedAt: 100 }]);
    const entries = await sitemap();
    expect(entries.map(({ url }) => url)).toEqual(expect.arrayContaining([
      "https://store.example.test/",
      "https://store.example.test/product/widget",
      "https://store.example.test/category/new",
      "https://store.example.test/about",
      "https://store.example.test/blog/launch",
    ]));
    expect(entries.some(({ url }) => url.includes("/api/"))).toBe(false);
  });

  it("keeps stable top-level routes when content storage is unavailable", async () => {
    mocks.getSitemapCatalogEntries.mockRejectedValue(new Error("D1 unavailable"));
    expect((await sitemap()).map(({ url }) => url)).toEqual([
      "https://store.example.test/",
      "https://store.example.test/products",
      "https://store.example.test/blog",
    ]);
  });

  it("serves escaped RSS with explicit content and cache headers", async () => {
    mocks.getPublishedBlogPosts.mockResolvedValue([{
      id: 1, title: "A & B", slug: "a-b", author: "Writer", excerpt: null, tags: [],
      coverImageUrl: null, coverImageAlt: null, status: "published", readingTime: 1,
      publishedAt: 100, createdAt: 100, updatedAt: 100,
    }]);
    const response = await rss();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/rss+xml");
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate");
    expect(await response.text()).toContain("A &amp; B");
  });

  it("derives detail metadata from configured identity and public article fields", async () => {
    mocks.getPublishedBlogPost.mockResolvedValue({
      slug: "launch", title: "Launch", metaTitle: null, metaDescription: null,
      excerpt: "Read this", coverImageUrl: "/blog/cover.png",
    });
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "launch" }) });
    expect(metadata).toMatchObject({
      title: "Launch",
      description: "Read this",
      alternates: { canonical: "/blog/launch" },
    });
  });
});
