/**
 * Deterministic product fixtures for category variant render tests.
 *
 * Every field is a literal — never date-derived or random — so the
 * pre-extraction recording (category-grid3-parity.test.ts) stays
 * reproducible across every run and every machine.
 */

import type { Product } from "@/lib/types";

/**
 * Three products exercising the fields ProductCard (and, from Task 3
 * onward, CategoryList) branch on:
 *  - a product with a rating and an active sale (compare_at_price > price)
 *  - a product with no rating and no price on its default variant
 *  - a product whose default variant is not available for sale
 */
export function categoryProductsFixture(): Product[] {
  return [
    {
      id: "product-rated-sale",
      name: "Volt Trail Jacket",
      description: "A weatherproof jacket built for the trail.",
      slug: "volt-trail-jacket",
      status: "active",
      default_variant_id: "variant-rated-sale",
      primary_image: { url: "products/volt-trail-jacket.jpg" },
      rating: {
        average: 4.5,
        count: 12,
        // Midday UTC so the rendered "Updated Jan 14, 2026" is the same in every
        // timezone (a midnight timestamp formatted as Jan 14 in PDT and Jan 15 in CI's UTC).
        lastPublishedAt: "2026-01-14T12:00:00.000Z",
      },
      variants: [
        {
          id: "variant-rated-sale",
          sku: "SKU-RATED-SALE",
          option_values: [],
          price: { amount: 8999, currency: "USD" },
          compare_at_price: { amount: 12999, currency: "USD" },
          available_for_sale: true,
        },
      ],
    },
    {
      id: "product-no-rating-no-price",
      name: "Volt Base Layer",
      description: "A simple, packable base layer.",
      slug: "volt-base-layer",
      status: "active",
      default_variant_id: "variant-no-price",
      variants: [
        {
          id: "variant-no-price",
          sku: "SKU-NO-PRICE",
          option_values: [],
          available_for_sale: true,
        },
      ],
    },
    {
      id: "product-unavailable",
      name: "Volt Expedition Pack",
      description: "A large-capacity pack for multi-day trips.",
      slug: "volt-expedition-pack",
      status: "active",
      default_variant_id: "variant-unavailable",
      variants: [
        {
          id: "variant-unavailable",
          sku: "SKU-UNAVAILABLE",
          option_values: [],
          price: { amount: 15999, currency: "USD" },
          available_for_sale: false,
        },
      ],
    },
  ] as unknown as Product[];
}

/** The empty-collection case every category variant must render distinctly. */
export function emptyProductsFixture(): Product[] {
  return [];
}
