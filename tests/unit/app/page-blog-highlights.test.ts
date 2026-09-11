import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentSettings } from "@/lib/content/settings";
import type { BlogPostSummary } from "@/lib/blog/values";

/**
 * Home page — BlogHighlights placement and gating (Phase 16, Plan 03, Task 2).
 *
 * Covers every bullet in 16-03-PLAN.md Task 2's `<behavior>` block: both
 * fixed placements, exactly-once rendering, the disabled short-circuit (no
 * query at all), the enabled-but-empty case, the resolved count/heading
 * passed through, and that the featured-products grid is unaffected.
 */

const BLOG_TESTID = "blog-highlights-stub";
const GRID_MARKER = "max-w-6xl";

const state: {
  content: ContentSettings;
  posts: BlogPostSummary[];
} = {
  content: {
    blogNavLabel: "Blog",
    blogHomeBlockEnabled: true,
    blogHomeBlockHeading: "From the Blog",
    blogHomeBlockCount: 3,
    blogHomeBlockPlacement: "after_featured",
  },
  posts: [],
};

function post(overrides: Partial<BlogPostSummary> = {}): BlogPostSummary {
  return {
    id: 1,
    title: "A Post",
    slug: "a-post",
    author: "Jordan Ives",
    excerpt: "An excerpt.",
    tags: [],
    coverImageUrl: null,
    coverImageAlt: null,
    status: "published",
    readingTime: 3,
    publishedAt: 1_700_000_000,
    createdAt: 1_699_000_000,
    updatedAt: 1_699_000_000,
    ...overrides,
  };
}

const mocks = vi.hoisted(() => ({
  getContentSettings: vi.fn(),
  getPublishedBlogPosts: vi.fn(),
  getProductsByCategory: vi.fn(),
  toPublicProduct: vi.fn(),
  filterListedProducts: vi.fn(),
  getStoreConfig: vi.fn(),
  getLayoutSettings: vi.fn(),
}));

vi.mock("@/lib/content/settings", () => ({
  getContentSettings: mocks.getContentSettings,
}));

vi.mock("@/lib/models/blog", () => ({
  getPublishedBlogPosts: mocks.getPublishedBlogPosts,
}));

vi.mock("@/lib/models/mach/products", () => ({
  getProductsByCategory: mocks.getProductsByCategory,
}));

vi.mock("@/lib/models/mach/product-serializer", () => ({
  toPublicProduct: mocks.toPublicProduct,
}));

vi.mock("@/lib/gift-cards/visibility", () => ({
  filterListedProducts: mocks.filterListedProducts,
}));

vi.mock("@/lib/store-config", () => ({
  getStoreConfig: mocks.getStoreConfig,
}));

vi.mock("@/lib/layout/settings", () => ({
  getLayoutSettings: mocks.getLayoutSettings,
}));

vi.mock("@/components/layout/home/home-hero-map", () => ({
  HOME_HERO_MAP: {
    minimal: () => React.createElement("div", { "data-testid": "hero-stub" }),
  },
}));

vi.mock("@/components/ProductCard", () => ({
  default: () => React.createElement("div", { "data-testid": "product-card-stub" }),
}));

vi.mock("@/components/home/BlogHighlights", () => ({
  default: ({ heading }: { heading: string }) =>
    React.createElement("div", { "data-testid": BLOG_TESTID, "data-heading": heading }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

const { default: HomePage } = await import("@/app/page");

beforeEach(() => {
  vi.clearAllMocks();
  state.content = {
    blogNavLabel: "Blog",
    blogHomeBlockEnabled: true,
    blogHomeBlockHeading: "From the Blog",
    blogHomeBlockCount: 3,
    blogHomeBlockPlacement: "after_featured",
  };
  state.posts = [post()];

  mocks.getContentSettings.mockImplementation(async () => state.content);
  mocks.getPublishedBlogPosts.mockImplementation(async () => state.posts);
  mocks.getProductsByCategory.mockResolvedValue([]);
  mocks.toPublicProduct.mockImplementation((product: unknown) => product);
  mocks.filterListedProducts.mockImplementation((products: unknown) => products);
  mocks.getStoreConfig.mockReturnValue({ commerce: { features: { giftCardAcquisition: false } } });
  mocks.getLayoutSettings.mockResolvedValue({ homeHero: "minimal" });
});

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("HomePage — BlogHighlights placement and gating", () => {
  it("renders the block before the featured-products grid when placement is before_featured", async () => {
    state.content.blogHomeBlockPlacement = "before_featured";
    const markup = renderToStaticMarkup(await HomePage());
    const blockIndex = markup.indexOf(`data-testid="${BLOG_TESTID}"`);
    const gridIndex = markup.indexOf(GRID_MARKER);
    expect(blockIndex).toBeGreaterThan(-1);
    expect(blockIndex).toBeLessThan(gridIndex);
  });

  it("renders the block after the featured-products grid when placement is after_featured", async () => {
    state.content.blogHomeBlockPlacement = "after_featured";
    const markup = renderToStaticMarkup(await HomePage());
    const blockIndex = markup.indexOf(`data-testid="${BLOG_TESTID}"`);
    const gridIndex = markup.indexOf(GRID_MARKER);
    expect(blockIndex).toBeGreaterThan(-1);
    expect(blockIndex).toBeGreaterThan(gridIndex);
  });

  it("renders the block exactly once", async () => {
    const markup = renderToStaticMarkup(await HomePage());
    expect(countOccurrences(markup, `data-testid="${BLOG_TESTID}"`)).toBe(1);
  });

  it("renders no block markup and never calls getPublishedBlogPosts when disabled", async () => {
    state.content.blogHomeBlockEnabled = false;
    const markup = renderToStaticMarkup(await HomePage());
    expect(markup).not.toContain(BLOG_TESTID);
    expect(mocks.getPublishedBlogPosts).not.toHaveBeenCalled();
  });

  it("renders no block markup when enabled but there are no published posts", async () => {
    state.posts = [];
    const markup = renderToStaticMarkup(await HomePage());
    expect(markup).not.toContain(BLOG_TESTID);
  });

  it("calls getPublishedBlogPosts with the resolved count as limit and includeHtml set", async () => {
    state.content.blogHomeBlockCount = 5;
    await HomePage();
    expect(mocks.getPublishedBlogPosts).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, includeHtml: true }),
    );
  });

  it("passes the resolved heading setting through to the block", async () => {
    state.content.blogHomeBlockHeading = "Latest Dispatches";
    const markup = renderToStaticMarkup(await HomePage());
    expect(markup).toContain('data-heading="Latest Dispatches"');
  });

  it("renders the featured-products grid identically whether the block is enabled or disabled", async () => {
    const enabledMarkup = renderToStaticMarkup(await HomePage());
    state.content.blogHomeBlockEnabled = false;
    const disabledMarkup = renderToStaticMarkup(await HomePage());
    const stripBlock = (markup: string) =>
      markup.replace(new RegExp(`<div data-testid="${BLOG_TESTID}"[^>]*></div>`, "g"), "");
    expect(stripBlock(enabledMarkup)).toBe(stripBlock(disabledMarkup));
  });
});
