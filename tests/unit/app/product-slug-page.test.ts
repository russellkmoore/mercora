import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(async () => ({ userId: null })) }));
vi.mock("@/lib/models", () => ({
  getProductBySlug: vi.fn(),
  getProductReviews: vi.fn(async () => []),
  getProductReviewEligibility: vi.fn(async () => ({ eligible: false })),
}));
vi.mock("@/lib/models/mach/product-serializer", () => ({
  toPublicProduct: vi.fn((product: { id: string }) => product),
}));
vi.mock("@/lib/recommendations", () => ({
  getRecommendationsForProduct: vi.fn(async () => []),
}));
vi.mock("@/lib/recommendations/user-context.server", () => ({
  buildServerUserContext: vi.fn(async () => ({})),
}));
vi.mock("@/lib/store-config", () => ({
  getStoreConfig: vi.fn(() => ({
    commerce: {
      features: { subscriptionAcquisition: false, subscriptionReconciliation: false },
      subscriptionTermsVersion: undefined,
    },
    urls: { terms: "https://example.test/terms" },
  })),
}));

import ProductPage from "@/app/product/[slug]/page";
import { getProductBySlug } from "@/lib/models";

const ACTIVE_PRODUCT = { id: "prod-1", status: "active" };

function render(slug: string) {
  return ProductPage({ params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  vi.mocked(getProductBySlug).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("product page", () => {
  it("throws NEXT_NOT_FOUND for an unknown product slug", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue(null as never);
    await expect(render("does-not-exist")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("throws NEXT_NOT_FOUND for a product whose status is not active", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue({ id: "prod-2", status: "draft" } as never);
    await expect(render("draft-product")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("passes an empty-string slug to getProductBySlug verbatim", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue(null as never);
    await expect(render("")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProductBySlug).toHaveBeenCalledWith("");
  });

  it("passes a whitespace-only slug to getProductBySlug verbatim", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue(null as never);
    await expect(render("   ")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getProductBySlug).toHaveBeenCalledWith("   ");
  });

  it("passes a mixed-case slug to getProductBySlug verbatim", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue(ACTIVE_PRODUCT as never);
    await render("Arctic-Pulse-Tool");
    expect(getProductBySlug).toHaveBeenCalledWith("Arctic-Pulse-Tool");
  });

  it("resolves without throwing for an active product and never calls notFound", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue(ACTIVE_PRODUCT as never);
    await expect(render("arctic-pulse-tool")).resolves.toBeTruthy();
  });

  it("awaits a real Promise for params rather than reading it synchronously", async () => {
    vi.mocked(getProductBySlug).mockResolvedValue(ACTIVE_PRODUCT as never);
    let resolveParams!: (value: { slug: string }) => void;
    const deferred = new Promise<{ slug: string }>((resolve) => {
      resolveParams = resolve;
    });
    const pending = ProductPage({ params: deferred });
    resolveParams({ slug: "arctic-pulse-tool" });
    await expect(pending).resolves.toBeTruthy();
    expect(getProductBySlug).toHaveBeenCalledWith("arctic-pulse-tool");
  });
});
