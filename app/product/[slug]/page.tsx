/**
 * === Product Page Component ===
 *
 * Dynamic page component that displays individual product details including
 * images, specifications, pricing, and purchasing options. Core component
 * of the eCommerce shopping experience.
 *
 * === Features ===
 * - **Dynamic Routing**: Uses [slug] parameter to identify specific products
 * - **Product Details**: Complete product information display
 * - **Image Gallery**: Product images with optimization
 * - **Add to Cart**: Direct purchasing functionality
 * - **Recommendations**: Related product suggestions
 * - **SEO Optimized**: Proper metadata and structured data
 * - **Error Handling**: 404 page for non-existent products
 *
 * === Technical Implementation ===
 * - **Server Component**: Server-side data fetching for SEO and performance
 * - **MACH Alliance**: Uses MACH-compliant product data models
 * - **Dynamic Import**: ProductDisplay component handles client interactions
 * - **Next.js Features**: Built-in notFound() for proper 404 handling
 * - **Responsive Layout**: Mobile-first design with proper container sizing
 *
 * === Data Flow ===
 * 1. Extract product slug from URL parameters
 * 2. Fetch product data using slug lookup
 * 3. Return 404 if product not found
 * 4. Render ProductDisplay with product data
 *
 * === Route ===
 * - Path: `/product/[slug]`
 * - Examples: `/product/arctic-pulse-tool`, `/product/echo-sky-kit`
 *
 * === SEO Benefits ===
 * - Server-side rendering for search engine crawling
 * - Dynamic metadata generation based on product data
 * - Proper 404 handling for removed products
 *
 * @param params - URL parameters containing product slug
 * @returns JSX element with product page layout or 404 if not found
 */

import { auth } from "@clerk/nextjs/server";
import { getProductBySlug, getProductReviews, getProductReviewEligibility } from "@/lib/models";
import { notFound } from "next/navigation";
import ProductDisplay from "./ProductDisplay";
import { toPublicProduct } from "@/lib/models/mach/product-serializer";
import { getRecommendationsForProduct } from "@/lib/recommendations";
import { buildServerUserContext } from "@/lib/recommendations/user-context.server";
import { getStoreConfig } from "@/lib/store-config";

export const revalidate = 0;

/**
 * Product page component that displays detailed information for a specific product
 * 
 * @param params - URL parameters object containing the product slug
 * @returns Server-rendered product page or 404 if product not found
 */
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  const { slug } = await params;
  const storedProduct = await getProductBySlug(slug);
  if (!storedProduct || storedProduct.status !== "active") return notFound();
  const product = toPublicProduct(storedProduct);
  const store = getStoreConfig();
  const commerce = store.commerce;
  const userContextPromise = buildServerUserContext(userId);

  const [reviews, reviewEligibility, recommendations] = await Promise.all([
    getProductReviews({
      productId: product.id,
      status: ["published"],
      limit: 50,
    }),
    getProductReviewEligibility({
      productId: product.id,
      customerId: userId,
    }),
    userContextPromise
      .then((userContext) =>
        getRecommendationsForProduct(storedProduct, { userContext }),
      )
      .then((products) => products.map(toPublicProduct)),
  ]);

  return (
    <div className="bg-neutral-900 text-white min-h-screen px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      <div className="max-w-5xl mx-auto">
        <ProductDisplay
          product={product}
          recommendations={recommendations}
          reviews={reviews}
          reviewEligibility={reviewEligibility}
          subscription={{
            enabled: commerce.features.subscriptionAcquisition
              && commerce.features.subscriptionReconciliation
              && commerce.subscriptionTermsVersion !== undefined,
            termsVersion: commerce.subscriptionTermsVersion,
            termsUrl: store.urls.terms,
          }}
        />
      </div>
    </div>
  );
}
