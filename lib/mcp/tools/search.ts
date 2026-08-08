import { searchProducts } from '../../models/mach/products';
import { SearchRequest, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';
import { toPublicProduct, toWireProduct, type WireProduct } from '../../models/mach/product-serializer';
import { isBoundedString, isPlainRecord } from '../../public-request-validation';
import { Money } from '../../money';

export async function searchProductsWithContext(
  request: SearchRequest,
  sessionId: string
): Promise<MCPToolResponse<WireProduct[]>> {
  const startTime = Date.now();
  
  try {
    if (!isBoundedString(request?.query, 256)) {
      throw new Error('Search query must be a non-empty string of at most 256 characters');
    }
    // Enhance search with agent context
    const userContext = enhanceUserContext(request.agent_context || null);
    
    if (request.options !== undefined && !isPlainRecord(request.options)) {
      throw new Error('Search options must be an object');
    }
    const options = { ...request.options };
    for (const [name, value] of [['priceMin', options.priceMin], ['priceMax', options.priceMax]] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new Error(`${name} must be a non-negative finite number`);
      }
    }
    if (options.priceMin !== undefined && options.priceMax !== undefined && options.priceMin > options.priceMax) {
      throw new Error('priceMin cannot exceed priceMax');
    }
    if (options.category !== undefined && !isBoundedString(options.category, 128)) {
      throw new Error('category must be a non-empty string of at most 128 characters');
    }
    if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100)) {
      throw new Error('limit must be an integer between 1 and 100');
    }
    if (options.sortBy !== undefined && options.sortBy !== 'price') {
      throw new Error("sortBy currently supports only 'price'");
    }
    if (userContext.budget !== undefined) {
      options.priceMax = Math.min(options.priceMax ?? userContext.budget, userContext.budget);
    }

    // Search products
    const products = await searchProducts(request.query);
    
    // Filter by user preferences if provided
    let filteredProducts = products.filter((product) => product.status === 'active');
    if (options.category) {
      const category = options.category.toLowerCase();
      filteredProducts = filteredProducts.filter((product) =>
        product.categories?.some((candidate) => candidate.toLowerCase() === category)
      );
    }
    if (options.priceMin !== undefined || options.priceMax !== undefined) {
      filteredProducts = filteredProducts.filter((product) => {
        const price = lowestVariantPrice(product);
        return price !== null &&
          (options.priceMin === undefined || price >= options.priceMin) &&
          (options.priceMax === undefined || price <= options.priceMax);
      });
    }
    if (userContext.preferredBrands?.length > 0) {
      filteredProducts = filteredProducts.filter(product =>
        userContext.preferredBrands.some((brand: string) => 
          (typeof product.brand === 'string' && product.brand.toLowerCase().includes(brand.toLowerCase())) ||
          (typeof product.name === 'string' ? product.name : String(product.name || '')).toLowerCase().includes(brand.toLowerCase()) ||
          (typeof product.description === 'string' ? product.description : String(product.description || '')).toLowerCase().includes(brand.toLowerCase())
        )
      );
    }
    if (options.sortBy === 'price') {
      filteredProducts.sort((a, b) =>
        (lowestVariantPrice(a) ?? Number.POSITIVE_INFINITY) -
        (lowestVariantPrice(b) ?? Number.POSITIVE_INFINITY)
      );
    }
    filteredProducts = filteredProducts.slice(0, options.limit ?? 10);

    // Calculate fulfillment metrics
    const totalRequested = 1; // Single search query
    const canFulfill = filteredProducts.length > 0 ? 1 : 0;
    const fulfillmentPercentage = (canFulfill / totalRequested) * 100;

    // Generate recommendations for items we can't fulfill well
    const recommendations: string[] = [];
    if (fulfillmentPercentage < 80) recommendations.push('Try broader or category-level search terms');

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: filteredProducts.map((product) => toWireProduct(toPublicProduct(product))),
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

function lowestVariantPrice(product: Awaited<ReturnType<typeof searchProducts>>[number]): number | null {
  const prices = (product.variants ?? []).flatMap((variant) => {
    if (variant.status != null && variant.status !== 'active') return [];
    try {
      return [Money.fromStored(variant.price).toMach().amount];
    } catch {
      return [];
    }
  });
  return prices.length > 0 ? prices.reduce((lowest, price) => Math.min(lowest, price)) : null;
}
