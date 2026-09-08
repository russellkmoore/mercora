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
 *   recommendations={recommendationList}
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

import { useMemo, useState, type ComponentType } from "react";
import ProductRecommendations from "@/components/ProductRecommendations";
import { StarRating } from "@/components/reviews/StarRating";
import { ProductReviewsSection } from "@/components/reviews/ProductReviewsSection";
import { useCartStore } from "@/lib/stores/cart-store";
import { Money } from "@/lib/money";
import { normalizeProductRating } from "@/lib/utils/ratings";
import { toast } from "sonner";
import { useCartUIStore } from "@/lib/stores/cart-ui-store";
import type { Product, Review, ProductReviewEligibility } from "@/lib/types";
import { isVariantAvailable } from "@/lib/inventory/availability";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SubscriptionAcquisitionPanel from "@/components/subscriptions/SubscriptionAcquisitionPanel";
import ProductGalleryLeft from "@/components/layout/product/ProductGalleryLeft";
import ProductGalleryTop from "@/components/layout/product/ProductGalleryTop";
import type { ProductGallery } from "@/lib/layout/variants";
import GiftCardRecipientForm from "@/components/product/GiftCardRecipientForm";
import type { GiftCardCustomization } from "@/lib/types/cartitem";

/**
 * Typed lookup map from the resolved product-gallery enum to its named
 * component (LAYOUT-04's anti-genericity control). Held inside this client
 * component per the plan's own interfaces block, rather than a separate
 * module — the category/home switches extracted their maps to enable
 * testing without pulling in a server page's data-fetching dependencies;
 * that constraint doesn't apply here since this map is already inside the
 * client component every test that needs it imports directly.
 */
const PRODUCT_GALLERY_MAP: Record<ProductGallery, ComponentType<GalleryProps>> = {
  left: ProductGalleryLeft,
  top: ProductGalleryTop,
};

/**
 * The outer wrapper geometry each gallery variant owns (D-08/UI-SPEC): the
 * two-column default sits the gallery in the left half of a two-column
 * grid with the info column unchanged to its right; the full-width variant
 * collapses to a single stacked column with the info column capped at
 * max-w-2xl below it. A second map keyed by the same enum — an index
 * operation, not a comparison against a member name literal — so the
 * display never branches on which gallery is resolved.
 */
const PRODUCT_GALLERY_LAYOUT: Record<ProductGallery, { container: string; info: string }> = {
  left: {
    container: "grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12",
    info: "mt-6 lg:mt-0",
  },
  top: {
    container: "flex flex-col",
    info: "mt-8 lg:mt-10 max-w-2xl",
  },
};

interface GalleryProps {
  allImages: string[];
  selectedImage: string | null;
  onSelect: (url: string) => void;
  productName: string;
}

interface ProductDisplayProps {
  product: Product;
  recommendations: Product[];
  reviews: Review[];
  reviewEligibility?: ProductReviewEligibility;
  subscription?: {
    enabled: boolean;
    termsVersion?: string;
    termsUrl: string;
  };
  /**
   * Resolved server-side via getLayoutSettings() (D-08). Required — the only
   * caller, app/product/[slug]/page.tsx, always supplies it. Still the frozen
   * union, never a bare string (LAYOUT-04).
   */
  productGallery: ProductGallery;
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
  recommendations,
  reviews,
  reviewEligibility,
  subscription,
  productGallery,
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
  const available = selectedVariant?.available_for_sale ??
    (selectedVariant ? isVariantAvailable(selectedVariant) : false);

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

  const GalleryVariant = PRODUCT_GALLERY_MAP[productGallery];
  const galleryLayout = PRODUCT_GALLERY_LAYOUT[productGallery];

