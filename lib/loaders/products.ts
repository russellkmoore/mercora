import { getDbAsync } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  products,
  productCategories,
  categories,
} from "@/db/schema/product";

export async function getProductsByCategory(categorySlug: string) {
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

  return rows.map((row) => row.products);
}