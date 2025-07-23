import { getDbAsync } from "@/lib/db";
import { eq } from "drizzle-orm";
import { products } from "@/lib/db/schema";
import { hydrateProduct } from "../models/product";
import { getCategoryProducts } from "../models/category";
import type { Product } from "@/lib/types/product";


export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  return getCategoryProducts(categorySlug);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = await getDbAsync();
  const product = await db.query.products.findFirst({ where: eq(products.slug, slug) });
  if (!product) return null;
  return await hydrateProduct(product);
}
