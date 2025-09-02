import { searchProducts, getProductBySlug } from '../../models/mach/products';
import { RecommendRequest, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';
import { Product } from '../../types/mach/product_types';

export async function getRecommendations(
  request: RecommendRequest,
  sessionId: string
): Promise<MCPToolResponse<Product[]>> {
  const startTime = Date.now();
  
  try {
    const { context } = request;
    const userContext = enhanceUserContext(request.agent_context);
    
    let recommendations: Product[] = [];
    
    // Get current product context if provided
    let currentProduct: Product | null = null;
    if (context.currentProduct) {
      currentProduct = await getProductBySlug(context.currentProduct.toString());
    }
    
    // Generate recommendations based on context
    if (context.useCase) {
      recommendations = await getUseCaseRecommendations(context.useCase, userContext);
    } else if (context.userActivity) {
      recommendations = await getActivityRecommendations(context.userActivity, userContext);
    } else if (currentProduct) {
      recommendations = await getRelatedProductRecommendations(currentProduct, userContext);
    } else {
      // General recommendations based on user context
      recommendations = await getGeneralRecommendations(userContext);
    }
    
    // Filter by budget if provided
    if (context.budget || userContext.budget) {
      const budget = context.budget || userContext.budget;
      recommendations = recommendations.filter(product => {
        const price = product.variants?.[0]?.price || 0;
        return price <= budget!;
      });
    }
    
    // Sort by relevance and quality
    recommendations = sortRecommendations(recommendations, userContext);
    
    // Limit to top 10
    recommendations = recommendations.slice(0, 10);
    
    // Generate cross-site recommendations
    const alternativeSites = generateCrossSiteRecommendations(context, userContext);
    const bundlingOpportunities = generateBundlingRecommendations(recommendations);
    const costOptimizations = generateCostRecommendations(recommendations, context.budget || userContext.budget);
    
    const fulfillmentPercentage = recommendations.length > 0 ? 100 : 50;
    const satisfaction = calculateRecommendationSatisfaction(recommendations, userContext, context);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: recommendations,
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: {
        alternative_sites: alternativeSites,
        bundling_opportunities: bundlingOpportunities,
        cost_optimization: costOptimizations
      },
      metadata: {
        can_fulfill_percentage: fulfillmentPercentage,
        estimated_satisfaction: satisfaction,
        next_actions: generateRecommendationActions(recommendations, context)
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: [],
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Check recommendation parameters', 'Try different context']
      }
    };
  }
}

async function getUseCaseRecommendations(useCase: string, userContext: any): Promise<Product[]> {
  const useCaseLower = useCase.toLowerCase();
  
  if (useCaseLower.includes('camping') || useCaseLower.includes('camp')) {
    return await searchProducts('camping tent sleeping bag');
  }
  
  if (useCaseLower.includes('hiking') || useCaseLower.includes('trail')) {
    return await searchProducts('hiking backpack boots');
  }
  
  if (useCaseLower.includes('backpack')) {
    return await searchProducts('backpacking ultralight');
  }
  
  // Default to general outdoor gear
  return await searchProducts('outdoor adventure gear');
}

async function getActivityRecommendations(activity: string, userContext: any): Promise<Product[]> {
  // Map activities to product searches
  const activityMap: Record<string, string> = {
    'weekend_camping': 'car camping tent sleeping bag',
    'backpacking': 'ultralight backpacking gear',
    'day_hiking': 'day pack hiking boots',
    'mountaineering': 'alpine climbing gear',
    'winter_camping': 'winter tent sleeping system'
  };
  
  const searchQuery = activityMap[activity] || activity;
  return await searchProducts(searchQuery);
}

async function getRelatedProductRecommendations(product: Product, userContext: any): Promise<Product[]> {
  const category = product.category_name || 'outdoor gear';
  return await searchProducts(category);
}

async function getGeneralRecommendations(userContext: any): Promise<Product[]> {
  // Base recommendations on user activities or default to popular items
  if (userContext.activities?.length > 0) {
    const activity = userContext.activities[0];
    return await searchProducts(activity);
  }
  
  // Default to popular outdoor essentials
  return await searchProducts('popular outdoor gear essentials');
}

