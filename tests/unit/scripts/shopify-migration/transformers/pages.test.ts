import { describe, expect, it } from "vitest";

import { transformPages } from "@/scripts/shopify-migration/transformers/pages";

const options = {
  generatedAt: "2026-08-14T12:00:00.000Z",
  actorId: "migration-operator",
};

describe("page transform", () => {
  it("sanitizes content, rewrites inline media, and plans an insert-only initial version", () => {
    const result = transformPages([{
      id: 100,
      title: "Care Guide",
      handle: "care-guide",
      body_html: '<h2>Care</h2><img src="https://cdn.example.test/care.png"><script>alert(1)</script><a href="javascript:bad()">bad</a>',
      published_at: "2024-04-03T02:01:00Z",
      created_at: "2024-04-01T00:00:00Z",
      updated_at: "2024-04-02T00:00:00Z",
    }], options);

    const transformed = result.records[0];
    expect(transformed.page.content).toContain('/media/pages/');
    expect(transformed.page.content).not.toContain("<script");
    expect(transformed.page.content).not.toContain("javascript:");
    expect(transformed.page.status).toBe("published");
    expect(transformed.page.published_at).toBe(1_712_109_660);
    expect(transformed.media[0]).toMatchObject({ contentType: "image/png", role: "page-inline" });
    expect(transformed.initialVersion.record.content).toBe(transformed.page.content);
    expect(transformed.initialVersion.record.version).toBe(1);
    expect(transformed.conflict).toEqual({ strategy: "insert-only", key: "slug", onConflict: "skip" });
    expect(transformed.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects current reserved storefront slugs and duplicates", () => {
    const source = { id: 1, title: "Reserved", handle: "checkout", body_html: "" };
    const duplicate = { id: 3, title: "Duplicate", handle: "safe-page", body_html: "" };
    const result = transformPages([
      source,
      { id: 2, title: "Safe", handle: "safe-page", body_html: "" },
      duplicate,
    ], options);

    expect(result.records).toHaveLength(1);
    expect(result.skipped.map(({ reason }) => reason)).toEqual([
      "Page slug is reserved by the storefront: checkout",
      "Duplicate page slug: safe-page",
    ]);
  });

  it("fails closed to draft when publication time is absent or invalid", () => {
    const result = transformPages([{
      id: 10,
      title: "Draft",
      handle: "draft",
      body_html: "<p>Draft</p>",
      published_at: "not-a-date",
    }], options);
    expect(result.records[0].page).toMatchObject({ status: "draft", published_at: null });
    expect(result.warnings[0]).toContain("imported as draft");
  });
});
