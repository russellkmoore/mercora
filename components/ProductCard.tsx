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
import type { Product, ProductVariant } from "@/lib/types/";
import { getDarkBlurPlaceholder } from "@/lib/utils/image-placeholders";

/**
 * Props interface for ProductCard component
 */
interface ProductCardProps {
  product: Product;
  priority?: boolean; // For above-the-fold images
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
  const quantityInStock = defaultVariant?.inventory?.quantity ?? 0;
  const availability = quantityInStock > 0 ? "available" : "coming_soon";

  // Image logic
  const primaryImageUrl =
    typeof product.primary_image === "string"
      ? product.primary_image
      : product.primary_image?.file?.url || null;

  // Name/description logic
  const name =
    typeof product.name === "string"
      ? product.name
      : Object.values(product.name || {})[0] || "";
  const shortDescription =
    typeof product.description === "string"
      ? product.description
      : Object.values(product.description || {})[0] || "";

  return (
    <Link href={`/product/${product.slug}`} prefetch={true}>
      <div className="bg-neutral-800 rounded-lg overflow-hidden shadow hover:shadow-lg transition cursor-pointer">
        <div className="relative aspect-video bg-neutral-700">
          {primaryImageUrl ? (
            <Image
              src={`/${primaryImageUrl}`}
              alt={name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-opacity duration-300"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "low"}
              placeholder="blur"
              blurDataURL={getDarkBlurPlaceholder()}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-lg sm:text-xl">
              No Image
            </div>
          )}
        </div>
        <div className="p-3 sm:p-4">
          <h3 className="text-lg sm:text-xl font-semibold mb-2 line-clamp-2">
            {name}
          </h3>
          <p className="text-gray-400 text-xs sm:text-sm mb-2 line-clamp-3">
            {shortDescription}
          </p>
          {price !== null && (
            <div className="text-sm">
              {onSale && compareAt != null ? (
                <div className="text-green-400">
                  <span className="line-through text-gray-400 mr-2">
                    ${(compareAt / 100).toFixed(2)}
                  </span>
                  <span className="font-semibold">
                    ${(price / 100).toFixed(2)}
                  </span>
                  <span className="ml-2 text-xs text-orange-500 font-bold">
                    On Sale
                  </span>
                </div>
              ) : (
                <div className="text-white font-semibold">
                  ${(price / 100).toFixed(2)}
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

          <Link
            href={`/product/${product.slug}`}
            className="text-orange-500 hover:underline text-sm font-medium"
            prefetch={true}
          >
            Learn more →
          </Link>
        </div>
      </div>
    </Link>
  );
}
