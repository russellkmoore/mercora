import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/models", () => ({ getCategoryBySlug: vi.fn() }));
vi.mock("@/lib/models/mach/products", () => ({ getProductsByCategory: vi.fn() }));
vi.mock("@/lib/models/mach/product-serializer", () => ({
  toPublicProduct: vi.fn((product: { id: string }) => product),
}));

import CategoryPage from "@/app/category/[slug]/page";
import { getCategoryBySlug } from "@/lib/models";
import { getProductsByCategory } from "@/lib/models/mach/products";
import { toPublicProduct } from "@/lib/models/mach/product-serializer";

const CATEGORY = {
  id: "cat-1",
  name: "Camping",
  description: "Gear for the outdoors",
  primary_image: null,
};

function render(slug: string) {
  return CategoryPage({ params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  vi.mocked(getCategoryBySlug).mockReset();
  vi.mocked(getProductsByCategory).mockReset();
  vi.mocked(toPublicProduct).mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("category page", () => {
  it("throws NEXT_NOT_FOUND for an unknown category slug", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(null as never);
    await expect(render("does-not-exist")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("throws NEXT_NOT_FOUND when getCategoryBySlug resolves to undefined", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(undefined as never);
    await expect(render("also-missing")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("passes an empty-string slug through to the data layer verbatim and 404s", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(null as never);
    await expect(render("")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getCategoryBySlug).toHaveBeenCalledWith("");
  });

  it("passes a whitespace-only slug through to the data layer verbatim and 404s", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(null as never);
    await expect(render("   ")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getCategoryBySlug).toHaveBeenCalledWith("   ");
  });

  it("passes a percent-encoded slug through byte-for-byte with no normalization", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(CATEGORY as never);
    vi.mocked(getProductsByCategory).mockResolvedValue([]);
    await render("tools%2Fpower");
    expect(getCategoryBySlug).toHaveBeenCalledWith("tools%2Fpower");
  });

  it("passes a mixed-case slug through with no lowercasing", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(CATEGORY as never);
    vi.mocked(getProductsByCategory).mockResolvedValue([]);
    await render("Camping-Gear");
    expect(getCategoryBySlug).toHaveBeenCalledWith("Camping-Gear");
  });

  it("resolves without throwing and never calls notFound for a known slug", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(CATEGORY as never);
    vi.mocked(getProductsByCategory).mockResolvedValue([
      { id: "p1", status: "active" },
    ] as never);
    await expect(render("camping")).resolves.toBeTruthy();
  });

  it("still resolves when getProductsByCategory rejects, proving only the category-miss path 404s", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(CATEGORY as never);
    vi.mocked(getProductsByCategory).mockRejectedValue(new Error("db down"));
    await expect(render("camping")).resolves.toBeTruthy();
  });

  it("renders only active products, filtering out non-active ones", async () => {
    vi.mocked(getCategoryBySlug).mockResolvedValue(CATEGORY as never);
    vi.mocked(getProductsByCategory).mockResolvedValue([
      { id: "p1", status: "active" },
      { id: "p2", status: "draft" },
    ] as never);
    await render("camping");
    expect(toPublicProduct).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toPublicProduct).mock.calls[0][0]).toEqual({ id: "p1", status: "active" });
  });
});
