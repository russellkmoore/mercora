import { describe, expect, it } from "vitest";
import { parsePageHtml, slugifyHeading } from "@/lib/cms/page-sections";

describe("page section parsing", () => {
  it("creates unique stable anchors for repeated headings", () => {
    expect(slugifyHeading("Shipping & Returns!")).toBe("shipping-returns");
    const parsed = parsePageHtml("<h2>Returns</h2><p>A</p><h2>Returns</h2><p>B</p>");
    expect(parsed.sections.map(({ id }) => id)).toEqual(["returns", "returns-2"]);
  });

  it("preserves lead content and promotes only its first paragraph", () => {
    const parsed = parsePageHtml("<p>Intro.</p><p>More.</p><h2>One</h2><p>Body.</p>");
    expect(parsed.lede).toBe("Intro.");
    expect(parsed.lead).toBe("<p>More.</p>");
    expect(parsed.sections[0].html).toBe("<p>Body.</p>");
  });

  it("does not lose a body with no headings", () => {
    const parsed = parsePageHtml("<p>Only prose.</p>", { promoteLede: false });
    expect(parsed.sections).toEqual([]);
    expect(parsed.lead).toBe("<p>Only prose.</p>");
  });

  it("does not split nested headings into unbalanced fragments", () => {
    const parsed = parsePageHtml('<div class="wrap"><h2>Nested</h2><p>Body.</p></div>', { promoteLede: false });
    expect(parsed.sections).toEqual([]);
    expect(parsed.lead).toContain("<div");
  });

  it("extracts guide specs, callouts, and generic product references", () => {
    const parsed = parsePageHtml(
      '<h2>Setup</h2><ul class="specs compact"><li>Fast</li></ul>' +
      '<blockquote>Remember this.</blockquote><figure class="product"><a href="/product/widget">Widget</a></figure><p>Body.</p>',
    );
    expect(parsed.sections[0]).toMatchObject({
      specs: ["Fast"], callouts: ["Remember this."], productSlug: "widget", html: "<p>Body.</p>",
    });
  });

  it("supports legacy blend markup without requiring it", () => {
    const parsed = parsePageHtml('<h2>Setup</h2><figure class="blend"><a href="/product/widget">Widget</a></figure>');
    expect(parsed.sections[0].productSlug).toBe("widget");
  });

  it("keeps unresolved and additional product figures in authored content", () => {
    const parsed = parsePageHtml(
      '<h2>Setup</h2><figure class="product"><a href="/product/one">One</a></figure>' +
      '<figure class="product"><a href="/product/two">Two</a></figure>' +
      '<figure class="product"><a href="https://example.test">External</a></figure>',
    );
    expect(parsed.sections[0].productSlug).toBe("one");
    expect(parsed.sections[0].html).toContain("/product/two");
    expect(parsed.sections[0].html).toContain("example.test");
  });

  it("does not extract conventions for templates that cannot render them", () => {
    const parsed = parsePageHtml(
      '<h2>Terms</h2><ul class="specs"><li>Keep</li></ul><blockquote>Keep this too.</blockquote>',
      { extractConventions: false },
    );
    expect(parsed.sections[0].html).toContain("<ul");
    expect(parsed.sections[0].html).toContain("<blockquote>");
  });

  it("lifts legal update labels only when requested", () => {
    const html = "<p><strong>Last Updated:</strong> 2026-08-13</p><p>Policy.</p>";
    expect(parsePageHtml(html).updatedLabel).toBe("Last Updated: 2026-08-13");
    expect(parsePageHtml(html, { liftUpdatedLabel: false, promoteLede: false }).lead).toContain("Last Updated");
  });
});
