import { describe, expect, it } from "vitest";
import {
  isLegacyRedirectLookupPath,
  validateRedirectCandidate,
} from "@/lib/redirects/policy";

describe("legacy redirect policy", () => {
  it.each([
    "/products/old-handle",
    "/collections/old-handle",
    "/pages/old-handle",
    "/blogs/news/old-handle",
    "/policies/refund-policy",
  ])("permits an exact canonical legacy path: %s", (pathname) => {
    expect(isLegacyRedirectLookupPath(pathname)).toBe(true);
  });

  it.each([
    "/product/current-handle",
    "/products/",
    "/products/../admin",
    "/products/%2e%2e/admin",
    "/products/old%2fadmin",
    "/products/old\\admin",
    "/products/old?next=/admin",
  ])("rejects a noncanonical lookup path: %s", (pathname) => {
    expect(isLegacyRedirectLookupPath(pathname)).toBe(false);
  });

  it("allows only internal permanent non-legacy targets", () => {
    expect(validateRedirectCandidate("/products/old", {
      targetPath: "/product/new",
      statusCode: 308,
    })).toEqual({ targetPath: "/product/new", statusCode: 308 });

    for (const targetPath of [
      "https://attacker.example/path",
      "//attacker.example/path",
      "/products/other",
      "/product/../admin",
      "/product/%2e%2e/admin",
      "/products/old",
    ]) {
      expect(validateRedirectCandidate("/products/old", { targetPath, statusCode: 301 })).toBeNull();
    }
    expect(validateRedirectCandidate("/products/old", {
      targetPath: "/product/new",
      statusCode: 302,
    })).toBeNull();
  });
});
