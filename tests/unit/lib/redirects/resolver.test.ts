import { describe, expect, it, vi } from "vitest";
import { resolveLegacyRedirect } from "@/lib/redirects/resolver";

describe("legacy redirect resolver", () => {
  it("looks up the exact pathname and preserves the request query", async () => {
    const lookup = vi.fn().mockResolvedValue({ targetPath: "/product/new", statusCode: 301 });
    const result = await resolveLegacyRedirect(
      "https://shop.example/products/old?utm_source=archive",
      lookup,
    );

    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith("/products/old");
    expect(result?.url.href).toBe("https://shop.example/product/new?utm_source=archive");
    expect(result?.statusCode).toBe(301);
  });

  it("does not guess when the exact map has no row", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    await expect(resolveLegacyRedirect("https://shop.example/products/unchanged", lookup))
      .resolves.toBeNull();
  });

  it("fails open when D1 is unavailable", async () => {
    const lookup = vi.fn().mockRejectedValue(new Error("binding unavailable"));
    await expect(resolveLegacyRedirect("https://shop.example/pages/about", lookup))
      .resolves.toBeNull();
  });

  it("skips D1 entirely for unrelated and malformed paths", async () => {
    const lookup = vi.fn();
    await expect(resolveLegacyRedirect("https://shop.example/product/current", lookup))
      .resolves.toBeNull();
    await expect(resolveLegacyRedirect("https://shop.example/products/%252e%252e/admin", lookup))
      .resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});
