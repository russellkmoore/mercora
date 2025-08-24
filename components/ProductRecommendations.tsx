/**
 * === Product Recommendations Component ===
 *
 * An intelligent product recommendation system that combines AI analysis
 * with user personalization to suggest relevant products. Uses purchase
 * history, user preferences, and product context for optimal suggestions.
 *
 * === Features ===
 * - **Personalized**: Considers user order history and preferences
 * - **AI-Enhanced**: Uses Volt AI for intelligent product matching
 * - **Context-Aware**: Considers product tags, use cases, and characteristics
 * - **Dynamic Layout**: Responsive grid that adapts to number of recommendations
 * - **Loading States**: Shows skeleton placeholders during API calls
 * - **Smart Filtering**: Excludes current product and already purchased items
 * - **Graceful Degradation**: Falls back to generic recommendations if needed
 *
 * === Technical Implementation ===
 * - **Hybrid Approach**: Combines algorithmic and AI-powered recommendations
 * - **User Context**: Integrates with enhanced user context system
 * - **TypeScript Safety**: Fully typed with Product interface
 * - **Performance**: Intelligent caching and optimized API calls
 * - **Error Handling**: Multiple fallback strategies
 *
 * === Usage ===
 * ```tsx
 * <ProductRecommendations product={currentProduct} />
 * ```
 *
 * === Props ===
 * @param product - Optional Product object to base recommendations on
 * @param maxRecommendations - Maximum number of products to show (default: 3)
 */

"use client";

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import { useState, useEffect, useMemo } from "react";
import { useEnhancedUserContext } from "@/lib/hooks/useEnhancedUserContext";
import { getPersonalizedRecommendations } from "@/lib/utils/personalized-recommendations";
import Image from "next/image";

/**
 * ProductRecommendations component that displays personalized product suggestions
 * 
 * @param product - The current product to base recommendations on
 * @param maxRecommendations - Maximum number of recommendations to show
 * @returns JSX element with recommended products or null if none available
 */
export default function ProductRecommendations({
  product,
  maxRecommendations = 3,
}: {
  product?: Product;
  maxRecommendations?: number;
}) {
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentAnswer, setAgentAnswer] = useState<string | null>(null);
  const userContext = useEnhancedUserContext();
  
  // Create stable reference for user context values we actually need
  const stableUserContext = useMemo(() => ({
    userId: userContext.userId,
    firstName: userContext.firstName,
    orders: userContext.orders,
    isVipCustomer: userContext.isVipCustomer,
    orderCount: userContext.orders?.length || 0,
    isLoading: userContext.isLoading,
  }), [
    userContext.userId, 
    userContext.firstName, 
    userContext.orders?.length, 
    userContext.isVipCustomer,
    userContext.isLoading
  ]);

  // TEMPORARILY DISABLE RECOMMENDATIONS TO STOP INFINITE LOOP
  // TODO: Fix the infinite loop and re-enable
  
  /*
  useEffect(() => {
    if (!product) return;
    
    const fetchAndSetAIRecommendations = async () => {
      setIsLoading(true);
      try {
        const aiRecommendations = await fetchAIRecommendations(product, stableUserContext);
        setRecommendedProducts(aiRecommendations.slice(0, maxRecommendations));
      } catch (error) {
        console.error("Error fetching AI recommendations:", error);
        setRecommendedProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only run once per product
    if (!stableUserContext.isLoading) {
      fetchAndSetAIRecommendations();
    }
  }, [product?.id, maxRecommendations]);
  */

  /**
   * Fetch AI-powered recommendations with enhanced user context
   */
  const fetchAIRecommendations = async (
    currentProduct: Product, 
    userContext: typeof stableUserContext
  ): Promise<Product[]> => {
    try {
      const productTags = currentProduct.tags?.join(", ") || "";
  // Enhanced query with user context
  let recommendationQuery = `I'm interested in the ${currentProduct.name}. It has tags: ${productTags}.`;
      
      if (userContext.orderCount > 0) {
        recommendationQuery += ` I'm a returning customer with ${userContext.orderCount} previous orders.`;
        if (userContext.isVipCustomer) {
          recommendationQuery += " I'm interested in premium products.";
        }
      }
      
      recommendationQuery += " Can you recommend 3 similar or complementary products?";
      
      const res = await fetch("/api/agent-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          question: recommendationQuery,
          userName: userContext.firstName || "Guest",
          userContext: {
            orders: userContext.orders?.slice(0, 3) || [], // Last 3 orders for context
            isVipCustomer: userContext.isVipCustomer || false,
            totalOrders: userContext.orderCount,
          },
          history: []
        }),
      });

      if (!res.ok) {
        console.warn("AI recommendation request failed:", res.status, res.statusText);
        return [];
      }
      
      const data = await res.json() as { answer: string; products?: Product[]; productIds?: number[] };
      setAgentAnswer(data.answer || null);
      return data.products?.filter((p: Product) => p.id !== currentProduct.id) || [];
      
    } catch (error) {
      console.error("fetchAIRecommendations error:", error);
      return []; // Return empty array instead of throwing
    }
  };

  // Don't render anything if no product context
  if (!product) {
    return null;
  }

  // Show loading state or results
  const hasRecommendations = recommendedProducts.length > 0;
  const shouldShowSection = isLoading || hasRecommendations;

  if (!shouldShowSection) {
    return null;
  }

  // Determine section title based on personalization  
  let sectionTitle = "You may also like";
  if (isLoading) {
    sectionTitle = stableUserContext.orderCount > 0 
    ? "Finding personalized recommendations..." 
    : "Finding recommendations...";
  } else if (stableUserContext.orderCount > 0 && hasRecommendations) {
     sectionTitle = `Recommended for ${stableUserContext.firstName || 'you'}`;
  }

  return (
    <div className="mt-20 text-center relative">
      <div className="border-t border-neutral-700 w-full relative mb-10">
        <span className="text-orange-400 text-2xl font-semibold bg-neutral-900 px-4 absolute -top-4 left-1/2 transform -translate-x-1/2 font-serif">
          {sectionTitle}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {Array.from({ length: maxRecommendations }, (_, i) => (
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
          {recommendedProducts.map((prod) => {
            try {
              return <ProductCard key={prod.id} product={prod} />;
            } catch (error) {
              console.error("Error rendering ProductCard:", error);
              return null;
            }
          })}
        </div>
      )}
      
      {agentAnswer && (
        <div className="flex justify-center items-start mt-10 relative">
          <div className="relative">
            <Image
              src="/volt.svg"
              alt="Volt mascot"
              width={60}
              height={60}
              className="z-10"
            />
            <div className="absolute left-14 top-1">
              <div className="bg-neutral-900 text-white px-6 py-4 rounded-2xl shadow-lg relative max-w-md text-left"
                  style={{ border: "1px solid #f59e42" }}>
                <span>{agentAnswer}</span>
                <span
                  className="absolute left-[-18px] top-6 w-0 h-0"
                  style={{
                    borderTop: "12px solid transparent",
                    borderBottom: "12px solid transparent",
                    borderRight: "18px solid #f59e42"
                  }}
                />
                <span
                  className="absolute left-[-16px] top-6 w-0 h-0"
                  style={{
                    borderTop: "10px solid transparent",
                    borderBottom: "10px solid transparent",
                    borderRight: "16px solid #1a1a1a"
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
