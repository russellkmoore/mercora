import { getDbAsync } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  products,
  productCategories,
  categories,
  productPrices,
  productSalePrices,
  productInventory,
  productImages,
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

export async function getProductBySlug(slug: string) {
  const db = await getDbAsync();

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug));

  if (!product) return null;

  const [price] = await db
    .select()
    .from(productPrices)
    .where(eq(productPrices.productId, product.id));

  const [salePrice] = await db
    .select()
    .from(productSalePrices)
    .where(eq(productSalePrices.productId, product.id));

  const [inventory] = await db
    .select()
    .from(productInventory)
    .where(eq(productInventory.productId, product.id));

  const images = await db
  .select({
    imageUrl: productImages.imageUrl
  })
  .from(productImages)
  .where(eq(productImages.productId, product.id));
  console.log("Fetched images:", images);

  return {
    ...product,
    price: price?.price ?? null,
    salePrice: salePrice?.sale_price ?? null,
    quantityInStock: inventory?.quantityInStock ?? 0,
    images: images.map(img => img.imageUrl),
  };
}

