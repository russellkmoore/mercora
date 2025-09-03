import { getSession, updateSessionCart, getSessionCart } from '../session';
import { getProductBySlug } from '../../models/mach/products';
import { CartRequest, CartResponse, MCPToolResponse } from '../types';
import { CartItem } from '../../types/cartitem';

export async function addToCart(
  request: CartRequest & { sessionId: string },
  sessionId: string
): Promise<MCPToolResponse<CartResponse>> {
  const startTime = Date.now();
  
  try {
    // Get current cart
    const currentCart = await getSessionCart(sessionId);
    
    // Get product details
    const product = await getProductBySlug(request.productId.toString());
    if (!product) {
      throw new Error('Product not found');
    }

    // Find the specific variant
    const variant = product.variants?.find(v => String(v.id) === String(request.variantId));
    if (!variant) {
      throw new Error('Product variant not found');
    }

    // Check if item already exists in cart
    const existingItemIndex = currentCart.findIndex(item => String(item.variantId) === String(request.variantId));
    
    let updatedCart: CartItem[];
    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      updatedCart = [...currentCart];
      updatedCart[existingItemIndex].quantity += request.quantity || 1;
    } else {
      // Add new item to cart
      const newItem: CartItem = {
        productId: String(product.id!),
        variantId: String(request.variantId),
        quantity: request.quantity || 1,
        name: typeof product.name === 'string' ? product.name : String(product.name || ''),
        price: typeof variant.price === 'number' ? variant.price : (variant.price as any)?.amount || 0,
        primaryImageUrl: (product as any).image_url || ''
      };
      updatedCart = [...currentCart, newItem];
    }
    
    // Update session cart
    await updateSessionCart(sessionId, updatedCart);
    
    // Calculate totals
    const totalItems = updatedCart.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTotal = updatedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        cart: updatedCart,
        total_items: totalItems,
        estimated_total: estimatedTotal
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: {
        bundling_opportunities: generateCartBundlingOpportunities(updatedCart),
        cost_optimization: generateCartOptimizations(updatedCart, request.agent_context?.userPreferences?.budget)
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: calculateCartSatisfaction(updatedCart, request.agent_context),
        next_actions: generateCartActions(updatedCart)
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: { cart: [], total_items: 0, estimated_total: 0 },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Check product ID', 'Verify variant availability']
      }
    };
  }
}

export async function bulkAddToCart(
  request: { items: CartRequest[]; sessionId: string; agent_context?: any },
  sessionId: string
): Promise<MCPToolResponse<CartResponse>> {
  const startTime = Date.now();
  
  try {
    let currentCart = await getSessionCart(sessionId);
    let addedItems = 0;
    let failedItems: string[] = [];
    
    // Process each item
    for (const item of request.items) {
      try {
        const product = await getProductBySlug(item.productId.toString());
        if (!product) {
          failedItems.push(`Product ${item.productId} not found`);
          continue;
        }

        const variant = product.variants?.find(v => String(v.id) === String(item.variantId));
        if (!variant) {
          failedItems.push(`Variant ${item.variantId} not found for product ${item.productId}`);
          continue;
        }

        // Check if item already exists in cart
        const existingItemIndex = currentCart.findIndex(cartItem => String(cartItem.variantId) === String(item.variantId));
        
        if (existingItemIndex >= 0) {
          // Update quantity of existing item
          currentCart[existingItemIndex].quantity += item.quantity || 1;
        } else {
          // Add new item to cart
          const newItem: CartItem = {
            productId: String(product.id!),
            variantId: String(item.variantId),
            quantity: item.quantity || 1,
            name: typeof product.name === 'string' ? product.name : String(product.name || ''),
            price: typeof variant.price === 'number' ? variant.price : (variant.price as any)?.amount || 0,
            primaryImageUrl: (product as any).image_url || ''
          };
          currentCart.push(newItem);
        }
        
        addedItems++;
      } catch (error) {
        failedItems.push(`Failed to add item ${item.productId}: ${error}`);
      }
    }
    
    // Update session cart
    await updateSessionCart(sessionId, currentCart);
    
    // Calculate totals
    const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const processingTime = Date.now() - startTime;
    const successRate = addedItems / request.items.length;
    
    return {
      success: failedItems.length === 0,
      data: {
        cart: currentCart,
        total_items: totalItems,
        estimated_total: estimatedTotal
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: failedItems.length > 0 ? {
        alternative_sites: ['Check alternative retailers for failed items'],
        cost_optimization: generateCartOptimizations(currentCart, request.agent_context?.userPreferences?.budget)
      } : {
        bundling_opportunities: generateCartBundlingOpportunities(currentCart),
        cost_optimization: generateCartOptimizations(currentCart, request.agent_context?.userPreferences?.budget)
      },
      metadata: {
        can_fulfill_percentage: successRate * 100,
        estimated_satisfaction: calculateCartSatisfaction(currentCart, request.agent_context),
        next_actions: failedItems.length > 0 ? 
          ['Review failed items', 'Search alternatives', 'Proceed with successful items'] :
          ['Review cart', 'Proceed to checkout']
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: { cart: [], total_items: 0, estimated_total: 0 },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Check bulk add request format', 'Verify session exists']
      }
    };
  }
}

export async function clearCart(
  sessionId: string,
  agentId: string
): Promise<MCPToolResponse<CartResponse>> {
  const startTime = Date.now();
  
  try {
    await updateSessionCart(sessionId, []);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        cart: [],
        total_items: 0,
        estimated_total: 0
      },
      context: {
        session_id: sessionId,
        agent_id: agentId,
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 80,
        next_actions: ['Search for products', 'Get recommendations', 'Start fresh shopping session']
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: { cart: [], total_items: 0, estimated_total: 0 },
      context: {
        session_id: sessionId,
        agent_id: agentId,
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Check session ID', 'Create new session']
      }
    };
  }
}