function sortRecommendations(products: Product[], userContext: any): Product[] {
  return products.sort((a, b) => {
    let aScore = 0;
    let bScore = 0;
    
    // Prefer products matching user activities
    if (userContext.activities) {
      for (const activity of userContext.activities) {
        if (a.name?.toLowerCase().includes(activity.toLowerCase()) || 
            a.description?.toLowerCase().includes(activity.toLowerCase())) {
          aScore += 10;
        }
        if (b.name?.toLowerCase().includes(activity.toLowerCase()) || 
            b.description?.toLowerCase().includes(activity.toLowerCase())) {
          bScore += 10;
        }
      }
    }
    
    // Prefer products from preferred brands
    if (userContext.preferredBrands) {
      for (const brand of userContext.preferredBrands) {
        if (a.name?.toLowerCase().includes(brand.toLowerCase())) aScore += 5;
        if (b.name?.toLowerCase().includes(brand.toLowerCase())) bScore += 5;
      }
    }
    
    // Consider price within budget
    const aPrice = a.variants?.[0]?.price || 0;
    const bPrice = b.variants?.[0]?.price || 0;
    
    if (userContext.budget) {
      if (aPrice <= userContext.budget) aScore += 2;
      if (bPrice <= userContext.budget) bScore += 2;
    }
    
    return bScore - aScore;
  });
}

function generateCrossSiteRecommendations(context: any, userContext: any): string[] {
  const suggestions: string[] = [];
  
  if (context.useCase?.toLowerCase().includes('food') || context.userActivity?.includes('meal')) {
    suggestions.push('Mountain House for freeze-dried meals and rations');
    suggestions.push('REI for comprehensive outdoor food selection');
  }
  
  if (context.useCase?.toLowerCase().includes('ski') || context.userActivity?.includes('winter')) {
    suggestions.push('Backcountry.com for specialized winter sports equipment');
    suggestions.push('Local ski shops for cross-country skiing gear');
  }
  
  if (userContext.experienceLevel === 'expert') {
    suggestions.push('Specialist manufacturers for high-end technical gear');
  }
  
  return suggestions;
}

function generateBundlingRecommendations(products: Product[]): string[] {
  const recommendations: string[] = [];
  
  const hasTent = products.some(p => p.name?.toLowerCase().includes('tent'));
  const hasSleeping = products.some(p => p.name?.toLowerCase().includes('sleeping') || p.name?.toLowerCase().includes('bag'));
  const hasBackpack = products.some(p => p.name?.toLowerCase().includes('pack') || p.name?.toLowerCase().includes('backpack'));
  
  if (hasTent && hasSleeping) {
    recommendations.push('Complete shelter system: tent + sleeping setup bundle available');
  }
  
  if (hasBackpack && hasSleeping) {
    recommendations.push('Backpacking essentials: pack + sleeping system combo deals');
  }
  
  return recommendations;
}

function generateCostRecommendations(products: Product[], budget?: number): string[] {
  if (!budget) return [];
  
  const recommendations: string[] = [];
  const totalCost = products.reduce((sum, p) => sum + (p.variants?.[0]?.price || 0), 0);
  
  if (totalCost > budget * 1.2) {
    recommendations.push('Consider base models to stay within budget');
    recommendations.push('Look for seasonal sales on similar items');
  } else if (totalCost < budget * 0.8) {
    recommendations.push('Budget allows for premium upgrades');
    recommendations.push('Consider adding complementary gear within budget');
  }
  
  return recommendations;
}

function calculateRecommendationSatisfaction(products: Product[], userContext: any, context: any): number {
  let satisfaction = 60; // Base satisfaction
  
  if (products.length > 0) satisfaction += 20;
  if (products.length >= 5) satisfaction += 10;
  
  // Boost for matching user preferences
  if (userContext.activities?.length > 0) {
    const matchingProducts = products.filter(p => 
      userContext.activities.some((activity: string) => 
        p.name?.toLowerCase().includes(activity.toLowerCase()) ||
        p.description?.toLowerCase().includes(activity.toLowerCase())
      )
    );
    satisfaction += (matchingProducts.length / products.length) * 20;
  }
  
  return Math.min(100, satisfaction);
}

function generateRecommendationActions(products: Product[], context: any): string[] {
  const actions: string[] = [];
  
  if (products.length > 0) {
    actions.push('Review recommended products');
    actions.push('Add preferred items to cart');
    actions.push('Get detailed product comparisons');
  }
  
  if (context.budget) {
    actions.push('Verify items fit within budget');
  }
  
  if (products.length === 0) {
    actions.push('Refine search criteria');
    actions.push('Browse related categories');
  }
  
  return actions;
}