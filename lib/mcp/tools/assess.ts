import { searchProducts } from '../../models/mach/products';
import { AssessRequest, AssessResponse, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';
import { Money } from '../../money';
import { toPublicProduct, toWireProduct } from '../../models/mach/product-serializer';
import { isBoundedString, isPlainRecord } from '../../public-request-validation';

export async function assessFulfillmentCapability(
  request: AssessRequest,
  sessionId: string
): Promise<MCPToolResponse<AssessResponse>> {
  const startTime = Date.now();
  
  try {
    if (!isPlainRecord(request?.requirements)) throw new Error('requirements are required');
    const rawItems = request.requirements.items;
    if (
      !Array.isArray(rawItems) ||
      rawItems.length === 0 ||
      rawItems.length > 20 ||
      rawItems.some((item) => !isBoundedString(item, 256))
    ) {
      throw new Error('requirements.items must contain 1-20 non-empty strings');
    }
    if (
      request.requirements.budget !== undefined &&
      (!Number.isFinite(request.requirements.budget) || request.requirements.budget < 0)
    ) {
      throw new Error('requirements.budget must be a non-negative finite number');
    }
    if (
      (request.requirements.timeline !== undefined &&
        !isBoundedString(request.requirements.timeline, 256, { allowEmpty: true })) ||
      (request.requirements.location !== undefined &&
        !isBoundedString(request.requirements.location, 256, { allowEmpty: true }))
    ) {
      throw new Error('requirements timeline and location are too long');
    }
    const requirements = {
      ...request.requirements,
      items: rawItems.map((item) => item.trim()),
    };
    const userContext = enhanceUserContext(request.agent_context || null);
    
    // Assess each requested item
    const assessmentResults: Array<{item: string, confidence: number, products: any[]}> =
      await Promise.all(requirements.items.map(async (item) => {
        const products = await searchProducts(item);
        return { item, confidence: calculateConfidence(products), products };
      }));
    const canFulfill = assessmentResults
      .filter((result) => result.products.length > 0)
      .map((result) => result.item);
    const cannotFulfill = assessmentResults
      .filter((result) => result.products.length === 0)
      .map((result) => result.item);
    
    // Generate recommendations from items we can fulfill
    const recommendations = assessmentResults
      .filter(result => result.confidence > 0.6)
      .flatMap(result => result.products)
      .slice(0, 10); // Limit recommendations
    
    // Calculate estimated cost and delivery
    const estimatedCost = recommendations.reduce((sum, product) => {
      const price = product.variants?.[0]?.price;
      return sum.add(price ? Money.fromStored(price) : Money.zero(sum.currency));
    }, Money.zero()).toMach().amount;
    
    const estimatedDelivery = calculateDeliveryEstimate(requirements.location, requirements.timeline);
    
    // Generate alternative site suggestions for items we can't fulfill
    const alternativeSites = generateAlternativeSiteRecommendations(cannotFulfill);
    
    const fulfillmentPercentage = (canFulfill.length / requirements.items.length) * 100;
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        can_fulfill: canFulfill,
        cannot_fulfill: cannotFulfill,
        recommendations: recommendations
          .filter(product => product.status === 'active')
          .map(product => toWireProduct(toPublicProduct(product))),
        estimated_cost: estimatedCost,
        estimated_delivery: estimatedDelivery
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: alternativeSites.length > 0 ? {
        alternative_sites: alternativeSites,
        bundling_opportunities: generateBundlingOpportunities(assessmentResults),
        cost_optimization: generateCostOptimizations(assessmentResults, userContext.budget)
      } : undefined,
      metadata: {
        can_fulfill_percentage: fulfillmentPercentage,
        estimated_satisfaction: calculateSatisfaction(assessmentResults, userContext),
        next_actions: generateNextActions(canFulfill, cannotFulfill, fulfillmentPercentage)
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: {
        can_fulfill: [],
        cannot_fulfill: Array.isArray(request?.requirements?.items)
          ? request.requirements.items.filter((item): item is string => typeof item === 'string').slice(0, 20)
          : [],
        recommendations: [],
        estimated_cost: 0,
        estimated_delivery: 'Unknown'
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Retry assessment', 'Contact support']
      }
    };
  }
}

function calculateConfidence(products: any[]): number {
  let confidence = 0;
  
  // Base confidence from search results
  if (products.length > 0) confidence += 0.4;
  if (products.length > 2) confidence += 0.2;
  
  return Math.max(0, Math.min(1, confidence));
}

function calculateDeliveryEstimate(location?: string, timeline?: string): string {
  // Simple delivery estimation logic
  if (timeline?.toLowerCase().includes('urgent') || timeline?.toLowerCase().includes('fast')) {
    return '2-3 business days (expedited)';
  }
  
  if (location?.toLowerCase().includes('alaska') || location?.toLowerCase().includes('hawaii')) {
    return '5-7 business days';
  }
  
  return '3-5 business days';
}

function generateAlternativeSiteRecommendations(cannotFulfill: string[]): string[] {
  return cannotFulfill.length ? ['Search another catalog for unavailable items'] : [];
}

function generateBundlingOpportunities(results: Array<{item: string, products: any[]}>): string[] {
  return results.filter((result) => result.products.length > 0).length > 1
    ? ['Review matching products together for complementary options']
    : [];
}

function generateCostOptimizations(results: Array<{item: string, products: any[]}>, budget?: number): string[] {
  if (!budget) return [];
  
  const optimizations: string[] = [];
  const totalEstimated = results.reduce((sum, result) => {
    const minPrice = Math.min(...result.products.map(p => p.variants?.[0]?.price ? Money.fromStored(p.variants[0].price).toMach().amount : Infinity));
    return sum + (minPrice === Infinity ? 0 : minPrice);
  }, 0);
  
  if (totalEstimated > budget) {
    optimizations.push('Consider base models instead of premium versions to stay within budget');
    optimizations.push('Look for bundle deals to reduce overall cost');
  }
  
  return optimizations;
}

function calculateSatisfaction(results: Array<{confidence: number}>, userContext: any): number {
  if (results.length === 0) return 0;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  
  // Boost satisfaction if we match user preferences
  let satisfactionBoost = 0;
  if (userContext.activities?.length) satisfactionBoost += 10;
  if (userContext.experienceLevel === 'expert') satisfactionBoost += 5;
  
  return Math.min(100, (avgConfidence * 80) + satisfactionBoost);
}

function generateNextActions(canFulfill: string[], cannotFulfill: string[], fulfillmentPercentage: number): string[] {
  const actions: string[] = [];
  
  if (canFulfill.length > 0) {
    actions.push('Add recommended items to cart');
    actions.push('Get detailed product specifications');
  }
  
  if (cannotFulfill.length > 0) {
    actions.push('Contact alternative retailers for remaining items');
  }
  
  if (fulfillmentPercentage > 80) {
    actions.push('Proceed with this store order');
  } else {
    actions.push('Consider splitting order across multiple retailers');
  }
  
  return actions;
}
