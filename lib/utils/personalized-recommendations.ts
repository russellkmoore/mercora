/**
 * === Personalized Product Recommendations ===
 * 
 * Enhanced recommendation system that considers user order history,
 * preferences, and behavior to provide more relevant product suggestions.
 */

import type { Product } from "@/lib/types/product";
import type { Order } from "@/lib/types/order";
import type { EnhancedUserContext } from "@/lib/hooks/useEnhancedUserContext";

export interface RecommendationContext {
  userContext: EnhancedUserContext;
  currentProducts: Product[];
  viewingProduct?: Product;
  category?: string;
}

/**
 * Generate personalized product recommendations based on user context
 */
export function getPersonalizedRecommendations(
  context: RecommendationContext,
  allProducts: Product[],
  maxRecommendations: number = 4
): Product[] {
  const { userContext, currentProducts, viewingProduct, category } = context;
  
  // Filter out products user is currently viewing or has in current context
  const excludeIds = new Set([
    ...currentProducts.map(p => p.id),
    ...(viewingProduct ? [viewingProduct.id] : [])
  ]);
  
  const availableProducts = allProducts.filter(p => !excludeIds.has(p.id));
  
  if (availableProducts.length === 0) {
    return [];
  }

  // Score products based on user context
  const scoredProducts = availableProducts.map(product => ({
    product,
    score: calculatePersonalizationScore(product, userContext, viewingProduct, category)
  }));

  // Sort by score and return top recommendations
  return scoredProducts
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRecommendations)
    .map(item => item.product);
}

/**
 * Calculate personalization score for a product based on user context
 */
function calculatePersonalizationScore(
  product: Product,
  userContext: EnhancedUserContext,
  viewingProduct?: Product,
  category?: string
): number {
  let score = 0;

  // Base score
  score += 1;

  // Tag and use case matching
  if (viewingProduct && product.tags?.some((tag: string) => 
    viewingProduct.tags?.includes(tag)
  )) {
    score += 3; // Same tags as viewed product
  }

  if (viewingProduct && product.useCases?.some((useCase: string) => 
    viewingProduct.useCases?.includes(useCase)
  )) {
    score += 2; // Similar use cases
  }

  if (category && product.tags?.includes(category)) {
    score += 2; // Matches browsed category tag
  }

  // Order history analysis
  if (userContext.orders.length > 0) {
    // Check if user has bought similar products
    const purchasedProductIds = userContext.orders
      .flatMap(order => order.items.map(item => String(item.productId)));
    
    if (purchasedProductIds.includes(String(product.id))) {
      score -= 5; // Don't recommend products user already bought
    }

    // Analyze purchased categories for complementary recommendations
    // This would require product data hydration - simplified for now
    score += 1; // Small boost for returning customers
  }

  // Price range matching
  if (userContext.preferredPriceRange) {
    const productPrice = product.salePrice || product.price;
    const { min, max } = userContext.preferredPriceRange;
    
    if (productPrice >= min && productPrice <= max) {
      score += 2; // Within user's typical spending range
    } else if (productPrice > max) {
      score -= 1; // Above typical range
    }
  }

  // VIP customer boost
  if (userContext.isVipCustomer) {
    // Recommend premium products to VIP customers
    if (product.price > 5000) { // $50+ products
      score += 1;
    }
  }

  // Sale products boost
  if (product.onSale) {
    score += 1;
  }

  // Recent purchase patterns
  if (userContext.recentPurchases.length > 0) {
    // Boost complementary products (would need category mapping)
    score += 0.5;
  }

  return score;
}

/**
 * Generate recommendation explanation for debugging/transparency
 */
export function explainRecommendation(
  product: Product,
  userContext: EnhancedUserContext,
  viewingProduct?: Product
): string {
  const reasons: string[] = [];

  if (viewingProduct && product.tags?.some((tag: string) => 
    viewingProduct.tags?.includes(tag)
  )) {
    reasons.push("similar tags");
  }

  if (userContext.isVipCustomer && product.price > 5000) {
    reasons.push("premium recommendation for VIP");
  }

  if (product.onSale) {
    reasons.push("on sale");
  }

  if (userContext.orders.length > 0) {
    reasons.push("based on purchase history");
  }

  return reasons.length > 0 ? `Recommended because: ${reasons.join(", ")}` : "Popular product";
}

/**
 * Format user order history for AI context
 */
export function formatOrderHistoryForAI(orders: Order[]): string {
  if (orders.length === 0) {
    return "No previous orders - first-time customer";
  }

  const recentOrders = orders
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return recentOrders.map(order => {
    const itemCount = order.items?.length || 0;
    const total = (order.total / 100).toFixed(2);
    const status = order.status;
    const date = new Date(order.createdAt).toLocaleDateString();
    
    return `${date}: ${itemCount} items ($${total}) - ${status}`;
  }).join(' | ');
}
