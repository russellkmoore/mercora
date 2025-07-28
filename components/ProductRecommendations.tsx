/**
 * === Product Recommendations Component ===
 *
 * An intelligent product recommendation system that uses AI to suggest
 * relevant products based on the current product context. Provides
 * contextually aware suggestions to enhance user discovery and sales.
 *
 * === Features ===
 * - **AI-Powered**: Uses Volt AI to analyze current product and find similarities
 * - **Context-Aware**: Considers product tags, use cases, and characteristics
 * - **Dynamic Layout**: Responsive grid that adapts to number of recommendations
 * - **Loading States**: Shows skeleton placeholders during API calls
 * - **Smart Filtering**: Excludes current product from recommendations
 * - **Graceful Degradation**: Hides section if no recommendations found
 *
 * === Technical Implementation ===
 * - **API Integration**: Calls agent-chat endpoint with product context
 * - **TypeScript Safety**: Fully typed with Product interface
 * - **Performance**: Only fetches when product context is available
 * - **Error Handling**: Silent failures to prevent breaking page experience
 *
 * === Usage ===
 * ```tsx
 * <ProductRecommendations product={currentProduct} />
 * ```
 *
 * === Props ===
 * @param product - Optional Product object to base recommendations on
 */

"use client";

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types/product";
import { useState, useEffect } from "react";

/**
 * ProductRecommendations component that displays AI-suggested products
 * 
 * @param product - The current product to base recommendations on
 * @returns JSX element with recommended products or null if none available
 */
export default function ProductRecommendations({
  product,
}: {
  product?: Product;
}) {
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetch intelligent product recommendations based on current product
   * 
   * Uses the AI agent to analyze the current product's characteristics
   * and find complementary or similar items from the inventory.
   */
  useEffect(() => {
    if (!product) return;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        // Build contextual query using product metadata
        const productTags = product.tags.join(", ");
        const productUseCases = product.useCases.join(", ");
        const recommendationQuery = `I'm interested in the ${product.name}. It's used for ${productUseCases} and has tags: ${productTags}. Can you recommend 3 similar or complementary products that would go well with this item?`;
        
        const res = await fetch("/api/agent-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            question: recommendationQuery,
            userName: "Guest", // Could be enhanced with actual user data
            history: [] // Fresh conversation for recommendations
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { 
            answer: string; 
            products?: Product[];
            productIds?: number[];
          };
          
          if (data.products && data.products.length > 0) {
            // Take up to 3 products for recommendations, excluding the current product
            const filteredProducts = data.products
              .filter(p => p.id !== product.id)
              .slice(0, 3);
            setRecommendedProducts(filteredProducts);
          }
        }
      } catch (error) {
        console.error("Error fetching product recommendations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [product]);

  // Don't render anything if no product context or no recommendations
  if (!product || (recommendedProducts.length === 0 && !isLoading)) {
    return null;
  }

  return (
    <div className="mt-20 text-center relative">
      <div className="border-t border-neutral-700 w-full relative mb-10">
        <span className="text-orange-400 text-2xl font-semibold bg-neutral-900 px-4 absolute -top-4 left-1/2 transform -translate-x-1/2 font-serif">
          {isLoading ? "Finding recommendations..." : "You may also like"}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 aspect-square rounded-lg mb-4"></div>
              <div className="bg-gray-200 h-4 rounded mb-2"></div>
              <div className="bg-gray-200 h-4 rounded w-2/3 mx-auto"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-10 ${
          recommendedProducts.length === 1 
            ? "grid-cols-1 max-w-sm mx-auto" 
            : recommendedProducts.length === 2 
            ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" 
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}>
          {recommendedProducts.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      )}
    </div>
  );
}
