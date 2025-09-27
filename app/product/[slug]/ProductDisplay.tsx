/**
 * === Product Display Component ===
 *
 * A comprehensive product detail view component that showcases individual
 * products with interactive image gallery, product information, and cart
 * functionality. Designed for optimal user experience on product pages.
 *
 * === Features ===
 * - **Interactive Image Gallery**: Primary image with thumbnail navigation
 * - **Product Information**: Name, pricing, availability, and variant selection
 * - **Cart Integration**: Add to cart functionality with toast notifications
 * - **Responsive Design**: Mobile-first layout with desktop enhancements
 * - **Image Optimization**: Next.js Image component with proper sizing
 * - **Visual Feedback**: Selected thumbnail highlighting and hover states
 * - **AI Recommendations**: Integrated ProductRecommendations component
 * - **Tabbed Content**: Details and reviews separated for a cleaner layout
 *
 * === Usage ===
 * ```tsx
 * <ProductDisplay
 *   product={productData}
 *   reviews={reviewList}
 *   reviewEligibility={eligibility}
 * />
 * ```
 *
 * === Props ===
 * @param product - Product object containing all product information
 * @param reviews - Published product reviews to surface on the product page
 * @param reviewEligibility - Review eligibility data for the authenticated viewer
 */

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import ProductRecommendations from "@/components/ProductRecommendations";
import { StarRating } from "@/components/reviews/StarRating";
import { ProductReviewsSection } from "@/components/reviews/ProductReviewsSection";
import { useCartStore } from "@/lib/stores/cart-store";
import { normalizeProductRating } from "@/lib/utils/ratings";
import { toast } from "sonner";
import type { Product, Review, ProductReviewEligibility } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductDisplayProps {
  product: Product;
  reviews: Review[];
  reviewEligibility?: ProductReviewEligibility;
}

function getMediaUrl(media: any): string {
  if (!media) return "/placeholder.jpg";
  if (typeof media === "string") return media;
  return media.file?.url || "/placeholder.jpg";
}

function stringifyDescription(description: Product["description"]): string {
  if (!description) return "";
  if (typeof description === "string") return description;
  if (typeof description === "object") {
    const firstValue = Object.values(description as Record<string, unknown>).find(
      (entry) => typeof entry === "string" && entry.trim().length
    );
    if (typeof firstValue === "string") {
      return firstValue;
    }
  }
  return "";
}

