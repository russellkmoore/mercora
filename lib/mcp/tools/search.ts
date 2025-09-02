import { searchProducts } from '../../models/mach/products';
import { SearchRequest, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';
import { Product } from '../../types/mach/product_types';

export async function searchProductsWithContext(
  request: SearchRequest,
  sessionId: string
): Promise<MCPToolResponse<Product[]>> {
  const startTime = Date.now();
  
  try {
    // Enhance search with agent context
    const userContext = enhanceUserContext(request.agent_context);
    
    // Apply budget filter if provided
    const options = { ...request.options };
    if (userContext.budget) {
      options.priceMax = Math.min(options.priceMax || userContext.budget, userContext.budget);
    }

    // Search products
    const products = await searchProducts(request.query);
    
    // Filter by user preferences if provided
    let filteredProducts = products;
    if (userContext.preferredBrands?.length > 0) {
      filteredProducts = products.filter(product => 
        userContext.preferredBrands.some((brand: string) => 
          product.name?.toLowerCase().includes(brand.toLowerCase()) ||
          product.description?.toLowerCase().includes(brand.toLowerCase())
        )
      );
    }

    // Calculate fulfillment metrics
    const totalRequested = 1; // Single search query
    const canFulfill = filteredProducts.length > 0 ? 1 : 0;
    const fulfillmentPercentage = (canFulfill / totalRequested) * 100;

    // Generate recommendations for items we can't fulfill well
    const recommendations: string[] = [];
    if (fulfillmentPercentage < 80) {
      if (request.query.toLowerCase().includes('ration') || request.query.toLowerCase().includes('food')) {
        recommendations.push('Consider specialized outdoor food retailers for rations and meal planning');
      }
      if (request.query.toLowerCase().includes('ski') || request.query.toLowerCase().includes('snow')) {
        recommendations.push('Check dedicated ski shops for cross-country skiing equipment');
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: filteredProducts,
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: recommendations.length > 0 ? {
        alternative_sites: recommendations
      } : undefined,
      metadata: {
        can_fulfill_percentage: fulfillmentPercentage,
        estimated_satisfaction: Math.min(fulfillmentPercentage + (filteredProducts.length * 10), 100),
        next_actions: filteredProducts.length > 0 ? ['Add items to cart', 'Get detailed product info'] : ['Try broader search terms']
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
        next_actions: ['Check search query format', 'Try different search terms']
      }
    };
  }
}