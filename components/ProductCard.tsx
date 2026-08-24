/**
 * === Product Card Component ===
 *
 * A reusable product display card component that shows essential product information
 * with consistent styling and interactive behavior. Used throughout the application
 * for product listings, recommendations, and search results.
 *
 * === Features ===
 * - **Responsive Design**: Adapts to different screen sizes and grid layouts
 * - **Image Optimization**: Next.js Image component with lazy loading and optimization
 * - **Price Display**: Handles regular pricing, sale pricing, and discount calculations
 * - **Interactive States**: Hover effects and smooth transitions
 * - **Accessibility**: Proper semantic markup and keyboard navigation
 * - **Loading States**: Graceful handling of missing images or data
 *
 * === Visual Elements ===
 * - **Product Image**: Optimized image with fallback placeholder
 * - **Product Name**: Truncated title with full name on hover
 * - **Short Description**: Brief product description
 * - **Pricing**: Regular price, sale price, and discount percentage
 * - **Availability**: Stock status and availability indicators
 *
 * === Usage ===
 * ```tsx
 * <ProductCard product={productData} />
 * ```
 *
 * === Props ===
 * @param product - Complete Product object with all required fields
 *
 * === Styling ===
 * - Dark theme with neutral colors
 * - Hover effects for better UX
 * - Responsive aspect ratios
 * - Consistent spacing and typography
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product, ProductVariant } from "@/lib/types";
import { getDarkBlurPlaceholder } from "@/lib/utils/image-placeholders";
import { resolveProductImageSrc } from "@/lib/utils/product-image";
import { normalizeProductRating } from "@/lib/utils/ratings";
import { StarRating } from "@/components/reviews/StarRating";
import { Money } from "@/lib/money";
import { isVariantAvailable } from "@/lib/inventory/availability";

/**
 * Props interface for ProductCard component
 */
interface ProductCardProps {
  product: Product;
  priority?: boolean; // For above-the-fold images
}

function formatReviewDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * ProductCard component for displaying product information in a card layout
 *
 * @param product - Product object containing all product data
 * @param priority - Whether to prioritize image loading (for above-the-fold content)
 * @returns JSX element representing a clickable product card
 */
export default function ProductCard({ product, priority = false }: ProductCardProps) {
  // Get default or first variant
  const variants = product.variants || [];
  const defaultVariant: ProductVariant | undefined =
    variants.find((v) => v.id === product.default_variant_id) || variants[0];

  // Price logic
  const price = defaultVariant?.price?.amount ?? null;
  const compareAt = defaultVariant?.compare_at_price?.amount;
  const onSale = compareAt && compareAt > (price ?? 0);

  // Availability logic
  const isAvailable = defaultVariant?.available_for_sale ??
    (defaultVariant ? isVariantAvailable(defaultVariant) : false);
  const availability = isAvailable ? "available" : "coming_soon";

  // Name/description/slug logic
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
  // Both stored shapes, flat ({url}) and MACH ({file:{url}}), resolve here. This
  // used to read `img.url` only, so a product saved through the admin editor —
  // which writes the MACH shape — silently lost its card image to the
  // placeholder while its PDP kept working. See lib/utils/product-image.ts.
  const imageUrl = resolveProductImageSrc(
    product.primary_image,
    product.media,
    "/products/placeholder.png"
  );
  const imageAlt = name;
  const ratingSummary = normalizeProductRating(product.rating);
  const hasRatings = Boolean(ratingSummary && ratingSummary.count > 0);
  const lastUpdatedLabel = ratingSummary?.lastPublishedAt
    ? formatReviewDate(ratingSummary.lastPublishedAt)
    : null;

  return (
    <Link
      href={`/product/${slug}`}
      prefetch={true}
      className="group block overflow-hidden rounded-lg bg-neutral-800 shadow transition hover:shadow-lg touch-manipulation"
    >
      <div>
        <div className="relative aspect-video bg-neutral-700">
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-opacity duration-300"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "low"}
              placeholder="blur"
              blurDataURL={getDarkBlurPlaceholder()}
            />
        </div>
        <div className="p-4 sm:p-4 space-y-3">
          <h3 className="text-lg sm:text-xl font-semibold line-clamp-2 leading-snug">
            {name}
          </h3>
          <p className="text-gray-400 text-sm sm:text-sm line-clamp-2 leading-relaxed">
            {shortDescription}
          </p>
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            {hasRatings ? (
              <div className="flex items-center gap-2">
                <StarRating value={ratingSummary!.average} size="sm" />
                <span className="text-sm font-semibold text-white">
                  {ratingSummary!.average.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">({ratingSummary!.count})</span>
              </div>
            ) : (
              <span className="text-xs text-gray-500">Be the first to review</span>
            )}
            {lastUpdatedLabel && (
              <span className="hidden text-[11px] text-gray-500 sm:inline">
                Updated {lastUpdatedLabel}
              </span>
            )}
          </div>
          {price !== null && (
            <div className="text-sm">
              {onSale && compareAt != null ? (
                <div className="text-green-400">
                  <span className="line-through text-gray-400 mr-2">
                    {Money.fromMinor(compareAt).format()}
                  </span>
                  <span className="font-semibold">
                    {Money.fromMinor(price).format()}
                  </span>
                  <span className="ml-2 text-xs text-orange-500 font-bold">
                    On Sale
                  </span>
                </div>
              ) : (
                <div className="text-white font-semibold">
                  {Money.fromMinor(price).format()}
                </div>
              )}
            </div>
          )}
          <p
            className={`mt-2 text-xs ${
              availability === "available"
                ? "text-green-400"
                : "text-orange-500"
            }`}
          >
            {availability === "available" ? "In Stock" : "Coming Soon"}
          </p>

          <span className="text-orange-500 group-hover:underline text-sm font-medium">
            Learn more →
          </span>
        </div>
      </div>
    </Link>
  );
}
