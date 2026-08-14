import { getProductsBySlugs } from "@/lib/models/mach/products";
import { Money } from "@/lib/money";
import type { Product } from "@/lib/types";
import type { PageSection } from "./page-sections";

const PLACEHOLDER_IMAGE = "/placeholder.svg";

export interface ProductCardData {
  slug: string;
  name: string;
  price: string | null;
  imageKey: string;
}

function firstValue(field: unknown): string {
  if (typeof field === "string") return field;
  const value = Object.values((field as Record<string, unknown>) ?? {})[0];
  return typeof value === "string" ? value : "";
}

function imageKeyFor(primaryImage: unknown): string {
  try {
    if (!primaryImage) return PLACEHOLDER_IMAGE;
    const data = typeof primaryImage === "string" && primaryImage.startsWith("{")
      ? JSON.parse(primaryImage)
      : primaryImage;
    if (typeof data === "string") return data ? data.replace(/^\//, "") : PLACEHOLDER_IMAGE;
    const value = data as { url?: string; file?: { url?: string } };
    const url = value?.url ?? value?.file?.url;
    return url ? url.replace(/^\//, "") : PLACEHOLDER_IMAGE;
  } catch {
    return PLACEHOLDER_IMAGE;
  }
}

function formatPrice(price: unknown): string | null {
  if (price == null) return null;
  try {
    const currency = (price as { currency?: string })?.currency ?? "USD";
    return Money.fromStored(price, currency).format();
  } catch {
    return null;
  }
}

export async function resolveSectionProducts(
  sections: PageSection[],
): Promise<Map<string, ProductCardData>> {
  const references = sections.filter(
    (section): section is PageSection & { productSlug: string } => Boolean(section.productSlug),
  );
  if (references.length === 0) return new Map();

  let products: Map<string, Product>;
  try {
    products = await getProductsBySlugs(references.map((section) => section.productSlug));
  } catch {
    return new Map();
  }

  const resolved = new Map<string, ProductCardData>();
  for (const section of references) {
    const product = products.get(section.productSlug);
    if (!product) continue;
    const variants = product.variants ?? [];
    const variant = variants.find((item) => item.id === product.default_variant_id) ?? variants[0];
    resolved.set(section.id, {
      slug: section.productSlug,
      name: firstValue(product.name) || section.productSlug,
      price: formatPrice(variant?.price),
      imageKey: imageKeyFor(product.primary_image),
    });
  }
  return resolved;
}
