import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const commerceFeatures = vi.hoisted(() => ({
  subscriptionAcquisition: false,
  subscriptionReconciliation: false,
  giftCardAcquisition: true,
  giftCardReconciliation: true,
}));

vi.mock("@/lib/store-config", () => ({
  getStoreConfig: vi.fn(() => ({
    commerce: {
      features: commerceFeatures,
      subscriptionTermsVersion: undefined,
    },
    urls: { terms: "https://example.test/terms" },
  })),
}));

import ProductPage from "@/app/product/[slug]/page";
import ProductDisplay from "@/app/product/[slug]/ProductDisplay";
import { getProductBySlug } from "@/lib/models";

const ACTIVE_PRODUCT = { id: "prod-1", status: "active" };
const GIFT_CARD_PRODUCT = { id: "prod-gift", status: "active", type: "gift_card" };

function render(slug: string) {
  return ProductPage({ params: Promise.resolve({ slug }) });
}

/** Walks the returned element tree to find ProductDisplay's own props (identity match on type). */
function findProductDisplayProps(node: unknown): Record<string, unknown> | undefined {
  if (node == null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProductDisplayProps(child);
      if (found) return found;
    }
    return undefined;
  }
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === ProductDisplay) return element.props;
  if (element.props?.children) return findProductDisplayProps(element.props.children);
  return undefined;
}

beforeEach(() => {
  vi.mocked(getProductBySlug).mockReset();
  commerceFeatures.giftCardAcquisition = true;
  commerceFeatures.giftCardReconciliation = true;
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

describe("gift-card flag states (GCF-01, GCF-03, D-07, D-10)", () => {
  it("passes giftCardSalesDisabled=false to ProductDisplay with sell on and honor on", async () => {
    commerceFeatures.giftCardAcquisition = true;
    commerceFeatures.giftCardReconciliation = true;
    vi.mocked(getProductBySlug).mockResolvedValue(GIFT_CARD_PRODUCT as never);
    const element = await render("gift-card");
    const props = findProductDisplayProps(element);
    expect(props?.giftCardSalesDisabled).toBe(false);
  });

  it("passes giftCardSalesDisabled=true to ProductDisplay with sell off and honor on", async () => {
    commerceFeatures.giftCardAcquisition = false;
    commerceFeatures.giftCardReconciliation = true;
    vi.mocked(getProductBySlug).mockResolvedValue(GIFT_CARD_PRODUCT as never);
    const element = await render("gift-card");
    const props = findProductDisplayProps(element);
    expect(props?.giftCardSalesDisabled).toBe(true);
  });

  it("throws NEXT_NOT_FOUND for the gift-card product with both flags off", async () => {
    commerceFeatures.giftCardAcquisition = false;
    commerceFeatures.giftCardReconciliation = false;
    vi.mocked(getProductBySlug).mockResolvedValue(GIFT_CARD_PRODUCT as never);
    await expect(render("gift-card")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("leaves a non-gift product unaffected with both flags off", async () => {
    commerceFeatures.giftCardAcquisition = false;
    commerceFeatures.giftCardReconciliation = false;
    vi.mocked(getProductBySlug).mockResolvedValue(ACTIVE_PRODUCT as never);
    await expect(render("arctic-pulse-tool")).resolves.toBeTruthy();
  });
});

describe("product page identifies gift cards by type, never by slug (T-13-11)", () => {
  it("compares product.type to GIFT_CARD_PRODUCT_TYPE and never a slug literal", () => {
    const source = readFileSync(join(process.cwd(), "app/product/[slug]/page.tsx"), "utf8");
    expect(source).toMatch(/storedProduct\.type === GIFT_CARD_PRODUCT_TYPE/);
    expect(source).not.toMatch(/slug\s*===?\s*["'`]gift-card["'`]/);
    expect(source).not.toMatch(/["'`]gift-card["'`]\s*===?\s*/);
  });
});