  const handleGiftCardAdd = (customization?: GiftCardCustomization) => {
    const productName = typeof product.name === "string" ? product.name : "";
    const variantDisplay = selectedVariant?.option_values?.map((value) => `${value.value}`).join(", ") || "";
    const fullName = variantDisplay ? `${productName} - ${variantDisplay}` : productName;

    useCartStore.getState().addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: fullName,
      price: Money.fromMinor(price).toJSON(),
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
      ...(customization ? { giftCardCustomization: customization } : {}),
    });

    toast("Added to Cart", {
      description: `${fullName} has been added to your cart.`,
      icon: "🔥",
      action: {
        label: "View Cart",
        onClick: () => useCartUIStore.getState().openCart(),
      },
    });
  };

  return (
    <>
      {/* Main Product Display Grid */}
      <div className={galleryLayout.container}>
        {/* Image Gallery Section */}
        <GalleryVariant
          allImages={allImages}
          selectedImage={selectedImage}
          onSelect={setSelectedImage}
          productName={typeof product.name === "string" ? product.name : ""}
        />

        {/* Product Information Section */}
        <div className={galleryLayout.info}>
          <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl font-display">
            {typeof product.name === "string" ? product.name : ""}
          </h1>

          {ratingSummary ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StarRating value={ratingSummary.average} size="sm" />
              <span>
                {ratingSummary.average.toFixed(1)} · {ratingSummary.count} review{ratingSummary.count === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("reviews")}
                className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary/90"
              >
                Read reviews
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-warning">Be the first to share feedback once your order is delivered.</p>
          )}

          <div className="mt-6">
            <div className="rounded-lg border border-border bg-surface-elevated">
              <div className="flex flex-wrap border-b border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className={`flex-1 px-4 py-3 text-sm font-semibold sm:flex-none sm:px-6 ${
                    activeTab === "details"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("reviews")}
                  className={`flex-1 px-4 py-3 text-sm font-semibold sm:flex-none sm:px-6 ${
                    activeTab === "reviews"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {reviewsTabLabel}
                </button>
              </div>
              <div className="p-6">
                {activeTab === "details" ? (
                  <div className="space-y-4 text-sm text-muted-foreground">
                    {productDescription ? (
                      <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{productDescription}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Product description coming soon.</p>
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
                <label className="mb-2 block text-sm font-medium text-foreground">Choose an option:</label>
                <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                  <SelectTrigger className="w-full border border-border bg-surface-elevated text-foreground hover:bg-surface-elevated sm:w-auto">
                    <SelectValue placeholder="Select a variant" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-elevated border border-border text-foreground">
                    {variants.map((variant) => {
                      const optionDisplay = variant.option_values?.map((value) => `${value.value}`).join(", ") || `Variant ${variant.id}`;
                      const priceDisplay = variant.price ? Money.fromStored(variant.price).format() : "";

                      return (
                        <SelectItem
                          key={variant.id}
                          value={variant.id}
                          className="text-foreground"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span>{optionDisplay}</span>
                            {priceDisplay && (
                              <span className="ml-2 text-primary font-semibold">{priceDisplay}</span>
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
                <p className="text-base text-muted-foreground line-through sm:text-lg">{Money.fromMinor(compareAt!).format()}</p>
                <p className="text-lg font-bold text-primary sm:text-xl">{Money.fromMinor(price).format()}</p>
                <p className="text-xs italic text-primary sm:text-sm">Limited-time offer</p>
              </div>
            ) : (
              <p className="text-lg font-semibold text-foreground sm:text-xl">{Money.fromMinor(price).format()}</p>
            )}

            {selectedVariant && (
              <p className={`text-xs ${available ? "text-success" : "text-warning"}`}>
                {available ? "In stock" : "Currently unavailable"}
              </p>
            )}

            {product.type === "gift_card" ? (
              <GiftCardRecipientForm
                available={available}
                onAdd={(customization) => handleGiftCardAdd(customization)}
              />
            ) : available ? (
              <button
                className="w-full rounded bg-primary px-6 py-3 font-bold text-on-primary transition hover:bg-primary/90 sm:w-auto"
                onClick={() => handleGiftCardAdd()}
              >
                Add to Cart
              </button>
            ) : (
              <p className="text-lg font-semibold text-warning sm:text-xl">Coming soon</p>
            )}

            {selectedVariant?.id && subscription?.enabled ? (
              <SubscriptionAcquisitionPanel
                key={selectedVariant.id}
                productId={product.id}
                variantId={selectedVariant.id}
                available={available}
                enabled={subscription.enabled}
                termsVersion={subscription.termsVersion}
                termsUrl={subscription.termsUrl}
              />
            ) : null}
          </div>
        </div>
      </div>

      <ProductRecommendations recommendations={recommendations} />
    </>
  );
}
