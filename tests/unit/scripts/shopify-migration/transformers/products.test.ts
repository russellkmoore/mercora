import { describe, expect, it } from "vitest";

import type { ShopifyCollection, ShopifyProduct } from "@/scripts/shopify-migration/lib/types";
import { transformCollections } from "@/scripts/shopify-migration/transformers/categories";
import {
  collectionMembershipByProduct,
  transformProducts,
} from "@/scripts/shopify-migration/transformers/products";

const generatedAt = "2026-08-14T12:00:00.000Z";

function product(price: string, currencyHandle = "example"): ShopifyProduct {
  return {
    id: 10,
    title: "Configurable product",
    body_html: "<p>A <strong>useful</strong> item.</p>",
    handle: currencyHandle,
    vendor: "Example Vendor",
    product_type: "Example Type",
    tags: "New, Featured, new",
    status: "active",
    published_at: "2025-01-02T03:04:05Z",
    created_at: "2025-01-01T03:04:05Z",
    updated_at: "2025-01-03T03:04:05Z",
    options: [{ id: 21, name: "Size", values: ["Small", "Large"] }],
    images: [{ id: 31, src: "https://cdn.example.test/image.JPG?width=800", alt: "Front", width: 800, height: 600 }],
    variants: [{
      id: 41,
      sku: "SKU-ONE",
      price,
      inventory_quantity: -5,
      inventory_policy: "continue",
      inventory_management: "shopify",
      requires_shipping: true,
      taxable: true,
      option1: "Small",
      image_id: 31,
    }],
  };
}

describe("catalog transforms", () => {
  it.each([
    ["USD", "12.345", 1_235],
    ["JPY", "12.5", 13],
    ["KWD", "12.3456", 12_346],
    ["BHD", "1.2345", 1_235],
  ])("uses Money.fromMajor semantics for %s", (currency, major, minor) => {
    const result = transformProducts([product(major, `product-${currency.toLowerCase()}`)], {
      currency,
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
    });

    expect(JSON.parse(result.records[0].variants[0].price)).toEqual({ amount: minor, currency });
  });

  it("produces stable schema-aligned product, variant, inventory, option, and media plans", () => {
    const source = product("19.99");
    const collection: ShopifyCollection = {
      id: 50,
      title: "Featured",
      handle: "featured",
      published_at: "2025-01-01T00:00:00Z",
      products_count: 1,
    };
    const categories = transformCollections([collection], { generatedAt });
    const memberships = collectionMembershipByProduct(
      [{ id: 60, collection_id: 50, product_id: 10 }],
      categories.idMap,
    );
    const options = {
      currency: "USD",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical" as const,
      categoryIdsByProduct: memberships,
    };
    const first = transformProducts([source], options);
    const second = transformProducts([source], options);

    expect(first).toEqual(second);
    expect(first.skipped).toEqual([]);
    const transformed = first.records[0];
    expect(transformed.product.brand).toBe("Example Vendor");
    expect(transformed.product.tax_category).toBeNull();
    expect(transformed.product.fulfillment_type).toBe("physical");
    expect(JSON.parse(transformed.product.categories!)).toEqual([categories.records[0].category.id]);
    expect(JSON.parse(transformed.product.options!)[0]).toMatchObject({ name: "Size", values: ["Small", "Large"] });
    expect(JSON.parse(transformed.variants[0].option_values)).toEqual([
      { option_id: JSON.parse(transformed.product.options!)[0].id, value: "Small" },
    ]);
    expect(JSON.parse(transformed.variants[0].inventory)).toEqual({
      track_inventory: true,
      quantity: 0,
      allow_backorder: true,
    });
    expect(JSON.parse(transformed.inventory[0].quantities)).toEqual({ on_hand: 0, reserved: 0, available: 0 });
    expect(transformed.inventory[0].stock_status).toBe("backorder");
    expect(transformed.media[0]).toMatchObject({
      objectKey: expect.stringMatching(/^products\/[a-z0-9_]+\/1\.jpg$/),
      publicPath: expect.stringMatching(/^\/media\/products\//),
      contentType: "image/jpeg",
    });
    expect(JSON.parse(transformed.product.external_references)).toHaveProperty("shopify_fingerprint");
    expect(transformed.product.external_references).not.toContain('"10"');
  });

  it("rejects unsupported currencies, duplicate SKUs, bad prices, and duplicate slugs", () => {
    expect(() => transformProducts([product("1")], {
      currency: "ZZZ",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
    })).toThrow("Unsupported migration currency");

    const duplicateVariants = product("1");
    duplicateVariants.variants.push({ ...duplicateVariants.variants[0], id: 42 });
    const duplicateProduct = { ...product("2"), id: 11 };
    const result = transformProducts([duplicateVariants, duplicateProduct], {
      currency: "USD",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
    });
    expect(result.records[0].variants).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("Duplicate product slug");

    const bad = product("not-money", "bad-price");
    expect(transformProducts([bad], {
      currency: "USD",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
    }).skipped[0].reason).toBe("Product has no importable variants");
  });

  it("emits localized category records with stable media and fingerprints", () => {
    const result = transformCollections([{
      id: "gid://shopify/Collection/9",
      title: "Summer & More",
      handle: "summer-more",
      body_html: "<p>Seasonal <script>bad()</script> choices</p>",
      image: { src: "https://cdn.example.test/collection.webp", alt: "Seasonal" },
      published_at: null,
      updated_at: "bad-date",
    }], { generatedAt });

    expect(result.records[0].category).toMatchObject({
      name: JSON.stringify({ en: "Summer & More" }),
      slug: "summer-more",
      status: "inactive",
      updated_at: generatedAt,
    });
    expect(result.records[0].category.description).not.toContain("<script>");
    expect(result.records[0].media[0]).toMatchObject({ contentType: "image/webp" });
    expect([...result.idMap.keys()][0]).toMatch(/^[a-f0-9]{64}$/);
  });
});