export async function updateCart(
  request: CartRequest & { sessionId: string },
  sessionId: string
): Promise<MCPToolResponse<CartResponse>> {
  const startTime = Date.now();
  
  try {
    const currentCart = await getSessionCart(sessionId);
    const itemIndex = currentCart.findIndex(item => String(item.variantId) === String(request.variantId));
    
    if (itemIndex === -1) {
      throw new Error('Item not found in cart');
    }
    
    let updatedCart = [...currentCart];
    
    if (request.quantity && request.quantity > 0) {
      // Update quantity
      updatedCart[itemIndex].quantity = request.quantity;
    } else {
      // Remove item if quantity is 0 or not provided
      updatedCart.splice(itemIndex, 1);
    }
    
    await updateSessionCart(sessionId, updatedCart);
    
    const totalItems = updatedCart.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTotal = updatedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        cart: updatedCart,
        total_items: totalItems,
        estimated_total: estimatedTotal
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: calculateCartSatisfaction(updatedCart, request.agent_context),
        next_actions: generateCartActions(updatedCart)
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: { cart: [], total_items: 0, estimated_total: 0 },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Check cart item ID', 'Verify session exists']
      }
    };
  }
}

export async function removeFromCart(
  request: CartRequest & { sessionId: string },
  sessionId: string
): Promise<MCPToolResponse<CartResponse>> {
  return updateCart({ ...request, quantity: 0 }, sessionId);
}

export async function getCartEstimate(
  sessionId: string,
  agentId: string
): Promise<MCPToolResponse<CartResponse>> {
  const startTime = Date.now();
  
  try {
    const cart = await getSessionCart(sessionId);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        cart,
        total_items: totalItems,
        estimated_total: estimatedTotal
      },
      context: {
        session_id: sessionId,
        agent_id: agentId,
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: calculateCartSatisfaction(cart, null),
        next_actions: generateCartActions(cart)
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: { cart: [], total_items: 0, estimated_total: 0 },
      context: {
        session_id: sessionId,
        agent_id: agentId,
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Check session ID', 'Create new session']
      }
    };
  }
}

function generateCartBundlingOpportunities(cart: CartItem[]): string[] {
  const opportunities: string[] = [];
  
  const hasTent = cart.some(item => item.name.toLowerCase().includes('tent'));
  const hasSleeping = cart.some(item => item.name.toLowerCase().includes('sleeping') || item.name.toLowerCase().includes('bag'));
  const hasBackpack = cart.some(item => item.name.toLowerCase().includes('pack'));
  
  if (hasTent && hasSleeping) {
    opportunities.push('Complete camping system: add camp stove for full setup');
  }
  
  if (hasBackpack && !hasSleeping) {
    opportunities.push('Backpacking essential missing: consider adding sleeping system');
  }
  
  return opportunities;
}

function generateCartOptimizations(cart: CartItem[], budget?: number): string[] {
  if (!budget) return [];
  
  const optimizations: string[] = [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (total > budget) {
    optimizations.push(`Cart total $${total} exceeds budget $${budget}`);
    optimizations.push('Consider reducing quantities or choosing base models');
  } else if (total < budget * 0.9) {
    optimizations.push(`Budget allows for $${budget - total} in additional gear`);
    optimizations.push('Consider premium upgrades within remaining budget');
  }
  
  return optimizations;
}

function calculateCartSatisfaction(cart: CartItem[], agentContext: any): number {
  let satisfaction = 70; // Base satisfaction for having items
  
  if (cart.length === 0) return 0;
  if (cart.length >= 3) satisfaction += 10;
  if (cart.length >= 5) satisfaction += 10;
  
  // Boost for variety (different product types)
  const uniqueProducts = new Set(cart.map(item => item.productId));
  if (uniqueProducts.size > 1) satisfaction += 10;
  
  return Math.min(100, satisfaction);
}

function generateCartActions(cart: CartItem[]): string[] {
  const actions: string[] = [];
  
  if (cart.length === 0) {
    actions.push('Add products to cart');
    actions.push('Browse product recommendations');
  } else {
    actions.push('Review cart contents');
    actions.push('Proceed to checkout');
    actions.push('Get shipping estimates');
    
    if (cart.length === 1) {
      actions.push('Consider adding complementary items');
    }
  }
  
  return actions;
}