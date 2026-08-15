import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  D1_DEPENDENCIES,
  buildD1ImportPlan,
  type MaterializedD1Input,
} from "@/scripts/shopify-migration/adapters/d1/plan";

function category(id = "shopify_category_one", media: string | null = null): NonNullable<MaterializedD1Input["categories"]>[number] {
  return { category: { id, name: `Name ${id}`, primary_image: media } } as never;
}

function product(productId = "shopify_product_one", variantId = "shopify_variant_one"): NonNullable<MaterializedD1Input["products"]>[number] {
  return {
    product: {
      id: productId,
      name: "Product",
      default_variant_id: variantId,
      categories: JSON.stringify(["shopify_category_one"]),
    },
    variants: [{
      id: variantId,
      product_id: productId,
      sku: `SKU-${variantId}`,
      option_values: "[]",
      price: '{"amount":100,"currency":"USD"}',
    }],
    inventory: [{
      id: `inventory_${variantId}`,
      sku_id: variantId,
      location_id: "default",
      quantities: '{"available":1}',
    }],
  } as never;
}

function page(clock = 100, title = "Page"): NonNullable<MaterializedD1Input["pages"]>[number] {
  return {
    sourceFingerprint: "fingerprint",
    page: {
      title, slug: "page", content: "<p>Safe</p>", excerpt: null,
      meta_title: title, meta_description: null, meta_keywords: null,
      template: "default", created_by: "importer", updated_by: "importer", version: 1,
      custom_css: null, custom_js: null, parent_id: null, created_at: clock, updated_at: clock,
    },
    initialVersion: {
      pageReference: { provider: "shopify", sourceFingerprint: "fingerprint", slug: "page" },
      record: {
        title, content: "<p>Safe</p>", excerpt: null,
        meta_title: title, meta_description: null, meta_keywords: null,
        version: 1, created_by: "importer",
      },
    },
    conflict: { strategy: "insert-only", key: "slug", onConflict: "skip" },
    media: [],
  } as never;
}

function blog(clock = 100, title = "Post"): NonNullable<MaterializedD1Input["blog"]> {
  return {
    categories: [{
      sourceFingerprint: "blog-fingerprint",
      record: { name: "News", slug: "news", created_at: clock, updated_at: clock },
      conflict: { strategy: "insert-only", key: "slug", onConflict: "reuse" },
    }] as never,
    records: [{
      sourceFingerprint: "post-fingerprint",
      categoryReference: { provider: "shopify", sourceFingerprint: "blog-fingerprint", slug: "news" },
      record: { title, slug: "post", author: "Author", tags: "[]", html: "<p>Safe</p>", reading_time: 1, created_at: clock, updated_at: clock },
      conflict: { strategy: "insert-only", key: "slug", onConflict: "skip" },
    }] as never,
  };
}

function sensitive() {
  return {
    customers: [{ id: "user_12345678", type: "person" }],
    orders: [{ order: {
      id: "shopify_order_one",
      customer_id: "user_12345678",
      total_amount: '{"amount":100,"currency":"USD"}',
      currency_code: "USD",
      items: JSON.stringify([{
        id: "shopify_order_item_one",
        product_id: "shopify_product_one",
        variant_id: "shopify_variant_one",
      }]),
    } }],
    reviews: [{ review: {
      id: "judge_me_review_one",
      product_id: "shopify_product_one",
      order_id: "shopify_order_one",
      order_item_id: "shopify_order_item_one",
      customer_id: "user_12345678",
      rating: 5,
      body: "Useful",
      status: "published",
      is_verified: false,
    } }],
  };
}

