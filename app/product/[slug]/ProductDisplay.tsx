/**
 * === Product Display Component ===
 *
 * A comprehensive product detail view component that showcases individual
 * products with interactive image gallery, product information, and cart
 * functionality. Designed for optimal user experience on product pages.
 *
 * === Features ===
 * - **Interactive Image Gallery**: Primary image with thumbnail navigation
 * - **Product Information**: Name, description, price, and specifications
 * - **Cart Integration**: Add to cart functionality with toast notifications
 * - **Responsive Design**: Mobile-first layout with desktop enhancements
 * - **Image Optimization**: Next.js Image component with proper sizing
 * - **Visual Feedback**: Selected thumbnail highlighting and hover states
 * - **AI Recommendations**: Integrated ProductRecommendations component
 *
 * === Technical Implementation ===
 * - **Client Component**: Interactive state management for image selection
 * - **Zustand Integration**: Cart store for adding products to cart
 * - **TypeScript Safety**: Fully typed with Product interface
 * - **Image Handling**: Automatic fallback to placeholder images
 * - **Toast Notifications**: User feedback for cart actions
 *
 * === Layout Structure ===
 * - **Desktop**: Two-column grid (image gallery | product details)
 * - **Mobile**: Single column stack with full-width images
 * - **Gallery**: Main image + thumbnail strip with selection state
 * - **Details**: Product info + cart actions + recommendations
 *
 * === Usage ===
 * ```tsx
 * <ProductDisplay product={productData} />
 * ```
 *
 * === Props ===
 * @param product - Product object containing all product information
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import ProductRecommendations from "@/components/ProductRecommendations";
import { useCartStore } from "@/lib/stores/cart-store";
import { toast } from "sonner";
import type { Product } from "@/lib/types/";

export default function ProductDisplay({ product }: { product: Product }) {
  // Helper to get the best image URL from a MACHMedia object
  function getMediaUrl(media: any): string {
    if (!media) return "/placeholder.jpg";
    if (typeof media === "string") return media;
    return media.url || media.src || media.path || media.file?.url || "/placeholder.jpg";
  }

  // Build all images array: primary_image + media[]
  const allImages = Array.from(
    new Set([
      product.primary_image,
      ...(Array.isArray(product.media)
        ? product.media.map((m) => m.file?.url).filter(Boolean)
        : [])
    ].filter(Boolean))
  ) as string[];

  const [selectedImage, setSelectedImage] = useState<string | null>(
    allImages[0] || "/placeholder.jpg"
  );

  // Variant selection state
  const variants = product.variants || [];
  const defaultVariant = variants.find((v) => v.id === product.default_variant_id) || variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(defaultVariant?.id);
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || defaultVariant;

  // Price logic (MACH: price is on variant)
  const price = selectedVariant?.price?.amount ?? 0;
  const compareAt = selectedVariant?.compare_at_price?.amount;
  const onSale = compareAt && compareAt > price;

  // Stock logic (MACH: inventory is on variant)
  const quantityInStock = selectedVariant?.inventory?.quantity ?? 0;
  const available = quantityInStock > 0;

  return (
    <>
      {/* Main Product Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery Section */}
        <div>
          {/* Primary Image Display */}
          <div className="relative w-full rounded overflow-hidden bg-neutral-800 aspect-[3/4]">
            <Image
              src={getMediaUrl(selectedImage)}
              alt={typeof product.name === "string" ? product.name : ""}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              style={{ objectFit: "cover" }}
              className="object-cover"
            />
          </div>

          {/* Image Thumbnails Navigation */}
          <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4 overflow-x-auto pb-2">
            {allImages.map((img, idx) => (
              <div
                key={`thumb-${idx}`}
                onClick={() => setSelectedImage(img)}
                className={`w-16 h-16 sm:w-20 sm:h-20 relative rounded overflow-hidden cursor-pointer border flex-shrink-0 ${
                  selectedImage === img
                    ? "border-orange-500"
                    : "border-gray-700"
                }`}
              >
                <Image
                  src={getMediaUrl(img)}
                  alt={`Thumbnail ${idx}`}
                  fill
                  style={{ objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Product Information Section */}
        <div className="mt-6 lg:mt-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-3 sm:mb-4">
            {typeof product.name === "string" ? product.name : ""}
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">
            {typeof product.description === "string"
              ? product.description
              : ""}
          </p>

          {/* Variant Selector */}
          {variants.length > 1 && (
            <div className="mb-4">
              <label htmlFor="variant-select" className="block text-sm font-medium mb-1">Choose an option:</label>
              <select
                id="variant-select"
                value={selectedVariantId}
                onChange={e => setSelectedVariantId(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border rounded bg-neutral-900 text-white"
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.option_values?.map(ov => `${ov.value}`).join(", ") || `Variant ${variant.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pricing Display with Sale Logic */}
          {onSale ? (
            <div className="mb-4">
              <p className="text-gray-500 line-through text-base sm:text-lg">
                ${(compareAt! / 100).toFixed(2)}
              </p>
              <p className="text-green-400 text-lg sm:text-xl font-bold">
                ${(price / 100).toFixed(2)}
              </p>
              <p className="text-xs sm:text-sm text-orange-400 italic">on sale</p>
            </div>
          ) : (
            <p className="text-lg sm:text-xl font-semibold text-white mb-4">
              ${(price / 100).toFixed(2)}
            </p>
          )}

          {/* Add to Cart Button with Stock Availability */}
          {available ? (
            <button
              className="mt-4 sm:mt-6 w-full sm:w-auto px-6 py-3 bg-orange-500 text-black font-bold rounded hover:bg-orange-400 transition"
              onClick={() => {
                useCartStore.getState().addItem({
                  productId: product.id,
                  variantId: selectedVariant?.id,
                  name: typeof product.name === "string" ? product.name : "",
                  price: price / 100,
                  quantity: 1,
                  primaryImageUrl: getMediaUrl(product.primary_image),
                });
                toast("Added to Cart", {
                  description: `${typeof product.name === "string" ? product.name : ""} has been added to your cart.`,
                  icon: "🔥",
                });
              }}
            >
              Add to Cart
            </button>
          ) : (
            <p className="text-orange-500 font-semibold text-lg sm:text-xl mb-4">
              Coming soon
            </p>
          )}
        </div>
      </div>

      {/* AI-Powered Product Recommendations */}
      <ProductRecommendations product={product} />
    </>
  );
}
