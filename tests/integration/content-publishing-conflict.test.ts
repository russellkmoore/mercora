import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";

describe("content-publishing migration conflict safety", () => {
  it("preserves a merchant-owned template with a newly registered name", async () => {
    const migrationIndex = env.TEST_MIGRATIONS.findIndex(
      ({ name }) => name === "0019_add_content_publishing.sql",
    );
    expect(migrationIndex).toBeGreaterThan(0);

    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, migrationIndex));
    await env.DB.prepare(`
      INSERT INTO page_templates
        (name, display_name, description, fields, default_content)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      "guide",
      "Merchant Guide",
      "Merchant-owned description",
      '{"merchant":true}',
      "<p>Merchant-owned content</p>",
    ).run();

    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(migrationIndex));

    const stored = await env.DB.prepare(`
      SELECT display_name, description, fields, default_content
      FROM page_templates WHERE name = 'guide'
    `).first<{
      display_name: string;
      description: string;
      fields: string;
      default_content: string;
    }>();
    expect(stored).toEqual({
      display_name: "Merchant Guide",
      description: "Merchant-owned description",
      fields: '{"merchant":true}',
      default_content: "<p>Merchant-owned content</p>",
    });
  });
});
