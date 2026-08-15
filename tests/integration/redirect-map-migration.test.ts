import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

describe("redirect map migration ordering", () => {
  it("preserves a populated 0019 baseline byte-for-byte before adding empty state", async () => {
    const redirectIndex = env.TEST_MIGRATIONS.findIndex(
      ({ name }) => name === "0020_add_redirect_map.sql",
    );
    expect(redirectIndex).toBeGreaterThan(0);
    const throughContentPublishing = env.TEST_MIGRATIONS.slice(0, redirectIndex);
    const redirectMigration = env.TEST_MIGRATIONS.slice(redirectIndex, redirectIndex + 1);
    expect(redirectMigration.map(({ name }) => name)).toEqual(["0020_add_redirect_map.sql"]);

    await applyD1Migrations(env.DB, throughContentPublishing);
    await env.DB.prepare(`
      INSERT INTO customers (id, type, person, created_at, updated_at)
      VALUES ('O05-BASELINE-CUSTOMER', 'person', '{"email":"baseline@example.com"}',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')
    `).run();
    await env.DB.prepare(`
      INSERT INTO blog_categories (name, slug, description)
      VALUES ('Baseline', 'baseline', 'Existing category')
    `).run();
    await env.DB.prepare(`
      INSERT INTO blog_posts (title, slug, author, status, html, category_id)
      VALUES ('Existing post', 'existing-post', 'Editor', 'published', '<p>Existing</p>', 1)
    `).run();

    const snapshot = async () => ({
      customers: (await env.DB.prepare(
        "SELECT * FROM customers ORDER BY id",
      ).all()).results,
      pages: (await env.DB.prepare(
        "SELECT * FROM pages ORDER BY id",
      ).all()).results,
      blogCategories: (await env.DB.prepare(
        "SELECT * FROM blog_categories ORDER BY id",
      ).all()).results,
      blogPosts: (await env.DB.prepare(
        "SELECT * FROM blog_posts ORDER BY id",
      ).all()).results,
    });
    const before = JSON.stringify(await snapshot());

    await applyD1Migrations(env.DB, redirectMigration);

    expect(JSON.stringify(await snapshot())).toBe(before);
    const redirects = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM redirect_map",
    ).first<{ count: number }>();
    expect(redirects?.count).toBe(0);
  });
});
