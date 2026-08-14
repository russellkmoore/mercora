import { describe, expect, it } from "vitest";
import { buildBlogRss, escapeXml } from "@/lib/blog/rss";
import type { BlogPostSummary } from "@/lib/blog/values";

const post: BlogPostSummary = {
  id: 1, title: "News <&>", slug: "news", author: 'A "Writer"', excerpt: "One & two",
  tags: ["a&b"], coverImageUrl: null, coverImageAlt: null, status: "published",
  readingTime: 1, publishedAt: 100, createdAt: 100, updatedAt: 100,
};

describe("Blog RSS", () => {
  it("escapes every XML-sensitive field", () => {
    expect(escapeXml(`<>&'"`)).toBe("&lt;&gt;&amp;&apos;&quot;");
    const xml = buildBlogRss({
      siteUrl: "https://store.example.test",
      storeName: "Store & Co",
      description: "Guides < news",
      posts: [post],
    });
    expect(xml).toContain("News &lt;&amp;&gt;");
    expect(xml).toContain("<dc:creator>A &quot;Writer&quot;</dc:creator>");
    expect(xml).not.toContain("<author>");
    expect(xml).not.toContain("<title>News <&>");
  });

  it("uses configured absolute URLs and valid RSS headers", () => {
    const xml = buildBlogRss({
      siteUrl: "https://store.example.test/base",
      storeName: "Store",
      description: "Description",
      posts: [post],
    });
    expect(xml).toContain("https://store.example.test/blog/news");
    expect(xml).toContain("<pubDate>Thu, 01 Jan 1970 00:01:40 GMT</pubDate>");
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
  });
});
