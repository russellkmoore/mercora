import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { getDbAsync } from "@/lib/db";
import { eq } from "drizzle-orm";
import { products } from "@/lib/db/schema/products";
import { productCategories } from "@/lib/db/schema/productCategories";

import type { Product } from "@/lib/types/product";
import type { Category } from "@/lib/types/category";

import { hydrateProduct, hydrateProductsBatch } from "./product";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
});

export async function hydrateCategory(
  category: typeof categories.$inferSelect
): Promise<Category> {
  const db = await getDbAsync();
  const products = await getCategoryProducts(category.slug);
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? undefined,
    products: products,
  };
}

export async function getCategoryProducts(
  categorySlug: string
): Promise<Product[]> {
  const db = await getDbAsync();
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, categorySlug),
  });
  if (!category) return [];

  const rows = await db
    .select()
    .from(products)
    .innerJoin(productCategories, eq(products.id, productCategories.productId))
    .where(eq(productCategories.categoryId, category.id));

  // Use batch hydration for better performance
  const productRecords = rows.map((row) => row.products);
  return hydrateProductsBatch(productRecords);
}
