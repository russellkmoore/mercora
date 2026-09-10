import { and, eq } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { product_variants, products } from "@/lib/db/schema/products";
import { categories } from "@/lib/db/schema/category";
import { parseCmsTimestamp } from "@/lib/utils/cms-timestamp";
import { parseSitemapSlug } from "./sitemap-values";

export type SitemapCatalogEntry = {
  slug: string;
  updatedAt?: Date;
  /** The catalogue product type, so callers can apply the visibility predicate (D-08). */
  type?: string | null;
};

function entry(
  slugValue: unknown,
  timestamp: string | number | Date | null | undefined,
  type?: string | null,
): SitemapCatalogEntry | null {
  const slug = parseSitemapSlug(slugValue);
  if (!slug) return null;
  const updatedAt = parseCmsTimestamp(timestamp);
  return { slug, ...(updatedAt && { updatedAt }), type };
}

export async function getSitemapCatalogEntries(): Promise<{
  products: SitemapCatalogEntry[];
  categories: SitemapCatalogEntry[];
}> {
  const db = await getDbAsync();
  const [productRows, categoryRows] = await Promise.all([
    db.selectDistinct({ slug: products.slug, updatedAt: products.updated_at, type: products.type })
      .from(products)
      .innerJoin(product_variants, and(
        eq(product_variants.product_id, products.id),
        eq(product_variants.status, "active"),
      ))
      .where(eq(products.status, "active")),
    db.select({ slug: categories.slug, updatedAt: categories.updatedAt })
      .from(categories).where(eq(categories.status, "active")),
  ]);
  return {
    products: productRows.map((row) => entry(row.slug, row.updatedAt, row.type)).filter((value): value is SitemapCatalogEntry => value !== null),
    categories: categoryRows.map((row) => entry(row.slug, row.updatedAt)).filter((value): value is SitemapCatalogEntry => value !== null),
  };
}
