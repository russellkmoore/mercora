import { describe, expect, it } from "vitest";
import { resolveBlogExcerpt } from "@/lib/blog/excerpt";

describe("resolveBlogExcerpt", () => {
  it("returns an explicit excerpt verbatim, even when longer than the cap and a body is also supplied", () => {
    const longExcerpt = "x".repeat(200);
    const result = resolveBlogExcerpt({ excerpt: longExcerpt, html: "<p>Body text</p>" }, 160);
    expect(result).toBe(longExcerpt);
  });

  it("treats a null excerpt as absent and falls back to the body", () => {
    const result = resolveBlogExcerpt({ excerpt: null, html: "<p>Short body</p>" });
    expect(result).toBe("Short body");
  });

  it("treats an empty-string excerpt as absent and falls back to the body", () => {
    const result = resolveBlogExcerpt({ excerpt: "", html: "<p>Short body</p>" });
    expect(result).toBe("Short body");
  });

  it("treats a whitespace-only excerpt as absent and falls back to the body", () => {
    const result = resolveBlogExcerpt({ excerpt: "   \n\t  ", html: "<p>Short body</p>" });
    expect(result).toBe("Short body");
  });

  it("strips tags, decodes common entities, and collapses whitespace runs in the body fallback", () => {
    const html = "<p>Hello&nbsp;&amp;&nbsp;welcome</p>\n\n<p>to   the &lt;blog&gt; &quot;home&quot; page&#39;s intro</p>";
    const result = resolveBlogExcerpt({ excerpt: null, html });
    expect(result).toBe(`Hello & welcome to the <blog> "home" page's intro`);
  });

  it("returns fallback text whole, with no ellipsis, when at or under the cap", () => {
    const result = resolveBlogExcerpt({ excerpt: null, html: "<p>Short body under cap</p>" }, 160);
    expect(result).toBe("Short body under cap");
    expect(result.endsWith("…")).toBe(false);
  });

  it("cuts fallback text over the cap at the last word boundary and appends a single ellipsis", () => {
    const html = `<p>${"word ".repeat(60).trim()}</p>`;
    const result = resolveBlogExcerpt({ excerpt: null, html }, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, -1).endsWith(" ")).toBe(false);
  });

  it("hard-cuts a single unbroken word longer than the cap and appends the ellipsis", () => {
    const html = `<p>${"a".repeat(200)}</p>`;
    const result = resolveBlogExcerpt({ excerpt: null, html }, 40);
    expect(result).toBe(`${"a".repeat(40)}…`);
    expect(result.length).toBe(41);
  });

  it("returns an empty string when there is no excerpt and no body", () => {
    expect(resolveBlogExcerpt({ excerpt: null })).toBe("");
    expect(resolveBlogExcerpt({ excerpt: null, html: null })).toBe("");
    expect(resolveBlogExcerpt({ excerpt: null, html: "" })).toBe("");
    expect(resolveBlogExcerpt({ excerpt: null, html: "<p></p><span></span>" })).toBe("");
  });

  it("decodes &amp;lt; exactly once, to &lt;, never twice to <", () => {
    const result = resolveBlogExcerpt({ excerpt: null, html: "<p>&amp;lt;</p>" });
    expect(result).toBe("&lt;");
  });

  it("honours a custom maxLength rather than hardcoding the default", () => {
    const html = `<p>${"word ".repeat(20).trim()}</p>`;
    const shortCap = resolveBlogExcerpt({ excerpt: null, html }, 10);
    const longCap = resolveBlogExcerpt({ excerpt: null, html }, 160);
    expect(shortCap.length).toBeLessThanOrEqual(11);
    expect(shortCap.endsWith("…")).toBe(true);
    expect(longCap.endsWith("…")).toBe(false);
  });
});
