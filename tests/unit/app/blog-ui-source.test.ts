import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("public Blog UI contracts", () => {
  it("provides an accessible keyboard-native tag filter", () => {
    const index = source("components/blog/BlogIndex.tsx");
    expect(index).toContain('role="group"');
    expect(index).toContain('aria-label="Filter posts by tag"');
    expect(index).toContain("aria-pressed={tag === value}");
    expect(index).not.toContain("onKeyDown");
  });

  it("defensively sanitizes article HTML and script-escapes JSON-LD", () => {
    const detail = source("app/blog/[slug]/page.tsx");
    expect(detail).toContain("sanitizeRichHtmlServer(post.html");
    expect(detail).toContain('.replace(/</g, "\\\\u003c")');
    expect(detail).not.toContain("__html: post.html");
  });

  it("replaces the checked-in demo sitemap with a dynamic route", () => {
    expect(existsSync(join(process.cwd(), "public/sitemap.xml"))).toBe(false);
    const dynamic = source("app/sitemap.ts");
    expect(dynamic).toContain("getStoreConfig()");
    expect(dynamic).not.toMatch(/voltique\.russellkmoore|\/api\/mcp/i);
  });
});
