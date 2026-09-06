/**
 * === CategoryList ===
 *
 * The one-row-per-product category variant (D-06): image left, name/price/
 * CTA right. Not a CSS grid — the empty state renders in a plain centered
 * block rather than a grid cell. Reuses `ProductCard`'s data contract (price/
 * sale/availability/rating logic and per-field fallbacks) laid out
 * differently, per UI-SPEC's Storefront Variant Anatomy.
 */

import Link from "next/link";
import Image from "next/image";
import type { Product, ProductVariant } from "@/lib/types/";
import { getDarkBlurPlaceholder } from "@/lib/utils/image-placeholders";
import { resolveProductImageSrc } from "@/lib/utils/product-image";
import { normalizeProductRating } from "@/lib/utils/ratings";
import { StarRating } from "@/components/reviews/StarRating";
import { Money } from "@/lib/money";
import { isVariantAvailable } from "@/lib/inventory/availability";

interface CategoryListProps {
  products: Product[];
}

export default function CategoryList({ products }: CategoryListProps) {
  return (
    <div data-category-layout="list" className="flex flex-col gap-4 sm:gap-6">
      {products.length > 0 ? (
        products.map((product) => <CategoryListRow key={product.id} product={product} />)
      ) : (
        <div className="text-center text-muted-foreground py-8">
          No products found in this category.
        </div>
      )}
    </div>
  );
}

function CategoryListRow({ product }: { product: Product }) {
  const variants = product.variants || [];
  const defaultVariant: ProductVariant | undefined =
    variants.find((v) => v.id === product.default_variant_id) || variants[0];

  const price = defaultVariant?.price?.amount ?? null;
  const compareAt = defaultVariant?.compare_at_price?.amount;
  const onSale = compareAt && compareAt > (price ?? 0);

  const isAvailable = defaultVariant?.available_for_sale ??
    (defaultVariant ? isVariantAvailable(defaultVariant) : false);
  const availability = isAvailable ? "available" : "coming_soon";

  const name =
    typeof product.name === "string"
      ? product.name
      : Object.values(product.name || {})[0] || "";
  const shortDescription =
    typeof product.description === "string"
      ? product.description
      : Object.values(product.description || {})[0] || "";
  const slug =
    typeof product.slug === "string"
      ? product.slug
      : Object.values(product.slug || {})[0] || "";

  const imageUrl = resolveProductImageSrc(
    product.primary_image,
    product.media,
    "/products/placeholder.png"
  );
  const ratingSummary = normalizeProductRating(product.rating);
  const hasRatings = Boolean(ratingSummary && ratingSummary.count > 0);

  return (
    <Link
      href={`/product/${slug}`}
      className="group flex flex-col sm:flex-row gap-4 sm:gap-6 rounded-lg bg-surface-elevated p-4 sm:p-6 shadow transition hover:shadow-lg touch-manipulation"
    >
      <div className="relative w-full sm:w-40 md:w-48 aspect-video sm:aspect-square shrink-0 overflow-hidden rounded bg-border">
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(min-width: 768px) 192px, (min-width: 640px) 160px, 100vw"
          className="object-cover"
          placeholder="blur"
          blurDataURL={getDarkBlurPlaceholder()}
        />
      </div>
      <div className="flex flex-1 min-w-0 flex-col justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-semibold line-clamp-2 leading-snug">
            {name}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
            {shortDescription}
          </p>
          {hasRatings ? (
            <div className="flex items-center gap-2 text-sm">
              <StarRating value={ratingSummary!.average} size="sm" />
              <span className="font-semibold text-foreground">
                {ratingSummary!.average.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">({ratingSummary!.count})</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Be the first to review</span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {price !== null && (
            <div>
              {onSale && compareAt != null ? (
                <div className="text-primary">
                  <span className="line-through text-muted-foreground mr-2">
                    {Money.fromMinor(compareAt).format()}
                  </span>
                  <span className="font-semibold">{Money.fromMinor(price).format()}</span>
                </div>
              ) : (
                <div className="text-foreground font-semibold">
                  {Money.fromMinor(price).format()}
                </div>
              )}
            </div>
          )}
          <p
            className={
              availability === "available" ? "text-success" : "text-warning"
            }
          >
            {availability === "available" ? "In Stock" : "Coming Soon"}
          </p>
          <span className="text-primary group-hover:underline font-semibold">
            Learn more →
          </span>
        </div>
      </div>
    </Link>
  );
}
