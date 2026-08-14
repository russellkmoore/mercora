import { describe, expect, it } from "vitest";
import {
  calculateBlogReadingTime,
  getRelatedBlogPosts,
  normalizeBlogSlug,
  normalizeBlogTags,
  type BlogPostSummary,
} from "@/lib/blog/values";

function post(overrides: Partial<BlogPostSummary>): BlogPostSummary {
  return {
    id: 1,
    title: "Post",
    slug: "post",
    author: "Editorial team",
    excerpt: null,
    tags: [],
    coverImageUrl: null,
    coverImageAlt: null,
    status: "published",
    readingTime: 1,
    publishedAt: 100,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe("Blog model value boundaries", () => {
  it("normalizes slugs and rejects empty or oversized values", () => {
    expect(normalizeBlogSlug("  A Useful Guide!  ")).toBe("a-useful-guide");
    expect(() => normalizeBlogSlug("✨")).toThrow("Slug must be between");
    expect(() => normalizeBlogSlug("a".repeat(161))).toThrow("Slug must be between");
  });

  it("normalizes, deduplicates, and bounds tags", () => {
    expect(normalizeBlogTags([" News ", "news", "GUIDES"])).toEqual(["news", "guides"]);
    expect(normalizeBlogTags(Array.from({ length: 25 }, (_, index) => `tag-${index}`)))
      .toHaveLength(20);
    expect(() => normalizeBlogTags("news")).toThrow("Tags must be an array");
    expect(() => normalizeBlogTags(["a".repeat(51)])).toThrow("Tag is too long");
  });

  it("calculates a bounded reading time from visible words", () => {
    expect(calculateBlogReadingTime("<p>Short post</p>")).toBe(1);
    expect(calculateBlogReadingTime(`<p>${"word ".repeat(501)}</p>`)).toBe(3);
  });

  it("orders related published posts deterministically without leaking drafts", () => {
    const posts = [
      post({ id: 2, slug: "two", tags: ["news"], publishedAt: 200 }),
      post({ id: 3, slug: "three", tags: ["news", "guide"], publishedAt: 100 }),
      post({ id: 4, slug: "draft", tags: ["news", "guide"], status: "draft" }),
      post({ id: 5, slug: "other", tags: ["other"] }),
    ];
    expect(getRelatedBlogPosts(posts, "current", ["news", "guide"]))
      .toEqual([posts[1], posts[0]]);
  });
});