export default function ProductDisplay({
  product,
  reviews,
  reviewEligibility,
}: ProductDisplayProps) {
  const allImages = useMemo(() => {
    try {
      const primaryImg = (product.primary_image as any)?.url || (product.primary_image as any)?.file?.url;
      const mediaImages = Array.isArray(product.media)
        ? product.media
            .map((item: any) => {
              try {
                return item?.url || item?.file?.url;
              } catch (error) {
                return null;
              }
            })
            .filter(Boolean)
        : [];
      return Array.from(new Set([primaryImg, ...mediaImages].filter(Boolean))) as string[];
    } catch (error) {
      console.warn("Error processing product images:", error);
      return ["/placeholder.jpg"];
    }
  }, [product.media, product.primary_image]);

  const [selectedImage, setSelectedImage] = useState<string | null>(allImages[0] || "/placeholder.jpg");
  const [activeTab, setActiveTab] = useState<"details" | "reviews">("details");

  // Variant selection state
  const variants = product.variants || [];
  const defaultVariant = variants.find((variant) => variant.id === product.default_variant_id) || variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(defaultVariant?.id);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || defaultVariant;

  // Price logic (MACH: price is on variant)
  const price = selectedVariant?.price?.amount ?? 0;
  const compareAt = selectedVariant?.compare_at_price?.amount;
  const onSale = compareAt && compareAt > price;

  // Stock logic (MACH: inventory is on variant)
  const quantityInStock = selectedVariant?.inventory?.quantity ?? 0;
  const available = quantityInStock > 0;

  const ratingSummary = useMemo(() => normalizeProductRating(product.rating), [product.rating]);
  const productDescription = useMemo(() => stringifyDescription(product.description), [product.description]);

  const reviewsTabLabel = useMemo(() => {
    if (ratingSummary) {
      return `Reviews · ${ratingSummary.average.toFixed(1)}`;
    }
    if (reviews.length) {
      return `Reviews (${reviews.length})`;
    }
    return "Reviews";
  }, [ratingSummary, reviews.length]);

  return (
    <>
      {/* Main Product Display Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Image Gallery Section */}
        <div>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded bg-neutral-800">
            <Image
              src={getMediaUrl(selectedImage)}
              alt={typeof product.name === "string" ? product.name : ""}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              style={{ objectFit: "cover" }}
              className="object-cover"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 sm:mt-4 sm:gap-3">
            {allImages.map((imageUrl, index) => (
              <button
                type="button"
                key={`thumb-${index}`}
                onClick={() => setSelectedImage(imageUrl)}
                className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded border sm:h-20 sm:w-20 ${
                  selectedImage === imageUrl ? "border-orange-500" : "border-gray-700"
                }`}
              >
                <Image
                  src={getMediaUrl(imageUrl)}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  style={{ objectFit: "cover" }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Product Information Section */}
        <div className="mt-6 lg:mt-0">
          <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">
            {typeof product.name === "string" ? product.name : ""}
          </h1>

          {ratingSummary ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
              <StarRating value={ratingSummary.average} size="sm" />
              <span>
                {ratingSummary.average.toFixed(1)} · {ratingSummary.count} review{ratingSummary.count === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("reviews")}
                className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-orange-300 transition hover:border-orange-500 hover:text-orange-200"
              >
                Read reviews
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-300">Be the first to share feedback once your order is delivered.</p>
          )}

          <div className="mt-6">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900">
              <div className="flex flex-wrap border-b border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className={`flex-1 px-4 py-3 text-sm font-semibold sm:flex-none sm:px-6 ${
                    activeTab === "details"
                      ? "border-b-2 border-orange-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("reviews")}
                  className={`flex-1 px-4 py-3 text-sm font-semibold sm:flex-none sm:px-6 ${
                    activeTab === "reviews"
                      ? "border-b-2 border-orange-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {reviewsTabLabel}
                </button>
              </div>
              <div className="p-6">
                {activeTab === "details" ? (
                  <div className="space-y-4 text-sm text-gray-300">
                    {productDescription ? (
                      <p className="whitespace-pre-line leading-relaxed text-gray-300">{productDescription}</p>
                    ) : (
                      <p className="text-sm text-gray-500">Product description coming soon.</p>
                    )}
                  </div>
                ) : (
                  <ProductReviewsSection
                    reviews={reviews}
                    ratingSummary={ratingSummary}
                    eligibility={reviewEligibility}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {variants.length > 1 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-white">Choose an option:</label>
                <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                  <SelectTrigger className="w-full border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 sm:w-auto">
                    <SelectValue placeholder="Select a variant" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border border-neutral-700 text-white">
                    {variants.map((variant) => {
                      const optionDisplay = variant.option_values?.map((value) => `${value.value}`).join(", ") || `Variant ${variant.id}`;
                      const priceDisplay = variant.price ? `$${(variant.price.amount / 100).toFixed(2)}` : "";

                      return (
                        <SelectItem
                          key={variant.id}
                          value={variant.id}
                          className="text-white hover:bg-neutral-800 focus:bg-neutral-800"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span>{optionDisplay}</span>
                            {priceDisplay && (
                              <span className="ml-2 text-orange-400 font-semibold">{priceDisplay}</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {onSale ? (
              <div>
                <p className="text-base text-gray-500 line-through sm:text-lg">${(compareAt! / 100).toFixed(2)}</p>
                <p className="text-lg font-bold text-green-400 sm:text-xl">${(price / 100).toFixed(2)}</p>
                <p className="text-xs italic text-orange-400 sm:text-sm">Limited-time offer</p>
              </div>
            ) : (
              <p className="text-lg font-semibold text-white sm:text-xl">${(price / 100).toFixed(2)}</p>
            )}

            {selectedVariant?.inventory && (
              <p className="text-xs text-gray-500">
                {quantityInStock > 0 ? `${quantityInStock} in stock` : "Backordered"}
              </p>
            )}

            {available ? (
              <button
                className="w-full rounded bg-orange-500 px-6 py-3 font-bold text-black transition hover:bg-orange-400 sm:w-auto"
                onClick={() => {
                  const productName = typeof product.name === "string" ? product.name : "";
                  const variantDisplay = selectedVariant?.option_values?.map((value) => `${value.value}`).join(", ") || "";
                  const fullName = variantDisplay ? `${productName} - ${variantDisplay}` : productName;

                  useCartStore.getState().addItem({
                    productId: product.id,
                    variantId: selectedVariant?.id,
                    name: fullName,
                    price: price / 100,
                    quantity: 1,
                    primaryImageUrl: (() => {
                      try {
                        return (
                          (product.primary_image as any)?.url ||
                          (product.primary_image as any)?.file?.url ||
                          "/placeholder.jpg"
                        );
                      } catch (error) {
                        return "/placeholder.jpg";
                      }
                    })(),
                  });

                  toast("Added to Cart", {
                    description: `${fullName} has been added to your cart.`,
                    icon: "🔥",
                  });
                }}
              >
                Add to Cart
              </button>
            ) : (
              <p className="text-lg font-semibold text-orange-500 sm:text-xl">Coming soon</p>
            )}
          </div>
        </div>
      </div>

      {/* AI-Powered Product Recommendations */}
      <ProductRecommendations product={product} />
    </>
  );
}
