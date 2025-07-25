import { getDbAsync } from "@/lib/db";
import { eq } from "drizzle-orm";
import { categories } from "@/lib/db/schema";
import type { Category } from "@/lib/types/category";
import { getCategoryProducts } from "../models/category";

export async function getCategories(): Promise<Category[]> {
  const db = await getDbAsync();
  const rows = await db.select().from(categories);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    heroImageUrl: row.heroImageUrl ?? undefined,
    products: [], // lazily fetched if needed
  }));
}

export async function getCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const db = await getDbAsync();
  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });
  if (!row) return null;

  const products = await getCategoryProducts(slug);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    heroImageUrl: row.heroImageUrl ?? undefined,
    products,
  };
}
