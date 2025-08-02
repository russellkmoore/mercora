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
  const startTime = Date.now();
  console.log(`📂 getCategoryProducts: Starting fetch for "${categorySlug}"`);
  
  const db = await getDbAsync();
  const dbConnectTime = Date.now();
  console.log(`📂 getCategoryProducts: DB connection took ${dbConnectTime - startTime}ms`);
  
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, categorySlug),
  });
  if (!category) return [];

  const categoryQueryTime = Date.now();
  console.log(`📂 getCategoryProducts: Category lookup took ${categoryQueryTime - dbConnectTime}ms`);

  const rows = await db
    .select()
    .from(products)
    .innerJoin(productCategories, eq(products.id, productCategories.productId))
    .where(eq(productCategories.categoryId, category.id))
    .limit(3); // Only fetch 3 products instead of 8

  const productsQueryTime = Date.now();
  console.log(`📂 getCategoryProducts: Products query took ${productsQueryTime - categoryQueryTime}ms, found ${rows.length} products`);

  // Use batch hydration with shared database connection for better performance
  const productRecords = rows.map((row) => row.products);
  const hydratedProducts = await hydrateProductsBatch(productRecords, db);
  
  const hydrationTime = Date.now();
  const totalTime = hydrationTime - startTime;
  console.log(`📂 getCategoryProducts: Hydration took ${hydrationTime - productsQueryTime}ms`);
  console.log(`📂 getCategoryProducts: Total time ${totalTime}ms for ${hydratedProducts.length} products`);
  
  return hydratedProducts;
}
