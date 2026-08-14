import { describe, expect, it } from "vitest";

import {
  MAX_SQL_TEXT_BYTES,
  escapedSqlUtf8Bytes,
} from "@/scripts/shopify-migration/transformers/_shared";
import { transformPages } from "@/scripts/shopify-migration/transformers/pages";

const options = {
  generatedAt: "2026-08-14T12:00:00.000Z",
  actorId: "migration-operator",
  allowedMediaHosts: ["cdn.shopify.com"],
};

describe("page transform", () => {
  it("sanitizes content, rewrites inline media, and plans an insert-only initial version", () => {
    const result = transformPages([{
      id: 100,
      title: "Care Guide",
      handle: "care-guide",
      body_html: '<h2>Care</h2><img src="https://cdn.shopify.com/care.png"><script>alert(1)</script><a href="javascript:bad()">bad</a>',
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
    const source = { id: 1, title: "Reserved", handle: "checkout", body_html: "<p>Reserved</p>" };
    const duplicate = { id: 3, title: "Duplicate", handle: "safe-page", body_html: "<p>Duplicate</p>" };
    const result = transformPages([
      source,
      { id: 2, title: "Safe", handle: "safe-page", body_html: "<p>Safe</p>" },
      duplicate,
    ], options);

    expect(result.records).toEqual([]);
    expect(result.skipped.map(({ reason }) => reason)).toEqual(expect.arrayContaining([
      "Page slug is reserved by the storefront: checkout",
      "Ambiguous duplicate page slug: safe-page",
      "Ambiguous duplicate page slug: safe-page",
    ]));
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

  it("keeps persisted rows identical across run clocks when source timestamps are unavailable", () => {
    const source = { id: 11, title: "Stable", handle: "stable", body_html: "<p>Stable</p>" };
    const first = transformPages([source], { ...options, generatedAt: "2026-01-01T00:00:00Z" });
    const second = transformPages([source], { ...options, generatedAt: "2027-01-01T00:00:00Z" });
    expect(first.records).toEqual(second.records);
    expect(first.records[0].page).toMatchObject({ created_at: 0, updated_at: 0 });
    expect(first.records[0].initialVersion.record.created_at).toBe(0);
  });

  it("rewrites only exact allowlisted media hosts and strips every unsafe inline source", () => {
    const result = transformPages([{
      id: 20,
      title: "Media",
      handle: "media",
      body_html: [
        '<img alt="allowed" src="https://CDN.Shopify.Com/ok.webp">',
        '<img alt="suffix" src="https://cdn.shopify.com.evil/bad.png">',
        '<img alt="credentials" src="https://user@cdn.shopify.com/bad.png">',
        '<img alt="port" src="https://cdn.shopify.com:8443/bad.png">',
        '<img alt="ip" src="https://127.0.0.1/bad.png">',
        '<img alt="localhost" src="https://localhost/bad.png">',
        '<img alt="javascript" src="javascript:alert(1)">',
      ].join(""),
    }], { ...options, allowedMediaHosts: ["CDN.Shopify.Com"] });

    expect(result.records[0].media).toHaveLength(1);
    expect(result.records[0].media[0]).toMatchObject({
      sourceHost: "cdn.shopify.com",
      sourceUrl: "https://cdn.shopify.com/ok.webp",
    });
    expect(result.records[0].page.content.match(/\bsrc=/gu)).toHaveLength(1);
    expect(result.records[0].page.content).not.toContain('src="https://');
    expect(result.records[0].page.content).not.toContain("javascript:");
    expect(result.records[0].page.content).not.toContain("cdn.shopify.com.evil");
    expect(result.records[0].page.content).not.toContain("https://user@cdn.shopify.com/bad.png");
  });

  it.each([
    "localhost",
    "sub.localhost",
    "127.0.0.1",
    "[::1]",
    "cdn.shopify.com:443",
    "user@cdn.shopify.com",
    "merchant-assets.example.test",
  ])("rejects unsafe media allowlist entry %s", (host) => {
    expect(() => transformPages([], { ...options, allowedMediaHosts: [host] })).toThrow(/allowed media hostname/);
  });

  it("accepts only the /cdn/ asset boundary on an exact myshopify host", () => {
    const result = transformPages([{
      id: 21,
      title: "Shop assets",
      handle: "shop-assets",
      body_html: [
        '<img alt="good" src="https://example-store.myshopify.com/cdn/good.png">',
        '<img alt="bad" src="https://example-store.myshopify.com/files/bad.png">',
      ].join(""),
    }], { ...options, allowedMediaHosts: ["example-store.myshopify.com"] });

    expect(result.records[0].media).toHaveLength(1);
    expect(result.records[0].media[0].sourceUrl).toBe("https://example-store.myshopify.com/cdn/good.png");
    expect(result.records[0].page.content).not.toContain("/files/bad.png");
  });

  it("rejects content beyond the current page persistence limits", () => {
    const result = transformPages([{
      id: 30,
      title: "x".repeat(501),
      handle: "too-large",
      body_html: "y".repeat(100_001),
    }], options);
    expect(result.records).toEqual([]);
    expect(result.skipped).toHaveLength(1);
  });

  it("bounds Wrangler SQL literals by escaped UTF-8 bytes", () => {
    expect(escapedSqlUtf8Bytes("'".repeat(MAX_SQL_TEXT_BYTES / 2))).toBe(MAX_SQL_TEXT_BYTES);
    expect(escapedSqlUtf8Bytes("😀".repeat(MAX_SQL_TEXT_BYTES / 4))).toBe(MAX_SQL_TEXT_BYTES);

    for (const content of [
      "'".repeat(MAX_SQL_TEXT_BYTES / 2 + 1),
      "😀".repeat(MAX_SQL_TEXT_BYTES / 4 + 1),
    ]) {
      const result = transformPages([{
        id: `oversized-${content.codePointAt(0)}`,
        title: "SQL bound",
        handle: `sql-bound-${content.codePointAt(0)}`,
        body_html: `<p>${content}</p>`,
      }], options);
      expect(result.records).toEqual([]);
      expect(result.skipped[0].reason).toContain("SQL-safe");
    }
  });

  it("resolves duplicate slugs identically for permuted provider input", () => {
    const sources = [
      { id: 300, title: "Three", handle: "same-page", body_html: "<p>Three</p>" },
      { id: 100, title: "One", handle: "same-page", body_html: "<p>One</p>" },
      { id: 200, title: "Two", handle: "other-page", body_html: "<p>Two</p>" },
    ];
    const first = transformPages(sources, options);
    const second = transformPages([...sources].reverse(), options);
    expect(first.records).toEqual(second.records);
    expect(first.records.map(({ page }) => page.slug)).toEqual(["other-page"]);
    expect(first.skipped).toHaveLength(2);
    expect(first.skipped.map(({ record, reason }) => [record.id, reason])).toEqual(
      second.skipped.map(({ record, reason }) => [record.id, reason]),
    );
  });
});
