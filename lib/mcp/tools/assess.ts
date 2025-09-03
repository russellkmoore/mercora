import { searchProducts } from '../../models/mach/products';
import { listCategories } from '../../models/mach/category';
import { AssessRequest, AssessResponse, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';

export async function assessFulfillmentCapability(
  request: AssessRequest,
  sessionId: string
): Promise<MCPToolResponse<AssessResponse>> {
  const startTime = Date.now();
  
  try {
    const requirements = request.requirements;
    const userContext = enhanceUserContext(request.agent_context || null);
    
    // Get our categories and capabilities
    const categories = await listCategories();
    const categoryNames = categories.map(cat => typeof cat.name === 'string' ? cat.name.toLowerCase() : String(cat.name || '').toLowerCase());
    
    // Define Voltique's core specialties
    const ourSpecialties = [
      'camping', 'hiking', 'backpacking', 'outdoor', 'tent', 'sleeping bag',
      'backpack', 'headlamp', 'stove', 'gear', 'adventure', 'trail', 'mountain'
    ];
    
    // Assess each requested item
    const canFulfill: string[] = [];
    const cannotFulfill: string[] = [];
    const assessmentResults: Array<{item: string, confidence: number, products: any[]}> = [];
    
    for (const item of requirements.items) {
      const itemLower = item.toLowerCase();
      
      // Check if item matches our specialties
      const isOurSpecialty = ourSpecialties.some(specialty => 
        itemLower.includes(specialty) || specialty.includes(itemLower)
      );
      
      // Search for products matching this item
      const searchResults = await searchProducts(item);
      
      const confidence = calculateConfidence(itemLower, searchResults, isOurSpecialty);
      
      assessmentResults.push({
        item,
        confidence,
        products: searchResults
      });
      
      if (confidence > 0.6 || searchResults.length > 0) {
        canFulfill.push(item);
      } else {
        cannotFulfill.push(item);
      }
    }
    
    // Generate recommendations from items we can fulfill
    const recommendations = assessmentResults
      .filter(result => result.confidence > 0.6)
      .flatMap(result => result.products)
      .slice(0, 10); // Limit recommendations
    
    // Calculate estimated cost and delivery
    const estimatedCost = recommendations.reduce((sum, product) => {
      const price = product.variants?.[0]?.price || 0;
      return sum + price;
    }, 0);
    
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
        recommendations,
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
        cannot_fulfill: request.requirements?.items || [],
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

function calculateConfidence(item: string, products: any[], isOurSpecialty: boolean): number {
  let confidence = 0;
  
  // Base confidence from search results
  if (products.length > 0) confidence += 0.4;
  if (products.length > 2) confidence += 0.2;
  
  // Boost for our specialties
  if (isOurSpecialty) confidence += 0.3;
  
  // Reduce confidence for items we typically don't carry
  const nonOutdoorItems = ['ration', 'food', 'ski', 'snow', 'electronic', 'book'];
  if (nonOutdoorItems.some(non => item.includes(non))) {
    confidence -= 0.3;
  }
  
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
  const suggestions: string[] = [];
  
  cannotFulfill.forEach(item => {
    const itemLower = item.toLowerCase();
    
    if (itemLower.includes('food') || itemLower.includes('ration') || itemLower.includes('meal')) {
      suggestions.push('Mountain House or Backpacker\'s Pantry for freeze-dried meals');
    }
    
    if (itemLower.includes('ski') || itemLower.includes('snow')) {
      suggestions.push('Backcountry.com or REI for specialized snow sports equipment');
    }
    
    if (itemLower.includes('electronic') || itemLower.includes('gps')) {
      suggestions.push('Garmin or outdoor electronics specialists');
    }
  });
  
  return [...new Set(suggestions)]; // Remove duplicates
}

function generateBundlingOpportunities(results: Array<{item: string, products: any[]}>): string[] {
  const opportunities: string[] = [];
  
  const hasSheltier = results.some(r => r.item.toLowerCase().includes('tent') || r.item.toLowerCase().includes('shelter'));
  const hasSleep = results.some(r => r.item.toLowerCase().includes('sleep') || r.item.toLowerCase().includes('bag'));
  
  if (hasSheltier && hasSleep) {
    opportunities.push('Camping comfort bundle: tent + sleeping system discount available');
  }
  
  return opportunities;
}

function generateCostOptimizations(results: Array<{item: string, products: any[]}>, budget?: number): string[] {
  if (!budget) return [];
  
  const optimizations: string[] = [];
  const totalEstimated = results.reduce((sum, result) => {
    const minPrice = Math.min(...result.products.map(p => p.variants?.[0]?.price || Infinity));
    return sum + (minPrice === Infinity ? 0 : minPrice);
  }, 0);
  
  if (totalEstimated > budget) {
    optimizations.push('Consider base models instead of premium versions to stay within budget');
    optimizations.push('Look for bundle deals to reduce overall cost');
  }
  
  return optimizations;
}

function calculateSatisfaction(results: Array<{confidence: number}>, userContext: any): number {
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  
  // Boost satisfaction if we match user preferences
  let satisfactionBoost = 0;
  if (userContext.activities?.includes('camping')) satisfactionBoost += 10;
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
    actions.push('Proceed with Voltique order');
  } else {
    actions.push('Consider splitting order across multiple retailers');
  }
  
  return actions;
}