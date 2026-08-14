import { describe, expect, it } from "vitest";
import { normalizePageHtml } from "@/lib/cms/page-html";

describe("normalizePageHtml", () => {
  it("removes empty imported spacers and collapses empty wrappers", () => {
    expect(normalizePageHtml('<div class="spacer"><p>&nbsp;</p></div><p>Copy.</p>')).toBe("<p>Copy.</p>");
  });

  it("drops hidden/meta artifacts and strips inline styles", () => {
    const html = '<div style="display: none"></div><meta charset="UTF-8"><div style="text-align:center"><p>Copy.</p></div>';
    expect(normalizePageHtml(html)).toBe("<div><p>Copy.</p></div>");
  });

  it("promotes bold-only questions without promoting ordinary labels", () => {
    expect(normalizePageHtml("<p><strong>Does this work?</strong></p>")).toBe("<h2>Does this work?</h2>");
    expect(normalizePageHtml("<p><strong>Last Updated:</strong> Today</p>"))
      .toBe("<p><strong>Last Updated:</strong> Today</p>");
  });

  it("is idempotent", () => {
    const once = normalizePageHtml("<p><strong>Question?</strong></p><p>&nbsp;</p>");
    expect(normalizePageHtml(once)).toBe(once);
  });
});
