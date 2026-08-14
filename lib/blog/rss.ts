import type { BlogPostSummary } from "./values";

export function escapeXml(value: string): string {
  return value.replace(/[<>&'"\u0000-\u001F]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
    };
    return entities[character] ?? "";
  });
}

export function buildBlogRss(options: {
  siteUrl: string;
  storeName: string;
  description: string;
  posts: readonly BlogPostSummary[];
}): string {
  const site = new URL(options.siteUrl);
  const item = (post: BlogPostSummary) => {
    const url = new URL(`/blog/${post.slug}`, site).href;
    const date = post.publishedAt === null ? null : new Date(post.publishedAt * 1000);
    return [
      "<item>",
      `<title>${escapeXml(post.title)}</title>`,
      `<link>${escapeXml(url)}</link>`,
      `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
      ...(post.excerpt ? [`<description>${escapeXml(post.excerpt)}</description>`] : []),
      ...(date && !Number.isNaN(date.getTime()) ? [`<pubDate>${date.toUTCString()}</pubDate>`] : []),
      `<dc:creator>${escapeXml(post.author)}</dc:creator>`,
      ...post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`),
      "</item>",
    ].join("");
  };
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>',
    `<title>${escapeXml(`${options.storeName} Blog`)}</title>`,
    `<link>${escapeXml(new URL("/blog", site).href)}</link>`,
    `<description>${escapeXml(options.description)}</description>`,
    `<atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(new URL("/blog/rss.xml", site).href)}" rel="self" type="application/rss+xml" />`,
    ...options.posts.map(item),
    "</channel></rss>",
  ].join("");
}
