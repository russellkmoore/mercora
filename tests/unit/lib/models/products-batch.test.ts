import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDbAsync: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDbAsync: mocks.getDbAsync }));

import { getProductsBySlugs } from "@/lib/models/mach/products";

describe("getProductsBySlugs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbAsync.mockResolvedValue({ select: mocks.select });
  });

  it("uses one product scan and one variant query for multiple unique slugs", async () => {
    const rows = [
      { id: "p1", slug: "one", status: "active", name: "One", default_variant_id: "v1" },
      { id: "p2", slug: "two", status: "active", name: "Two", default_variant_id: "v2" },
      { id: "p3", slug: "hidden", status: "draft", name: "Hidden" },
    ];
    const variants = [
      { id: "v1", product_id: "p1", sku: "ONE", price: '{"amount":1000,"currency":"USD"}', option_values: "[]", status: "active" },
      { id: "v2", product_id: "p2", sku: "TWO", price: { amount: 2000, currency: "USD" }, option_values: [], status: "active" },
    ];
    mocks.select
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue(rows) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(variants) }) });

    const result = await getProductsBySlugs(["one", "two", "one", "hidden"]);

    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect([...result.keys()]).toEqual(["one", "two"]);
    expect(result.get("one")?.variants?.[0].price).toEqual({ amount: 1000, currency: "USD" });
  });

  it("does no database work for an empty request", async () => {
    await expect(getProductsBySlugs([])).resolves.toEqual(new Map());
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
