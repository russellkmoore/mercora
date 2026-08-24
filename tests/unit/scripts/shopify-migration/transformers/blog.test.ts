import { describe, expect, it } from "vitest";

import { transformBlogContent } from "@/scripts/shopify-migration/transformers/blog";

const options = {
  generatedAt: "2026-08-14T12:00:00.000Z",
  actorId: "migration-operator",
  fallbackAuthor: "Store Team",
  allowedMediaHosts: ["cdn.shopify.com"],
};

describe("blog transform", () => {
  it("plans categories, posts, sanitized media, metadata, and exact legacy redirects", () => {
    const result = transformBlogContent([{
      id: 10,
      title: "Guides",
      handle: "guides",
      created_at: "2024-01-01T00:00:00Z",
    }], [{
      id: 20,
      blog_id: 10,
      title: "A Useful Guide",
      handle: "a-useful-guide",
      author: "Alex",
      tags: "How To, Featured, how to",
      summary_html: "<p>A useful summary.</p>",
      body_html: '<p>Useful words.</p><img src="https://cdn.shopify.com/inside.webp"><iframe src="https://evil.test"></iframe>',
      image: { src: "https://cdn.shopify.com/cover.jpg", alt: "Cover" },
      published: true,
      published_at: "2024-01-02T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-03T00:00:00Z",
    }], options);

    expect(result.categories[0]).toMatchObject({
      record: { name: "Guides", slug: "guides" },
      conflict: { strategy: "insert-only", onConflict: "reuse" },
    });
    const post = result.records[0];
    expect(post.record).toMatchObject({
      slug: "a-useful-guide",
      author: "Alex",
      tags: JSON.stringify(["how to", "featured"]),
      status: "published",
      reading_time: 1,
      published_at: 1_704_153_600,
    });
    expect(post.record.html).toContain("/media/blog/");
    expect(post.record.html).not.toContain("iframe");
    expect(post.record.cover_image_url).toContain("/media/blog/");
    expect(post.media.map(({ contentType }) => contentType)).toEqual(["image/jpeg", "image/webp"]);
    expect(post.redirect).toEqual({
      sourcePath: "/blogs/guides/a-useful-guide",
      targetPath: "/blog/a-useful-guide",
      statusCode: 301,
      entityType: "blog",
    });
    expect(post.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses the configured author, keeps drafts unpublished, and skips orphan articles", () => {
    const result = transformBlogContent(
      [{ id: 1, title: "News", handle: "news" }],
      [
        { id: 2, blog_id: 1, title: "Draft", handle: "draft", published: false, published_at: "2024-01-01T00:00:00Z" },
        { id: 3, blog_id: 999, title: "Orphan", handle: "orphan" },
      ],
      options,
    );
    expect(result.records[0].record).toMatchObject({ author: "Store Team", status: "draft", published_at: null });
    expect(result.skipped[0].reason).toBe("Article references a blog that was not imported");
  });

  it("keeps persisted rows identical across run clocks when source timestamps are unavailable", () => {
    const blogs = [{ id: 1, title: "News", handle: "news" }];
    const articles = [{
      id: 2,
      blog_id: 1,
      title: "Stable",
      handle: "stable",
      body_html: "<p>Stable</p>",
    }];
    const first = transformBlogContent(blogs, articles, { ...options, generatedAt: "2026-01-01T00:00:00Z" });
    const second = transformBlogContent(blogs, articles, { ...options, generatedAt: "2027-01-01T00:00:00Z" });
    expect(first.categories).toEqual(second.categories);
    expect(first.records).toEqual(second.records);
    expect(first.categories[0].record).toMatchObject({ created_at: 0, updated_at: 0 });
    expect(first.records[0].record).toMatchObject({ created_at: 0, updated_at: 0 });
  });

  it("strips unapproved blog media instead of persisting remote sources", () => {
    const result = transformBlogContent(
      [{ id: 1, title: "News", handle: "news" }],
      [{
        id: 2,
        blog_id: 1,
        title: "No remote media",
        handle: "no-remote-media",
        body_html: '<p>Text</p><img src="https://cdn.shopify.com/inline.png">',
        image: { src: "https://cdn.shopify.com/cover.png" },
      }],
      { ...options, allowedMediaHosts: [] },
    );
    expect(result.records[0].media).toEqual([]);
    expect(result.records[0].record.cover_image_url).toBeNull();
    expect(result.records[0].record.html).not.toContain("https://");
    expect(result.records[0].record.html).not.toContain("src=");
  });

  it("rejects blog fields beyond current persistence limits", () => {
    const result = transformBlogContent(
      [{ id: 1, title: "News", handle: "news" }],
      [{ id: 2, blog_id: 1, title: "Post", handle: "post", tags: "x".repeat(51) }],
      options,
    );
    expect(result.records).toEqual([]);
    expect(result.skipped[0].reason).toContain("tags exceed");
  });

  it("omits GIF and AVIF because the upload adapter cannot verify their signatures", () => {
    const result = transformBlogContent(
      [{ id: 1, title: "News", handle: "news" }],
      [{
        id: 2,
        blog_id: 1,
        title: "Unsupported media",
        handle: "unsupported-media",
        body_html: '<p>Text remains.</p><img src="https://cdn.shopify.com/inline.gif">',
        image: { src: "https://cdn.shopify.com/cover.avif" },
      }],
      options,
    );
    expect(result.records[0].media).toEqual([]);
    expect(result.records[0].record.html).toBe("<p>Text remains.</p>");
    expect(result.records[0].record.cover_image_url).toBeNull();
  });

  it("resolves category and post slug conflicts identically for permuted provider input", () => {
    const blogs = [
      { id: 30, title: "Thirty", handle: "shared" },
      { id: 10, title: "Ten", handle: "shared" },
      { id: 20, title: "Twenty", handle: "other" },
    ];
    const articles = [
      { id: 300, blog_id: 20, title: "Three", handle: "same-post", body_html: "<p>Three</p>" },
      { id: 100, blog_id: 20, title: "One", handle: "same-post", body_html: "<p>One</p>" },
      { id: 200, blog_id: 20, title: "Two", handle: "other-post", body_html: "<p>Two</p>" },
    ];
    const first = transformBlogContent(blogs, articles, options);
    const second = transformBlogContent([...blogs].reverse(), [...articles].reverse(), options);
    expect(first.categories).toEqual(second.categories);
    expect(first.records).toEqual(second.records);
    expect(first.categories.map(({ record }) => record.slug)).toEqual(["other"]);
    expect(first.records.map(({ record }) => record.slug)).toEqual(["other-post"]);
    expect(first.skipped.map(({ record, reason }) => [record.id, reason])).toEqual(
      second.skipped.map(({ record, reason }) => [record.id, reason]),
    );
  });
});
