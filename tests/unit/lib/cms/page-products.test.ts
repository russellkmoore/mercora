import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/models/mach/products", () => ({ getProductsBySlugs: vi.fn() }));

import { resolveSectionProducts } from "@/lib/cms/page-products";
import { getProductsBySlugs } from "@/lib/models/mach/products";
import type { PageSection } from "@/lib/cms/page-sections";

const lookup = vi.mocked(getProductsBySlugs);
const section = (id: string, productSlug: string | null): PageSection => ({
  id, heading: id, html: "", specs: [], productSlug, callouts: [],
});
const product = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Widget",
  default_variant_id: "v1",
  primary_image: { file: { url: "/products/widget.jpg" } },
  variants: [{ id: "v1", price: { amount: 1800, currency: "USD" } }],
  ...overrides,
}) as never;

describe("structured page product resolver", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves every reference in a single batch", async () => {
    lookup.mockResolvedValue(new Map([["one", product()], ["two", product({ id: "p2" })]]));
    const result = await resolveSectionProducts([section("a", "one"), section("b", "two")]);
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith(["one", "two"]);
    expect(result.get("a")).toMatchObject({ name: "Widget", price: "$18.00", imageKey: "products/widget.jpg" });
  });

  it("does not query when the page has no product references", async () => {
    expect((await resolveSectionProducts([section("a", null)])).size).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("fails soft for lookup, image, name, and price problems", async () => {
    lookup.mockRejectedValueOnce(new Error("D1 unavailable"));
    await expect(resolveSectionProducts([section("a", "one")])).resolves.toEqual(new Map());

    lookup.mockResolvedValue(new Map([["one", product({ name: {}, primary_image: null, variants: [] })]]));
    expect((await resolveSectionProducts([section("a", "one")])).get("a")).toEqual({
      slug: "one", name: "one", price: null, imageKey: "/placeholder.svg",
    });
  });
});