describe("D1 import plan", () => {
  it("emits dependency-ordered SQL and keeps auto-ID operations in one chunk", () => {
    const plan = buildD1ImportPlan({
      categories: [category()],
      products: [product()],
      pages: [page()],
      blog: blog(),
      ...sensitive(),
      redirects: [{ sourcePath: "/products/old", targetPath: "/product/new", statusCode: 301, entityType: "product" }],
    });
    const sql = plan.chunks.join("\n");
    const positions = [
      '"categories"', '"products"', '"product_variants"', '"inventory"', '"pages"',
      '"page_versions"', '"blog_categories"', '"blog_posts"', '"customers"', '"orders"',
      '"product_reviews"', '"redirect_map"',
    ].map((table) => sql.indexOf(`INSERT INTO ${table}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(sql).toContain('FROM "pages" WHERE "slug" = \'page\' AND changes() = 1');
    expect(sql).toContain('FROM "blog_categories" WHERE "slug" = \'news\'');
    expect(plan.counts).toMatchObject(Object.fromEntries(D1_DEPENDENCIES.map((dependency) => [dependency, 1])));
  });

  it("uses compare by default and enables overwrite only explicitly", () => {
    const normal = buildD1ImportPlan({ categories: [category()] }).chunks.join("");
    const overwrite = buildD1ImportPlan({ categories: [category()] }, { overwrite: true }).chunks.join("");
    expect(normal).toContain("CASE WHEN");
    expect(normal).toContain("ELSE NULL END");
    expect(overwrite).toContain("DO UPDATE SET");
    expect(overwrite).not.toContain("ELSE NULL END");
  });

  it("keeps page/blog insert-only rows stable across run clocks and aborts semantic drift", () => {
    const first = buildD1ImportPlan({ pages: [page(100)], blog: blog(100) }).chunks.join("\n");
    const second = buildD1ImportPlan({ pages: [page(200)], blog: blog(200) }).chunks.join("\n");
    const comparisons = (sql: string) => sql.split("\n").filter((line) => line.startsWith("UPDATE "));
    expect(comparisons(first)).toEqual(comparisons(second));
    expect(comparisons(first).join(" ")).not.toContain('"created_at" IS');
    expect(comparisons(buildD1ImportPlan({ pages: [page(200, "Changed")], blog: blog(200, "Changed") }).chunks.join("\n")))
      .not.toEqual(comparisons(first));
    expect(first).toContain('ELSE NULL END WHERE "slug"');
  });

  it("rejects an initial page version that cannot exactly represent the page snapshot", () => {
    const wrongVersion = page();
    (wrongVersion.initialVersion.record as { version: number }).version = 2;
    expect(() => buildD1ImportPlan({ pages: [wrongVersion] })).toThrow(/page snapshot contract/);

    const wrongActor = page();
    (wrongActor.initialVersion.record as { created_by: string }).created_by = "other";
    expect(() => buildD1ImportPlan({ pages: [wrongActor] })).toThrow(/page snapshot contract/);

    const wrongContent = page();
    (wrongContent.initialVersion.record as { content: string }).content = "<p>Other</p>";
    expect(() => buildD1ImportPlan({ pages: [wrongContent] })).toThrow(/page snapshot contract/);

    const unsupportedStyling = page();
    (unsupportedStyling.page as { custom_css: string | null }).custom_css = "body{}";
    expect(() => buildD1ImportPlan({ pages: [unsupportedStyling] })).toThrow(/page snapshot contract/);

    const unsupportedTemplate = page();
    (unsupportedTemplate.page as { template: string }).template = "alternate";
    expect(() => buildD1ImportPlan({ pages: [unsupportedTemplate] })).toThrow(/page snapshot contract/);
  });

  it("rejects unresolved or duplicated semantic references before execution", () => {
    const broken = product();
    (broken.variants[0] as { product_id: string }).product_id = "missing";
    expect(() => buildD1ImportPlan({ categories: [category()], products: [broken] })).toThrow(/Variant product/);
    expect(() => buildD1ImportPlan({ categories: [category(), category()] })).toThrow(/Duplicate category/);
    expect(() => buildD1ImportPlan({
      categories: [category()], products: [product()],
      reviews: [{ review: { id: "review", product_id: "shopify_product_one", order_id: "missing", customer_id: "missing", rating: 5, body: "x", status: "published" } }],
    })).toThrow(/Review product, order, or customer/);
  });

  it("binds review attribution to the exact planned purchase relation", () => {
    const base = () => ({ categories: [category()], products: [product()], ...sensitive() });
    const customerMismatch = base();
    customerMismatch.customers.push({ id: "user_87654321", type: "person" });
    customerMismatch.reviews[0].review.customer_id = "user_87654321";
    expect(() => buildD1ImportPlan(customerMismatch)).toThrow(/Review product, order, or customer/);

    const itemMismatch = base();
    itemMismatch.reviews[0].review.order_item_id = "arbitrary_existing_item";
    expect(() => buildD1ImportPlan(itemMismatch)).toThrow(/order-item and product provenance/);

    const productMismatch = base();
    productMismatch.products.push(product("shopify_product_two", "shopify_variant_two"));
    productMismatch.reviews[0].review.product_id = "shopify_product_two";
    productMismatch.reviews[0].review.is_verified = true;
    expect(() => buildD1ImportPlan(productMismatch)).toThrow(/order-item and product provenance/);

    const verifiedWithoutItem = base();
    verifiedWithoutItem.reviews[0].review.order_item_id = null as unknown as string;
    verifiedWithoutItem.reviews[0].review.is_verified = true;
    expect(() => buildD1ImportPlan(verifiedWithoutItem)).toThrow(/exact order-item/);
  });

  it("collects only bounded public media references for the apply gate", () => {
    const path = "/media/categories/shopify_category_one/1.jpg";
    const plan = buildD1ImportPlan({ categories: [category("shopify_category_one", JSON.stringify({ file: { url: path } }))] });
    expect(plan.requiredMediaPaths).toEqual([path]);
  });

  it("materializes redirect creation time as a stable unknown-source epoch", () => {
    const first = buildD1ImportPlan({
      redirects: [{ sourcePath: "/products/old", targetPath: "/product/new", statusCode: 301, entityType: "product" }],
    }).chunks;
    const second = buildD1ImportPlan({
      redirects: [{ sourcePath: "/products/old", targetPath: "/product/new", statusCode: 301, entityType: "product" }],
    }).chunks;
    expect(first).toEqual(second);
    expect(first.join("\n")).toContain('"created_at") VALUES (\'/products/old\', \'/product/new\', 301, \'product\', 0)');
  });

  it("keeps page insert/version/compare atomic when chunking", () => {
    const plan = buildD1ImportPlan({ pages: [page(), { ...page(), page: { ...page().page, slug: "second" }, initialVersion: { ...page().initialVersion, pageReference: { ...page().initialVersion.pageReference, slug: "second" } } } as never] }, {
      maxChunkBytes: 2048,
      maxChunkStatements: 4,
    });
    expect(plan.chunks).toHaveLength(2);
    expect(plan.chunks.every((chunk) => chunk.includes('INSERT INTO "pages"') && chunk.includes('INSERT INTO "page_versions"') && chunk.includes('UPDATE "pages"'))).toBe(true);
  });

  it("executes page/blog first-run, clock-only rerun, and changed-source conflict in SQLite", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL, excerpt TEXT, meta_title TEXT, meta_description TEXT, meta_keywords TEXT,
        template TEXT, created_by TEXT, updated_by TEXT, version INTEGER, custom_css TEXT, custom_js TEXT,
        parent_id INTEGER, created_at INTEGER, updated_at INTEGER
      );
      CREATE TABLE page_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER NOT NULL REFERENCES pages(id),
        title TEXT NOT NULL, content TEXT NOT NULL, excerpt TEXT, meta_title TEXT, meta_description TEXT,
        meta_keywords TEXT, version INTEGER NOT NULL, created_by TEXT NOT NULL
      );
      CREATE TABLE blog_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        created_at INTEGER, updated_at INTEGER
      );
      CREATE TABLE blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        author TEXT NOT NULL, tags TEXT NOT NULL, html TEXT NOT NULL, reading_time INTEGER NOT NULL,
        created_at INTEGER, updated_at INTEGER, category_id INTEGER REFERENCES blog_categories(id)
      );
    `);
    const execute = (clock: number, pageTitle = "Page", postTitle = "Post") => {
      const plan = buildD1ImportPlan({ pages: [page(clock, pageTitle)], blog: blog(clock, postTitle) });
      plan.chunks.forEach((chunk) => database.exec(chunk));
    };
    execute(100);
    execute(200);
    const validationPlan = buildD1ImportPlan({ pages: [page(200)], blog: blog(200) });
    for (const unit of validationPlan.validation) {
      expect(database.prepare(unit.sql).get()).toMatchObject({ expected_count: 1, actual_count: 1 });
    }
    expect(database.prepare("SELECT COUNT(*) AS count FROM pages").get()).toMatchObject({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM page_versions").get()).toMatchObject({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM blog_categories").get()).toMatchObject({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM blog_posts").get()).toMatchObject({ count: 1 });
    expect(() => execute(300, "Changed page", "Changed post")).toThrow(/NOT NULL/);
    expect(database.prepare("SELECT title FROM pages").get()).toMatchObject({ title: "Page" });
    database.close();
  });
});
