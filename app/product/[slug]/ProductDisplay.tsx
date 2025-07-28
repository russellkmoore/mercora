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
import type { Product } from "@/lib/types/product";

/**
 * ProductDisplay component for showcasing individual product details
 * 
 * @param product - The product object to display
 * @returns JSX element with complete product detail view
 */
export default function ProductDisplay({ product }: { product: Product }) {
  const [selectedImage, setSelectedImage] = useState(product.primaryImageUrl);

  /**
   * Format image source URL with fallback handling
   * 
   * @param src - Image source URL or path
   * @returns Properly formatted image URL
   */
  const formatImageSrc = (src: string | null) =>
    src?.startsWith("http") ? src : `/${src || "placeholder.jpg"}`;

  /**
   * Generate unique image array from primary image and additional images
   * Ensures no duplicate images in the gallery
   */
  const allImages = Array.from(
    new Set([product.primaryImageUrl, ...product.images].filter(Boolean))
  ) as string[];

  return (
    <>
      {/* Main Product Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Image Gallery Section */}
        <div>
          {/* Primary Image Display */}
          <div className="relative w-full rounded overflow-hidden bg-neutral-800 aspect-[3/4]">
            <Image
              src={formatImageSrc(selectedImage)}
              alt={product.name}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              style={{ objectFit: "cover" }}
              className="object-cover"
            />
          </div>

          {/* Image Thumbnails Navigation */}
          <div className="flex gap-3 mt-4">
            {allImages.map((img, idx) => (
              <div
                key={`thumb-${idx}`}
                onClick={() => setSelectedImage(img)}
                className={`w-20 h-20 relative rounded overflow-hidden cursor-pointer border ${
                  selectedImage === img
                    ? "border-orange-500"
                    : "border-gray-700"
                }`}
              >
                <Image
                  src={formatImageSrc(img)}
                  alt={`Thumbnail ${idx}`}
                  fill
                  style={{ objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Product Information Section */}
        <div>
          <h1 className="text-4xl font-extrabold mb-4">{product.name}</h1>
          <p className="text-gray-400 mb-6">{product.longDescription}</p>

          {/* Pricing Display with Sale Logic */}
          {product.salePrice && product.onSale ? (
            <div className="mb-4">
              <p className="text-gray-500 line-through text-lg">
                ${(product.price / 100).toFixed(2)}
              </p>
              <p className="text-green-400 text-xl font-bold">
                ${(product.salePrice / 100).toFixed(2)}
              </p>
              <p className="text-sm text-orange-400 italic">on sale</p>
            </div>
          ) : (
            <p className="text-xl font-semibold text-white mb-4">
              ${(product.price / 100).toFixed(2)}
            </p>
          )}

          {/* Add to Cart Button with Stock Availability */}
          {product.quantityInStock > 0 &&
          product.availability === "available" ? (
            <button
              className="mt-6 px-6 py-3 bg-orange-500 text-black font-bold rounded hover:bg-orange-400 transition"
              onClick={() => {
                // Add product to cart with appropriate pricing
                useCartStore.getState().addItem({
                  productId: product.id,
                  name: product.name,
                  price:
                    (product.onSale && product.salePrice
                      ? product.salePrice
                      : product.price) / 100,
                  quantity: 1,
                  primaryImageUrl: product.primaryImageUrl ?? "placeholder.jpg",
                });
                // Show success notification
                toast("Added to Cart", {
                  description: `${product.name} has been added to your cart.`,
                  icon: "🔥",
                });
              }}
            >
              Add to Cart
            </button>
          ) : (
            <p className="text-orange-500 font-semibold text-xl mb-4">
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
