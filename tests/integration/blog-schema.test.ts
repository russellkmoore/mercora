import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "./helpers/d1";

beforeEach(async () => {
  await applyTestMigrations();
});

describe("content-publishing migration", () => {
  it("leaves Blog empty and preserves the existing CMS seed", async () => {
    const posts = await env.DB.prepare("SELECT COUNT(*) AS count FROM blog_posts")
      .first<{ count: number }>();
    const categories = await env.DB.prepare("SELECT COUNT(*) AS count FROM blog_categories")
      .first<{ count: number }>();
    const existingPages = await env.DB.prepare(
      "SELECT slug, title FROM pages ORDER BY slug",
    ).all<{ slug: string; title: string }>();

    expect(posts?.count).toBe(0);
    expect(categories?.count).toBe(0);
    expect(existingPages.results).toEqual([
      { slug: "about", title: "About Us" },
      { slug: "privacy-policy", title: "Privacy Policy" },
      { slug: "terms-of-service", title: "Terms of Service" },
    ]);
  });

  it("registers only neutral templates without replacing existing names", async () => {
    const templates = await env.DB.prepare(
      "SELECT name, display_name FROM page_templates ORDER BY name",
    ).all<{ name: string; display_name: string }>();
    expect(templates.results).toEqual([
      { name: "about", display_name: "About Page" },
      { name: "contact", display_name: "Contact" },
      { name: "default", display_name: "Default Page" },
      { name: "faq", display_name: "FAQ" },
      { name: "guide", display_name: "Structured Guide" },
      { name: "legal", display_name: "Legal Document" },
      { name: "story", display_name: "Story" },
    ]);
    expect(JSON.stringify(templates.results)).not.toMatch(/BeauTeas|tea|Chai/i);
  });

  it("enforces publication, JSON, slug, reading-time, and category constraints", async () => {
    await env.DB.prepare(
      "INSERT INTO blog_categories (name, slug) VALUES ('Guides', 'guides')",
    ).run();
    await env.DB.prepare(`INSERT INTO blog_posts
      (title, slug, author, status, tags, html, reading_time, category_id, published_at)
      VALUES ('A guide', 'a-guide', 'Editorial team', 'published', '["guide"]', '<p>Safe</p>', 1, 1, 100)`)
      .run();
    const row = await env.DB.prepare(
      "SELECT status, tags, category_id FROM blog_posts WHERE slug = 'a-guide'",
    ).first<{ status: string; tags: string; category_id: number | null }>();
    expect(row).toEqual({ status: "published", tags: '["guide"]', category_id: 1 });

    await expect(env.DB.prepare(
      "INSERT INTO blog_posts (title, slug, author, status) VALUES ('Bad', 'bad-status', 'Editor', 'queued')",
    ).run()).rejects.toThrow();
    await expect(env.DB.prepare(
      "INSERT INTO blog_posts (title, slug, author, tags) VALUES ('Bad', 'bad-json', 'Editor', '{}')",
    ).run()).rejects.toThrow();
    await expect(env.DB.prepare(
      "INSERT INTO blog_posts (title, slug, author) VALUES ('Bad', '-bad-slug', 'Editor')",
    ).run()).rejects.toThrow();
    await expect(env.DB.prepare(
      "INSERT INTO blog_posts (title, slug, author, reading_time) VALUES ('Bad', 'bad-time', 'Editor', 0)",
    ).run()).rejects.toThrow();

    await env.DB.prepare("DELETE FROM blog_categories WHERE id = 1").run();
    const detached = await env.DB.prepare(
      "SELECT category_id FROM blog_posts WHERE slug = 'a-guide'",
    ).first<{ category_id: number | null }>();
    expect(detached?.category_id).toBeNull();
  });
});
