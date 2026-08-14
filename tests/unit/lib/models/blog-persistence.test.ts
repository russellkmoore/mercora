import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbAsync: vi.fn(),
  getStoreConfig: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDbAsync: mocks.getDbAsync }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: mocks.getStoreConfig }));
vi.mock("@/lib/utils/sanitize-html-server", async () => {
  const core = await import("@/lib/utils/sanitize-html-core");
  return { sanitizeRichHtmlServer: core.sanitizeRichHtmlServer };
});

import { adminCreateBlogPost, adminUpdateBlogPost, getPublishedBlogPost } from "@/lib/models/blog";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Launch",
    slug: "launch",
    author: "Example team",
    excerpt: null,
    tags: '["news"]',
    coverImageUrl: null,
    coverImageAlt: null,
    status: "published",
    editorJson: '{"type":"doc"}',
    html: "<p>Body</p>",
    readingTime: 1,
    categoryId: null,
    metaTitle: null,
    metaDescription: null,
    publishedAt: 100,
    createdAt: 100,
    updatedAt: 100,
    createdBy: "admin_1",
    updatedBy: "admin_1",
    ...overrides,
  };
}

describe("Blog persistence boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoreConfig.mockReturnValue({
      identity: { name: "Example" },
      urls: { imageCdn: "https://cdn.example.test" },
    });
  });

  it("sanitizes authoritative HTML and derives neutral defaults on create", async () => {
    const values = vi.fn((data) => ({ returning: vi.fn().mockResolvedValue([row(data)]) }));
    mocks.getDbAsync.mockResolvedValue({ insert: vi.fn(() => ({ values })) });
    const created = await adminCreateBlogPost({
      title: " Launch! ",
      html: '<p onclick="bad()">Body</p><script>bad()</script>',
      status: "published",
      tags: [" News ", "news"],
    });
    const stored = values.mock.calls[0][0];
    expect(stored).toMatchObject({
      slug: "launch", author: "Example team", html: "<p>Body</p>", tags: '["news"]', status: "published",
    });
    expect(stored.publishedAt).toEqual(expect.any(Number));
    expect(created.html).toBe("<p>Body</p>");
  });

  it("never exposes editor state or actor IDs through the public detail model", async () => {
    const limit = vi.fn().mockResolvedValue([row()]);
    mocks.getDbAsync.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) })),
    });
    const post = await getPublishedBlogPost("launch", 200);
    expect(post).toMatchObject({ slug: "launch", html: "<p>Body</p>" });
    expect(post).not.toHaveProperty("editorJson");
    expect(post).not.toHaveProperty("createdBy");
    expect(post).not.toHaveProperty("updatedBy");
  });

  it("rejects a published update that explicitly clears publication time", async () => {
    const limit = vi.fn().mockResolvedValue([row()]);
    const update = vi.fn();
    mocks.getDbAsync.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) })),
      update,
    });
    await expect(adminUpdateBlogPost(1, { status: "published", publishedAt: null }))
      .rejects.toThrow("publication time");
    expect(update).not.toHaveBeenCalled();
  });
});
