import { getDbAsync } from "@/lib/db";
import {
  productPrices,
  productSalePrices,
  productInventory,
  productImages,
  productTags,
  productUseCases,
  productAttributes,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Product } from "@/lib/types/product";
import { products } from "@/lib/db/schema";

export async function hydrateProduct(product: typeof products.$inferSelect): Promise<Product> {
  const db = await getDbAsync();

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
    .select({ imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(eq(productImages.productId, product.id));

  const tags = await db
    .select({ value: productTags.tag })
    .from(productTags)
    .where(eq(productTags.productId, product.id));

  const useCases = await db
    .select({ value: productUseCases.useCase })
    .from(productUseCases)
    .where(eq(productUseCases.productId, product.id));

  const attributesRaw = await db
    .select({ key: productAttributes.key, value: productAttributes.value })
    .from(productAttributes)
    .where(eq(productAttributes.productId, product.id));

  const attributes: Record<string, string> = {};
  for (const attr of attributesRaw) {
    attributes[attr.key] = attr.value;
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? "",
    longDescription: product.longDescription ?? "",
    primaryImageUrl: product.primaryImageUrl,
    images: images.map((img) => img.imageUrl),
    price: price?.price ?? 0,
    active: product.active ?? false,
    salePrice: salePrice?.sale_price ?? 0,
    onSale: !!product.onSale,
    quantityInStock: inventory?.quantityInStock ?? 0,
    availability: product.availability === "available" ? "available" : "coming_soon",
    tags: tags.map((t) => t.value),
    useCases: useCases.map((u) => u.value),
    attributes,
    aiNotes: product.aiNotes ?? "",
  };
}
