import { describe, expect, it } from "vitest";
import { parseSitemapSlug } from "@/lib/seo/sitemap-values";

describe("sitemap catalog slug projection", () => {
  it("accepts plain and localized slugs", () => {
    expect(parseSitemapSlug("plain-slug")).toBe("plain-slug");
    expect(parseSitemapSlug('{"en-US":"localized-slug"}')).toBe("localized-slug");
  });

  it("drops malformed and unsafe URL segments", () => {
    expect(parseSitemapSlug('{"en-US":')).toBeNull();
    expect(parseSitemapSlug("../admin")).toBeNull();
    expect(parseSitemapSlug("space slug")).toBeNull();
    expect(parseSitemapSlug(null)).toBeNull();
  });
});
