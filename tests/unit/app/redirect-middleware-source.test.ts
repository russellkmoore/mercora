import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("legacy redirect middleware integration", () => {
  it("uses the exact fail-open resolver and the typed redirect schema", () => {
    const source = readFileSync("middleware.ts", "utf8");
    expect(source).toContain("resolveLegacyRedirect(req.url");
    expect(source).toContain("isLegacyRedirectLookupPath(pathname)");
    expect(source).toContain("!isLegacyRedirectPath &&");
    expect(source).toContain("eq(redirectMap.sourcePath, sourcePath)");
    expect(source).toContain("NextResponse.redirect(redirect.url, redirect.statusCode)");
    expect(source).toContain('"/(products|collections|pages|blogs|policies)/(.*)"');
    expect(source).not.toMatch(/pathname\.startsWith\('\/products\/\'[\s\S]*?destination/);
  });
});
