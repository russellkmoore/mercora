import { searchProducts, getProductBySlug } from '../../models/mach/products';
import { RecommendRequest, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';
import { Product } from '../../types';
import { Money } from '../../money';
import { toPublicProduct, toWireProduct, type WireProduct } from '../../models/mach/product-serializer';
import { genericBundleSuggestions } from '../catalog';
import { isBoundedString, isPlainRecord } from '../../public-request-validation';

export async function getRecommendations(
  request: RecommendRequest,
  sessionId: string
): Promise<MCPToolResponse<WireProduct[]>> {
  const startTime = Date.now();
  
  try {
    const context = isPlainRecord(request?.context) ? request.context : {};
    if (
      (context.useCase !== undefined && !isBoundedString(context.useCase, 256)) ||
      (context.userActivity !== undefined && !isBoundedString(context.userActivity, 256)) ||
      (context.budget !== undefined &&
        (typeof context.budget !== 'number' || !Number.isFinite(context.budget) || context.budget < 0)) ||
      (context.currentProduct !== undefined && !Number.isSafeInteger(context.currentProduct))
    ) {
      throw new Error('Recommendation context is invalid');
    }
    const userContext = enhanceUserContext(request.agent_context || null);
    
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
        const price = product.variants?.[0]?.price;
        return !price || Money.fromStored(price).toMach().amount <= budget!;
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
      data: recommendations
        .filter((product) => product.status === 'active')
        .map((product) => toWireProduct(toPublicProduct(product))),
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
  return searchProducts(useCase);
}

async function getActivityRecommendations(activity: string, userContext: any): Promise<Product[]> {
  return searchProducts(activity.replace(/_/g, ' '));
}

async function getRelatedProductRecommendations(product: Product, userContext: any): Promise<Product[]> {
  const query = product.categories?.[0] || String(product.name || '');
  return searchProducts(query);
}

async function getGeneralRecommendations(userContext: any): Promise<Product[]> {
  // Base recommendations on user activities or default to popular items
  if (userContext.activities?.length > 0) {
    const activity = userContext.activities[0];
    return await searchProducts(activity);
  }
  
  return searchProducts('');
}

function sortRecommendations(products: Product[], userContext: any): Product[] {
  return products.sort((a, b) => {
    let aScore = 0;
    let bScore = 0;
    
    // Prefer products matching user activities
    if (userContext.activities) {
      for (const activity of userContext.activities) {
        if ((typeof a.name === 'string' ? a.name : String(a.name || '')).toLowerCase().includes(activity.toLowerCase()) || 
            (typeof a.description === 'string' ? a.description : String(a.description || '')).toLowerCase().includes(activity.toLowerCase())) {
          aScore += 10;
        }
        if ((typeof b.name === 'string' ? b.name : String(b.name || '')).toLowerCase().includes(activity.toLowerCase()) || 
            (typeof b.description === 'string' ? b.description : String(b.description || '')).toLowerCase().includes(activity.toLowerCase())) {
          bScore += 10;
        }
      }
    }
    
    // Prefer products from preferred brands
    if (userContext.preferredBrands) {
      for (const brand of userContext.preferredBrands) {
        if ((typeof a.name === 'string' ? a.name : String(a.name || '')).toLowerCase().includes(brand.toLowerCase())) aScore += 5;
        if ((typeof b.name === 'string' ? b.name : String(b.name || '')).toLowerCase().includes(brand.toLowerCase())) bScore += 5;
      }
    }
    
    // Consider price within budget
    const aPrice = a.variants?.[0]?.price ? Money.fromStored(a.variants[0].price).toMach().amount : 0;
    const bPrice = b.variants?.[0]?.price ? Money.fromStored(b.variants[0].price).toMach().amount : 0;
    
    if (userContext.budget) {
      if (aPrice <= userContext.budget) aScore += 2;
      if (bPrice <= userContext.budget) bScore += 2;
    }
    
    return bScore - aScore;
  });
}

function generateCrossSiteRecommendations(context: any, userContext: any): string[] {
  return [];
}

function generateBundlingRecommendations(products: Product[]): string[] {
  return genericBundleSuggestions(new Set(products.map((product) => product.id)).size);
}

function generateCostRecommendations(products: Product[], budget?: number): string[] {
  if (!budget) return [];
  
  const recommendations: string[] = [];
  const totalCost = products.reduce((sum, product) => {
    const price = product.variants?.[0]?.price;
    return sum.add(price ? Money.fromStored(price) : Money.zero(sum.currency));
  }, Money.zero()).toMach().amount;
  
  if (totalCost > budget * 1.2) {
    recommendations.push('Consider lower-priced variants to stay within budget');
    recommendations.push('Look for seasonal sales on similar items');
  } else if (totalCost < budget * 0.8) {
    recommendations.push('Budget allows for premium upgrades');
    recommendations.push('Consider adding complementary catalog items within budget');
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
        (typeof p.name === 'string' ? p.name : String(p.name || '')).toLowerCase().includes(activity.toLowerCase()) ||
        (typeof p.description === 'string' ? p.description : String(p.description || '')).toLowerCase().includes(activity.toLowerCase())
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
