/**
 * Personalized recommendations utility - MACH Migration Required
 * 
 * This utility needs to be updated to work with MACH Product schema structure.
 * Currently disabled as it expects legacy Product type fields.
 * 
 * @deprecated Will be re-implemented with MACH-compliant Product schema
 */

import type { Product, Order } from "@/lib/types";
import type { EnhancedUserContext } from "@/lib/hooks/useEnhancedUserContext";

export interface RecommendationContext {
  products: Product[];
  userContext: EnhancedUserContext;
  viewingProduct?: Product;
  category?: string;
  searchQuery?: string;
}

export function getPersonalizedRecommendations(context: RecommendationContext): Product[] {
  console.warn("getPersonalizedRecommendations is disabled during MACH migration.");
  return [];
}

export function createUserPersonalizationPrompt(userContext: EnhancedUserContext): string {
  console.warn("createUserPersonalizationPrompt is disabled during MACH migration.");
  return "";
}
