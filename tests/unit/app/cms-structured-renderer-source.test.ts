import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("structured CMS renderer contracts", () => {
  it("keeps the renderer server-side and isolates custom assets", () => {
    const renderer = source("app/[slug]/PageRenderer.tsx");
    expect(renderer).not.toContain('"use client"');
    expect(renderer).toContain("sanitizePageHtmlServer");
    expect(renderer).toContain("<CustomPageAssets");
    expect(source("components/pages/CustomPageAssets.tsx")).toContain('"use client"');
  });

  it("does not contain downstream store content", () => {
    const files = [
      "app/[slug]/PageRenderer.tsx", "lib/cms/page-template.ts", "components/pages/PageCta.tsx",
      "components/pages/SectionCard.tsx",
    ].map(source).join("\n");
    expect(files).not.toMatch(/BeauTeas|Chai|Calendula|outdoor gear|Shop this blend/i);
  });
});
