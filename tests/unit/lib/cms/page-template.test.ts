import { describe, expect, it } from "vitest";
import { resolveTemplate, shouldShowRail } from "@/lib/cms/page-template";

const context = {
  storeName: "Example Store",
  assistantName: "Helper",
  supportEmail: "help@example.test",
  privacyUrl: "/privacy",
  termsUrl: "/terms",
  returnsUrl: "/returns",
};

describe("page template registry", () => {
  it("maps known templates and safely falls back for inherited object keys", () => {
    expect(resolveTemplate("guide", context).kind).toBe("guide");
    expect(resolveTemplate("faq", context).kind).toBe("faq");
    expect(resolveTemplate("constructor", context).kind).toBe("story");
    expect(resolveTemplate(undefined, context).kind).toBe("story");
  });

  it("derives merchant-facing actions from configured identity and URLs", () => {
    const guide = resolveTemplate("guide", context);
    expect(guide.cta?.body).toContain("Example Store");
    expect(guide.cta?.actions).toContainEqual(expect.objectContaining({ label: "Ask Helper" }));
    const legal = resolveTemplate("legal", context);
    expect(legal.cta?.policyLinks.map(({ href }) => href)).toEqual(["/returns", "/privacy", "/terms"]);
  });

  it("contains no inherited demo-store product/category copy", () => {
    const serialized = JSON.stringify(["guide", "faq", "legal", "contact", "story"].map((name) => resolveTemplate(name, context)));
    expect(serialized).not.toMatch(/Volt|Chai|tea|Calendula|outdoor/i);
  });

  it("freezes the returned registry and only shows useful rails", () => {
    const guide = resolveTemplate("guide", context);
    expect(Object.isFrozen(guide)).toBe(true);
    expect(Object.isFrozen(guide.cta?.actions)).toBe(true);
    expect(shouldShowRail(guide, 2)).toBe(false);
    expect(shouldShowRail(guide, 3)).toBe(true);
    expect(shouldShowRail(resolveTemplate("story", context), 5)).toBe(false);
  });
});
