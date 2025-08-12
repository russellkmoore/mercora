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
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import type { ProductWithImages } from "@/lib/loaders/products";
import { getDarkBlurPlaceholder } from "@/lib/utils/image-placeholders";

type ProductCardProduct = Product | ProductWithImages;

// Type guards
function isMACHProduct(p: any): p is Product {
  return (
    typeof p === 'object' &&
    (typeof p.name === 'string' || typeof p.name === 'object') &&
    Array.isArray(p.variants)
  );
// (removed stray closing brace)

function isProductWithImages(p: any): p is ProductWithImages {
  return (
    typeof p === 'object' &&
    Array.isArray(p.variants) &&
    Array.isArray(p.images)
  );
// (removed extra closing brace)

// Helper: get product name (localization)
function getProductName(product: ProductCardProduct): string {
  if (typeof product.name === 'string') return product.name;
  return product.name?.['en'] || Object.values(product.name || {})[0] || '';
// (removed unmatched closing brace)

// Helper: get product slug
function getProductSlug(product: ProductCardProduct): string {
  if (typeof product.slug === 'string') return product.slug;
  if (typeof product.slug === 'object' && product.slug !== null) {
    return product.slug['en'] || Object.values(product.slug)[0] || String(product.id);
  }
  return String(product.id);
// (removed unmatched closing brace)

// Helper: get product description
function getProductDescription(product: ProductCardProduct): string {
  if (typeof product.description === 'string') return product.description;
  return product.description?.['en'] || Object.values(product.description || {})[0] || '';
}

// Helper: get product image URL
function getProductImageUrl(product: ProductCardProduct): string | undefined {
  if (isMACHProduct(product)) {
    if (product.primary_image?.file?.url) return product.primary_image.file.url;
    if (Array.isArray(product.media) && product.media.length > 0 && product.media[0].file?.url) return product.media[0].file.url;
    return undefined;
  } else if (isProductWithImages(product)) {
    if (product.primaryImageUrl) return product.primaryImageUrl;
    if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) return product.imageUrls[0];
    return undefined;
  }
  return undefined;
}

// Helper: get default variant
function getDefaultVariant(product: ProductCardProduct): any {
  if (isMACHProduct(product)) {
}
    return variants.find(v => v.id === product.default_variant_id) || variants[0];
  } else if (isProductWithImages(product)) {
    return product.variants[0];
  }
  return undefined;
}

// Helper: get price and sale price
function getPriceInfo(product: ProductCardProduct): { price: number | null, salePrice: number | null, onSale: boolean } {
  const variant = getDefaultVariant(product);
  if (!variant) return { price: null, salePrice: null, onSale: false };
  if (isMACHProduct(product)) {
    const price = variant?.price?.amount ?? null;
    const salePrice = variant?.compare_at_price?.amount && variant.compare_at_price.amount < price ? variant.compare_at_price.amount : null;
    const onSale = salePrice !== null && salePrice < price;
    return { price, salePrice, onSale };
  } else if (isProductWithImages(product)) {
    const price = typeof variant.price === 'number' ? variant.price : null;
    return { price, salePrice: null, onSale: false };
  }
  return { price: null, salePrice: null, onSale: false };
}

// Helper: get availability
function getAvailability(product: ProductCardProduct): string {
  const variant = getDefaultVariant(product);
  if (!variant) return 'unavailable';
  if (isMACHProduct(product)) {
    return variant.status === 'active' ? 'available' : 'unavailable';
  } else if (isProductWithImages(product)) {
    return product.status === 'active' ? 'available' : 'unavailable';
  }
  return 'unavailable';
}


// (removed duplicate type)

interface ProductCardProps {
  product: ProductCardProduct;
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
  const id = product.id;
  const name = getProductName(product);
  const slug = getProductSlug(product);
  const description = getProductDescription(product);
  const primaryImageUrl = getProductImageUrl(product);
  const { price, salePrice, onSale } = getPriceInfo(product);
  const availability = getAvailability(product);

  return (
    <Link href={`/product/${slug}`} prefetch={true}>
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
          <h3 className="text-lg sm:text-xl font-semibold mb-2 line-clamp-2">{name}</h3>
          <p className="text-gray-400 text-xs sm:text-sm mb-2 line-clamp-3">
            {description}
          </p>
          {price !== null && (
            <div className="text-sm">
              {onSale && salePrice != null ? (
                <div className="text-green-400">
                  <span className="line-through text-gray-400 mr-2">
                    {formatPrice(price)}
                  </span>
                  <span className="font-semibold">
                    {formatPrice(salePrice)}
                  </span>
                  <span className="ml-2 text-xs text-orange-500 font-bold">
                    On Sale
                  </span>
                </div>
              ) : (
                <div className="text-white font-semibold">
                  {formatPrice(price)}
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
            href={`/product/${slug}`}
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
