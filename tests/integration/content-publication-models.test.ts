import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";
import { applyTestMigrations } from "./helpers/d1";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/sanitize-html-server", () => ({
  sanitizePageHtmlServer: (html: string) => html,
  sanitizeRichHtmlServer: (html: string) => html,
}));
vi.mock("@/lib/db", () => ({
  getDbAsync: async () => drizzle(env.DB, { schema }),
}));

import {
  getPublishedBlogPost,
  getPublishedBlogPosts,
} from "@/lib/models/blog";
import { getPageBySlug, getPublishedPages } from "@/lib/models/pages";

beforeEach(async () => {
  await applyTestMigrations();
});

describe("real D1 public content visibility", () => {
  it("hides draft, future, protected, and reserved CMS rows", async () => {
    const rows = [
      ["Visible", "visible-page", "published", 100, 0],
      ["Draft", "draft-page", "draft", 100, 0],
      ["Future", "future-page", "published", 300, 0],
      ["Members", "members-page", "published", 100, 1],
      ["Collision", "blog", "published", 100, 0],
    ] as const;
    for (const [title, slug, status, publishedAt, isProtected] of rows) {
      await env.DB.prepare(`
        INSERT INTO pages (title, slug, content, status, published_at, is_protected, show_in_nav)
        VALUES (?, ?, '<p>Body</p>', ?, ?, ?, 1)
      `).bind(title, slug, status, publishedAt, isProtected).run();
    }

    vi.setSystemTime(new Date(200_000));
    const published = await getPublishedPages();
    expect(published.map(({ slug }) => slug)).toContain("visible-page");
    expect(published.map(({ slug }) => slug)).not.toEqual(expect.arrayContaining([
      "draft-page", "future-page", "members-page", "blog",
    ]));
    await expect(getPageBySlug("draft-page", false, { now: 200 })).resolves.toBeNull();
    await expect(getPageBySlug("future-page", false, { now: 200 })).resolves.toBeNull();
    await expect(getPageBySlug("members-page", false, { now: 200 })).resolves.toBeNull();
  });

  it("enforces Blog scheduling and strips private/editor fields from public detail", async () => {
    const insert = env.DB.prepare(`
      INSERT INTO blog_posts
        (title, slug, author, status, html, published_at, created_by, editor_json)
      VALUES (?, ?, 'Editor', ?, ?, ?, 'actor', ?)
    `);
    await env.DB.batch([
      insert.bind("Visible", "visible-post", "published", "<p>Visible</p>", 100, '{"doc":true}'),
      insert.bind("Future", "future-post", "published", "<p>Future</p>", 300, null),
      insert.bind("Draft", "draft-post", "draft", "<p>Draft</p>", null, null),
    ]);

    const list = await getPublishedBlogPosts({ now: 200, limit: 100 });
    expect(list.map(({ slug }) => slug)).toEqual(["visible-post"]);
    const detail = await getPublishedBlogPost("visible-post", 200);
    expect(detail).toMatchObject({ slug: "visible-post", html: "<p>Visible</p>" });
    expect(detail).not.toHaveProperty("editorJson");
    expect(detail).not.toHaveProperty("createdBy");
    await expect(getPublishedBlogPost("future-post", 200)).resolves.toBeNull();
    await expect(getPublishedBlogPost("draft-post", 200)).resolves.toBeNull();
  });
});
