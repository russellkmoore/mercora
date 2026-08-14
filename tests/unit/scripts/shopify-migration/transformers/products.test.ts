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
    images: [{ id: 31, src: "https://cdn.shopify.com/image.JPG?width=800", alt: "Front", width: 800, height: 600 }],
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
      allowedMediaHosts: ["cdn.shopify.com"],
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
    const categories = transformCollections([collection], { generatedAt, allowedMediaHosts: ["cdn.shopify.com"] });
    const memberships = collectionMembershipByProduct(
      [{ id: 60, collection_id: 50, product_id: 10 }],
      categories.idMap,
    );
    const options = {
      currency: "USD",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical" as const,
      allowedMediaHosts: ["cdn.shopify.com"],
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
      requiredBeforePersistence: true,
    });
    expect(JSON.parse(transformed.product.external_references)).toHaveProperty("shopify_fingerprint");
    expect(transformed.product.external_references).not.toContain('"10"');
  });

  it("rejects unsupported currencies, duplicate SKUs, bad prices, and duplicate slugs", () => {
    expect(() => transformProducts([product("1")], {
      currency: "ZZZ",
      generatedAt,
      allowedMediaHosts: [],
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
    })).toThrow("Unsupported migration currency");

    const duplicateVariants = product("1");
    duplicateVariants.variants.push({ ...duplicateVariants.variants[0], id: 42 });
    const duplicateProduct = { ...product("2"), id: 11 };
    const result = transformProducts([duplicateVariants, duplicateProduct], {
      currency: "USD",
      generatedAt,
      allowedMediaHosts: [],
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
    });
    expect(result.records[0].variants).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("Duplicate product slug");

    const bad = product("not-money", "bad-price");
    expect(transformProducts([bad], {
      currency: "USD",
      generatedAt,
      allowedMediaHosts: [],
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
      image: { src: "https://cdn.shopify.com/collection.webp", alt: "Seasonal" },
      published_at: null,
      updated_at: "bad-date",
    }], { generatedAt, allowedMediaHosts: ["cdn.shopify.com"] });

    expect(result.records[0].category).toMatchObject({
      name: JSON.stringify({ en: "Summer & More" }),
      slug: "summer-more",
      status: "inactive",
      updated_at: "1970-01-01T00:00:00.000Z",
    });
    expect(result.records[0].category.description).not.toContain("<script>");
    expect(result.records[0].media[0]).toMatchObject({ contentType: "image/webp" });
    expect([...result.idMap.keys()][0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps catalog rows identical across run clocks when source timestamps are unavailable", () => {
    const source = product("19.99", "clock-stable");
    source.created_at = "invalid";
    source.updated_at = undefined;
    source.variants[0].created_at = undefined;
    source.variants[0].updated_at = "invalid";
    const base = {
      currency: "USD",
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical" as const,
      allowedMediaHosts: ["cdn.shopify.com"],
    };
    const first = transformProducts([source], { ...base, generatedAt: "2026-01-01T00:00:00Z" });
    const second = transformProducts([source], { ...base, generatedAt: "2027-01-01T00:00:00Z" });
    expect(first.records).toEqual(second.records);
    expect(first.records[0].product.created_at).toBe("1970-01-01T00:00:00.000Z");
    expect(first.records[0].variants[0].updated_at).toBe("1970-01-01T00:00:00.000Z");

    const collection = { id: 99, title: "Stable", handle: "stable", updated_at: "invalid" };
    const firstCategories = transformCollections([collection], { generatedAt: "2026-01-01T00:00:00Z", allowedMediaHosts: [] });
    const secondCategories = transformCollections([collection], { generatedAt: "2027-01-01T00:00:00Z", allowedMediaHosts: [] });
    expect(firstCategories.records).toEqual(secondCategories.records);
    expect(firstCategories.records[0].category.created_at).toBe("1970-01-01T00:00:00.000Z");
  });

  it("does not plan product or category media outside the explicit allowlist", () => {
    const deniedProduct = transformProducts([product("1")], {
      currency: "USD",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
      allowedMediaHosts: [],
    });
    expect(deniedProduct.records[0].media).toEqual([]);
    expect(deniedProduct.records[0].product.primary_image).toBeNull();

    const deniedCategory = transformCollections([{
      id: 1,
      title: "Denied image",
      handle: "denied-image",
      image: { src: "https://cdn.shopify.com/category.png" },
    }], { generatedAt, allowedMediaHosts: [] });
    expect(deniedCategory.records[0].media).toEqual([]);
    expect(deniedCategory.records[0].category.primary_image).toBeNull();
  });

  it("rejects oversized catalog fields and per-product collections", () => {
    const oversized = product("1");
    oversized.title = "x".repeat(501);
    oversized.images = Array.from({ length: 251 }, (_, index) => ({
      id: index,
      src: `https://cdn.shopify.com/${index}.png`,
    }));
    expect(transformProducts([oversized], {
      currency: "USD",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
      allowedMediaHosts: ["cdn.shopify.com"],
    }).records).toEqual([]);

    expect(transformCollections([{
      id: 1,
      title: "x".repeat(121),
      handle: "oversized",
    }], { generatedAt, allowedMediaHosts: [] }).records).toEqual([]);
  });

  it("does not reserve category slugs when an earlier record fails later validation", () => {
    const result = transformCollections([
      {
        id: 1,
        title: "Rejected",
        handle: "shared-category",
        body_html: `<p>${"界".repeat(11_000)}</p>`,
      },
      { id: 2, title: "Accepted", handle: "shared-category" },
    ], { generatedAt, allowedMediaHosts: [] });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].category.name).toBe(JSON.stringify({ en: "Accepted" }));
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("SQL-safe");
  });

  it("does not reserve product slugs or SKUs when an earlier product fails later validation", () => {
    const rejected = product("1.00", "shared-product");
    rejected.id = 100;
    rejected.body_html = `<p>${"😀".repeat(21_000)}</p>`;
    const accepted = product("2.00", "shared-product");
    accepted.id = 101;
    accepted.variants[0].id = 102;

    const result = transformProducts([rejected, accepted], {
      currency: "USD",
      generatedAt,
      inventoryLocationId: "warehouse-main",
      fulfillmentType: "physical",
      allowedMediaHosts: ["cdn.shopify.com"],
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].product.name).toBe("Configurable product");
    expect(result.records[0].variants[0].sku).toBe("SKU-ONE");
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("SQL-safe");
  });
});
