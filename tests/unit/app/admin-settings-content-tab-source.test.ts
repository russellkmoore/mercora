import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Source-contract test for the Content tab in app/admin/settings/page.tsx
 * (16-04, T-16-33/T-16-34). This is a large client component wired to
 * Clerk-gated fetches with no jsdom/@testing-library in this project's test
 * dependencies (06-REVIEW WR-03 precedent, mirrored by
 * tests/unit/app/admin-layout-switches-source.test.ts's own "source wiring"
 * describe block) — what needs pinning here is the save-batch's shape,
 * which is a property of the source, not of a render.
 */
describe("Content tab in app/admin/settings/page.tsx — save-batch contract", () => {
  const page = () => source("app/admin/settings/page.tsx");

  it("still saves every pre-existing category's exact key count — a dropped entry fails here", () => {
    const p = page();
    const countOf = (category: string) =>
      (p.match(new RegExp(`category: '${category}'`, "g")) ?? []).length;

    expect(countOf("system")).toBe(3);
    expect(countOf("store")).toBe(3);
    expect(countOf("shipping")).toBe(2);
    expect(countOf("refund")).toBe(6);
    expect(countOf("promotions")).toBe(5);
    expect(countOf("social")).toBe(6);
  });

  it("saves exactly five content.* entries", () => {
    const p = page();
    expect((p.match(/category: 'content'/g) ?? []).length).toBe(5);
  });

  it("renders exactly one Content tab guard", () => {
    const p = page();
    expect((p.match(/activeTab === "content"/g) ?? []).length).toBe(1);
  });

  it("imports the count bounds, label/heading bounds and placement enum from lib/content/settings rather than retyping them", () => {
    const p = page();
    expect(p).toContain('from "@/lib/content/settings"');
    expect(p).toContain("BLOG_HOME_BLOCK_COUNT_MIN");
    expect(p).toContain("BLOG_HOME_BLOCK_COUNT_MAX");
    expect(p).toContain("BLOG_HOME_BLOCK_PLACEMENTS");
    expect(p).toContain("BLOG_NAV_LABEL_MAX_LENGTH");
    expect(p).toContain("BLOG_HOME_BLOCK_HEADING_MAX_LENGTH");
  });

  it("never retypes the count bounds or placement literals anywhere in the file", () => {
    const p = page();
    expect(p).not.toMatch(/min="1"/);
    expect(p).not.toMatch(/max="6"/);
    expect(p).not.toMatch(/"before_featured"/);
    expect(p).not.toMatch(/"after_featured"/);
  });

  it("uses the admin dashboard's own fixed palette in the Content tab block, not storefront token classes", () => {
    const p = page();
    const blockStart = p.indexOf('{activeTab === "content" && (');
    const blockEnd = p.indexOf('{/* Social Media Settings */}');
    expect(blockStart).toBeGreaterThan(-1);
    expect(blockEnd).toBeGreaterThan(blockStart);
    const block = p.slice(blockStart, blockEnd);
    expect(block).toContain("bg-neutral-800");
    expect(block).toContain("border-neutral-700");
    expect(block).toContain("bg-neutral-700");
  });
});
