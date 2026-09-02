import { describe, expect, it } from "vitest";
import {
  OTHER_ROUTE_TEMPLATE,
  ROUTE_TEMPLATES,
  toRouteTemplate,
} from "@/lib/observability/route-template";

describe("toRouteTemplate", () => {
  it("maps the home page", () => {
    expect(toRouteTemplate("/")).toBe("/");
  });

  it("maps two different product slugs to the same product template", () => {
    const a = toRouteTemplate("/product/arctic-pulse-tool");
    const b = toRouteTemplate("/product/anything-else");
    expect(a).toBe("/product/[slug]");
    expect(a).toBe(b);
  });

  it("maps each single-slug dynamic route to its own template", () => {
    expect(toRouteTemplate("/category/camping")).toBe("/category/[slug]");
    expect(toRouteTemplate("/blog/some-post")).toBe("/blog/[slug]");
    expect(toRouteTemplate("/order-status/ord_123")).toBe("/order-status/[id]");
  });

  it("maps each two-segment dynamic route to its own template", () => {
    expect(toRouteTemplate("/account/orders/ord_123")).toBe("/account/orders/[id]");
    expect(toRouteTemplate("/admin/orders/ord_123")).toBe("/admin/orders/[id]");
    expect(toRouteTemplate("/admin/blog/7")).toBe("/admin/blog/[id]");
    expect(toRouteTemplate("/admin/categories/7")).toBe("/admin/categories/[id]");
  });

  it("maps known static pages that carry commerce traffic", () => {
    expect(toRouteTemplate("/checkout")).toBe("/checkout");
    expect(toRouteTemplate("/cart")).toBe("/cart");
  });

  it("maps an unrecognized path to the fallback bucket", () => {
    expect(toRouteTemplate("/does/not/exist")).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps a dynamic route missing its slug to the fallback bucket", () => {
    expect(toRouteTemplate("/product")).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps a dynamic route with an extra segment to the fallback bucket", () => {
    expect(toRouteTemplate("/product/a/b")).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps the wrong case to the fallback bucket", () => {
    expect(toRouteTemplate("/PRODUCT/x")).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps a path with a traversal segment to the fallback bucket", () => {
    expect(toRouteTemplate("/admin/orders/../secrets")).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps undefined, null, empty string, and a value without a leading slash to the fallback bucket without throwing", () => {
    expect(toRouteTemplate(undefined)).toBe(OTHER_ROUTE_TEMPLATE);
    expect(toRouteTemplate(null)).toBe(OTHER_ROUTE_TEMPLATE);
    expect(toRouteTemplate("")).toBe(OTHER_ROUTE_TEMPLATE);
    expect(toRouteTemplate("product/x")).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps an absolute URL to the fallback bucket without parsing it", () => {
    expect(toRouteTemplate("https://evil.example.com/product/x")).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps a value longer than 512 characters to the fallback bucket", () => {
    expect(toRouteTemplate("/" + "a".repeat(600))).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("strips a query string before matching, so a known path with a query string still maps to its own template", () => {
    expect(toRouteTemplate("/product/x?utm_source=test")).toBe("/product/[slug]");
  });

  it("strips a fragment before matching, so a known path with a fragment still maps to its own template", () => {
    expect(toRouteTemplate("/checkout#summary")).toBe("/checkout");
  });

  it("maps a path containing a control character to the fallback bucket", () => {
    const withControlChar = "/product/" + String.fromCharCode(1) + "evil";
    expect(toRouteTemplate(withControlChar)).toBe(OTHER_ROUTE_TEMPLATE);
  });

  it("maps a percent-encoded slug to the same template as an unencoded one", () => {
    const encoded = toRouteTemplate("/product/foo%2Fbar");
    const plain = toRouteTemplate("/product/foobar");
    expect(encoded).toBe(plain);
    expect(encoded).toBe("/product/[slug]");
  });

  it("every exported template is pure ASCII and at most 96 bytes when UTF-8 encoded", () => {
    for (const template of ROUTE_TEMPLATES) {
      expect(template).toMatch(/^[\x20-\x7e]+$/);
      expect(new TextEncoder().encode(template).byteLength).toBeLessThanOrEqual(96);
    }
  });

  it("has at least 11 members including the fallback bucket", () => {
    expect(ROUTE_TEMPLATES.size).toBeGreaterThanOrEqual(11);
    expect(ROUTE_TEMPLATES.has(OTHER_ROUTE_TEMPLATE)).toBe(true);
  });

  it("is pure: calling it twice with the same input returns the same string", () => {
    expect(toRouteTemplate("/product/repeat")).toBe(toRouteTemplate("/product/repeat"));
  });

  it("never returns a value outside the exported set", () => {
    const inputs = [
      "/", "/product/x", "/category/y", "/blog/z", "/order-status/1",
      "/account/orders/1", "/admin/orders/1", "/admin/blog/1", "/admin/categories/1",
      "/checkout", "/cart", "/nope", undefined, null, "", "not-a-path",
    ];
    for (const input of inputs) {
      expect(ROUTE_TEMPLATES.has(toRouteTemplate(input))).toBe(true);
    }
  });
});
