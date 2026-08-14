import { describe, expect, it } from "vitest";

import { transformBlogContent } from "@/scripts/shopify-migration/transformers/blog";

const options = {
  generatedAt: "2026-08-14T12:00:00.000Z",
  actorId: "migration-operator",
  fallbackAuthor: "Store Team",
  allowedMediaHosts: ["cdn.example.test"],
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
      body_html: '<p>Useful words.</p><img src="https://cdn.example.test/inside.webp"><iframe src="https://evil.test"></iframe>',
      image: { src: "https://cdn.example.test/cover.jpg", alt: "Cover" },
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

  it("strips unapproved blog media instead of persisting remote sources", () => {
    const result = transformBlogContent(
      [{ id: 1, title: "News", handle: "news" }],
      [{
        id: 2,
        blog_id: 1,
        title: "No remote media",
        handle: "no-remote-media",
        body_html: '<p>Text</p><img src="https://cdn.example.test/inline.png">',
        image: { src: "https://cdn.example.test/cover.png" },
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
        body_html: '<p>Text remains.</p><img src="https://cdn.example.test/inline.gif">',
        image: { src: "https://cdn.example.test/cover.avif" },
      }],
      options,
    );
    expect(result.records[0].media).toEqual([]);
    expect(result.records[0].record.html).toBe("<p>Text remains.</p>");
    expect(result.records[0].record.cover_image_url).toBeNull();
  });
});
