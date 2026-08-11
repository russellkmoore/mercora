import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

const { default: ProductCard } = await import("@/components/ProductCard");

function product(): Product {
  return {
    id: "product-1",
    name: "Volt Field Kit",
    description: "A compact demo product.",
    slug: "volt-field-kit",
    default_variant_id: "variant-1",
    variants: [
      {
        id: "variant-1",
        price: { amount: 1499, currency: "USD" },
        inventory: { quantity: 4 },
      },
    ],
  } as unknown as Product;
}

describe("storefront ProductCard links", () => {
  it("SSR renders one anchor while retaining the Learn more affordance", () => {
    const html = renderToStaticMarkup(React.createElement(ProductCard, { product: product() }));
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain("Learn more");
  });
});
