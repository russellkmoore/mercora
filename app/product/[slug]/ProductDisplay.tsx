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
 * <ProductDisplay product={productData} reviews={reviewList} />
 * ```
 *
 * === Props ===
 * @param product - Product object containing all product information
 * @param reviews - Published product reviews to surface on the product page
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ProductRecommendations from "@/components/ProductRecommendations";
import { StarRating } from "@/components/reviews/StarRating";
import { useCartStore } from "@/lib/stores/cart-store";
import { normalizeProductRating } from "@/lib/utils/ratings";
import { toast } from "sonner";
import type { Product, Review } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function getReviewTimestamp(review: Review): number {
  const candidate = review.published_at ?? review.submitted_at ?? review.created_at ?? null;
  if (!candidate) return 0;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function ProductDisplay({ product, reviews }: { product: Product; reviews: Review[] }) {
  // Helper to get the best image URL from a MACH Media object
  function getMediaUrl(media: any): string {
    if (!media) return "/placeholder.jpg";
    if (typeof media === "string") return media;
    return media.file?.url || "/placeholder.jpg";
  }

  // Build all images array: primary_image + media[] with error handling
  const allImages = (() => {
    try {
      const primaryImg = (product.primary_image as any)?.url || (product.primary_image as any)?.file?.url;
      const mediaImages = Array.isArray(product.media)
        ? product.media.map((m: any) => {
            try {
              return m?.url || m?.file?.url;
            } catch (e) {
              return null;
            }
          }).filter(Boolean)
        : [];
      
      return Array.from(new Set([primaryImg, ...mediaImages].filter(Boolean))) as string[];
    } catch (error) {
      console.warn('Error processing product images:', error);
      return ["/placeholder.jpg"];
    }
  })();

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

  const [ratingFilter, setRatingFilter] = useState<'all' | number>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');

  const reviewList = useMemo(() => (Array.isArray(reviews) ? [...reviews] : []), [reviews]);

  const highlightPositive = useMemo(() => {
    return (
      reviewList
        .filter((review) => review.rating >= 4 && (review.body?.trim().length ?? 0) > 0)
        .sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        })[0] ?? null
    );
  }, [reviewList]);

  const highlightCritical = useMemo(() => {
    const severe = reviewList
      .filter((review) => review.rating <= 2 && (review.body?.trim().length ?? 0) > 0)
      .sort((a, b) => {
        if (a.rating !== b.rating) return a.rating - b.rating;
        return getReviewTimestamp(b) - getReviewTimestamp(a);
      });

    if (severe.length) {
      return severe[0];
    }

    return (
      reviewList
        .filter((review) => review.rating <= 3 && (review.body?.trim().length ?? 0) > 0)
        .sort((a, b) => {
          if (a.rating !== b.rating) return a.rating - b.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        })[0] ?? null
    );
  }, [reviewList]);

  const highlightEntries = useMemo(() => {
    const entries: Array<{ key: string; tone: 'positive' | 'critical'; review: Review; label: string }> = [];
    if (highlightPositive) {
      entries.push({
        key: `positive-${highlightPositive.id}`,
        tone: 'positive',
        review: highlightPositive,
        label: 'Top positive review',
      });
    }
    if (highlightCritical && (!highlightPositive || highlightCritical.id !== highlightPositive.id)) {
      entries.push({
        key: `critical-${highlightCritical.id}`,
        tone: 'critical',
        review: highlightCritical,
        label: 'Top critical review',
      });
    }
    return entries;
  }, [highlightPositive, highlightCritical]);

  const sortedReviews = useMemo(() => {
    const list = [...reviewList];
    if (!list.length) return list;

    switch (sortBy) {
      case 'highest':
        return list.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        });
      case 'lowest':
        return list.sort((a, b) => {
          if (a.rating !== b.rating) return a.rating - b.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        });
      case 'recent':
      default:
        return list.sort((a, b) => getReviewTimestamp(b) - getReviewTimestamp(a));
    }
  }, [reviewList, sortBy]);

  const filteredReviews = useMemo(() => {
    if (ratingFilter === 'all') {
      return sortedReviews;
    }
    return sortedReviews.filter((review) => review.rating === ratingFilter);
  }, [sortedReviews, ratingFilter]);

  const reviewCount = reviewList.length;
  const ratingSelectValue = ratingFilter === 'all' ? 'all' : String(ratingFilter);

  const ratingSummary = normalizeProductRating(product.rating);
  const hasRatings = Boolean(ratingSummary && ratingSummary.count > 0);
  const ratingDistribution = hasRatings
    ? [5, 4, 3, 2, 1].map((bucket) => {
        const count = ratingSummary!.distribution?.[bucket] ?? 0;
        const percent = ratingSummary!.count > 0 ? Math.round((count / ratingSummary!.count) * 100) : 0;
        return { bucket, count, percent };
      })
    : [];
  const hasDistribution = ratingDistribution.some((entry) => entry.count > 0);
  const lastPublishedLabel = hasRatings && ratingSummary?.lastPublishedAt
    ? formatReviewDate(ratingSummary.lastPublishedAt)
    : null;

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
            { typeof product.description === "string"
              ? product.description
              : Object.values(product.description || {})[0] || ""}
          </p>

          {hasRatings ? (
            <section className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <StarRating value={ratingSummary!.average} size="lg" />
                  <div>
                    <p className="text-3xl font-semibold text-white">
                      {ratingSummary!.average.toFixed(1)}
                    </p>
                    <p className="text-sm text-gray-400">
                      {ratingSummary!.count} review{ratingSummary!.count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {lastPublishedLabel && (
                  <p className="text-xs text-gray-500 sm:text-right">
                    Last review {lastPublishedLabel}
                  </p>
                )}
              </div>
              {hasDistribution && (
                <dl className="mt-4 space-y-2">
                  {ratingDistribution.map(({ bucket, count, percent }) => (
                    <div key={bucket} className="flex items-center gap-3 text-xs text-gray-300">
                      <dt className="w-10 font-medium text-gray-400">{bucket}★</dt>
                      <dd className="flex-1">
                        <div className="h-2 rounded-full bg-neutral-800">
                          <div
                            className="h-full rounded-full bg-yellow-400"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </dd>
                      <span className="w-10 text-right text-gray-500">{count}</span>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ) : (
            <p className="mb-6 text-sm text-gray-500">
              No reviews yet — be the first to share your experience after delivery.
            </p>
          )}

          <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Share your experience</h2>
                <p className="text-sm text-gray-400">
                  Reviews are limited to verified purchases—visit your order history once delivery is confirmed.
                </p>
              </div>
              <Link
                href="/account/orders"
                className="inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
              >
                Review your order
              </Link>
            </div>
          </div>

          {highlightEntries.length > 0 && (
            <section className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white">Review highlights</h2>
                <p className="text-sm text-gray-400">Balanced perspective from shoppers at both ends of the rating scale.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {highlightEntries.map(({ key, tone, review, label }) => (
                  <article
                    key={key}
                    className="rounded-md border border-neutral-700 bg-neutral-950 p-4"
                    aria-label={label}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <StarRating value={review.rating} size="sm" />
                          <span className="text-sm font-semibold text-white">{review.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          tone === 'positive' ? 'text-green-300' : 'text-amber-300'
                        }`}
                      >
                        {tone === 'positive' ? 'Positive' : 'Critical'}
                      </span>
                    </div>
                    {review.title && <h3 className="mt-3 text-base font-semibold text-white">{review.title}</h3>}
                    {review.body && (
                      <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{review.body}</p>
                    )}
                    <p className="mt-3 text-xs text-gray-500">
                      {formatReviewDate(review.published_at ?? review.submitted_at ?? review.created_at) ?? 'Recently updated'}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {reviewCount > 0 && (
            <section className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">All reviews</h2>
                  <p className="text-sm text-gray-400">
                    Showing {filteredReviews.length} of {reviewCount} review{reviewCount === 1 ? '' : 's'}.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Select
                    value={ratingSelectValue}
                    onValueChange={(value) => setRatingFilter(value === 'all' ? 'all' : Number(value))}
                  >
                    <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 sm:w-40">
                      <SelectValue placeholder="Filter rating" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="all" className="text-white hover:bg-neutral-700">
                        All ratings
                      </SelectItem>
                      {[5, 4, 3, 2, 1].map((value) => (
                        <SelectItem
                          key={`filter-${value}`}
                          value={String(value)}
                          className="text-white hover:bg-neutral-700"
                        >
                          {value} star{value === 1 ? '' : 's'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as 'recent' | 'highest' | 'lowest')}
                  >
                    <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 sm:w-40">
                      <SelectValue placeholder="Sort reviews" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="recent" className="text-white hover:bg-neutral-700">
                        Most recent
                      </SelectItem>
                      <SelectItem value="highest" className="text-white hover:bg-neutral-700">
                        Highest rated
                      </SelectItem>
                      <SelectItem value="lowest" className="text-white hover:bg-neutral-700">
                        Lowest rated
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {filteredReviews.length > 0 ? (
                  filteredReviews.map((review) => {
                    const submittedLabel =
                      formatReviewDate(review.published_at ?? review.submitted_at ?? review.created_at) ?? 'Recently updated';

                    return (
                      <article
                        key={review.id}
                        className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
                        aria-label={`Review rated ${review.rating} stars`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <StarRating value={review.rating} size="sm" />
                            <span className="text-sm font-semibold text-white">{review.rating.toFixed(1)}</span>
                            {review.is_verified && (
                              <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-medium text-green-200">
                                Verified purchase
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{submittedLabel}</p>
                        </div>
                        {review.title && (
                          <h3 className="mt-3 text-base font-semibold text-white">{review.title}</h3>
                        )}
                        {review.body && (
                          <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{review.body}</p>
                        )}
                        {review.media?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {review.media.map((media) => (
                              <a
                                key={media.id ?? media.url}
                                href={media.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-orange-300 underline"
                              >
                                View {media.type === 'video' ? 'video' : 'photo'}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {review.admin_response && (
                          <div className="mt-4 rounded-md border border-neutral-700 bg-neutral-900 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">
                              Merchant response
                            </p>
                            <p className="mt-1 text-sm text-gray-200 whitespace-pre-wrap">{review.admin_response}</p>
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-400">No reviews match the selected filters yet.</p>
                )}
              </div>
            </section>
          )}

          {/* Variant Selector */}
          {variants.length > 1 && (
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium mb-2 text-white">Choose an option:</label>
              <Select 
                value={selectedVariantId} 
                onValueChange={setSelectedVariantId}
              >
                <SelectTrigger className="w-full sm:w-auto bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700">
                  <SelectValue placeholder="Select a variant" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700">
                  {variants.map((variant) => {
                    const optionDisplay = variant.option_values?.map(ov => `${ov.value}`).join(", ") || `Variant ${variant.id}`;
                    const priceDisplay = variant.price ? `$${(variant.price.amount / 100).toFixed(2)}` : "";
                    
                    return (
                      <SelectItem 
                        key={variant.id} 
                        value={variant.id}
                        className="text-white hover:bg-neutral-700 focus:bg-neutral-700"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{optionDisplay}</span>
                          {priceDisplay && <span className="ml-2 text-orange-400 font-semibold">{priceDisplay}</span>}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
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
                const productName = typeof product.name === "string" ? product.name : "";
                const variantDisplay = selectedVariant?.option_values?.map(ov => `${ov.value}`).join(", ") || "";
                const fullName = variantDisplay ? `${productName} - ${variantDisplay}` : productName;
                
                useCartStore.getState().addItem({
                  productId: product.id,
                  variantId: selectedVariant?.id,
                  name: fullName,
                  price: price / 100,
                  quantity: 1,
                  primaryImageUrl: (() => {
                    try {
                      return (product.primary_image as any)?.url || (product.primary_image as any)?.file?.url || "/placeholder.jpg";
                    } catch (e) {
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
