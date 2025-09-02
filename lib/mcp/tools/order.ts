import { createOrder } from '../../models/mach/orders';
import { getSessionCart } from '../session';
import { OrderRequest, OrderResponse, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';
import { Address } from '../../types/mach/address';
import { CartItem } from '../../types/core';

export async function placeOrder(
  request: OrderRequest,
  sessionId: string
): Promise<MCPToolResponse<OrderResponse>> {
  const startTime = Date.now();
  
  try {
    // Get current cart from session
    const cart = await getSessionCart(sessionId);
    
    if (cart.length === 0) {
      return {
        success: false,
        data: {
          orderId: '',
          status: 'failed',
          total: 0,
          estimated_delivery: ''
        },
        context: {
          session_id: sessionId,
          agent_id: request.agent_context?.agentId || 'unknown',
          processing_time_ms: Date.now() - startTime
        },
        metadata: {
          can_fulfill_percentage: 0,
          estimated_satisfaction: 0,
          next_actions: ['Add items to cart before placing order']
        }
      };
    }

    // Enhanced user context for order
    const userContext = enhanceUserContext(request.agent_context);
    
    // Calculate order totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = calculateShipping(request.shippingAddress, subtotal);
    const tax = calculateTax(subtotal, request.shippingAddress);
    const total = subtotal + shipping + tax;

    // Validate order limits if agent has budget constraints
    if (userContext.budget && total > userContext.budget) {
      return {
        success: false,
        data: {
          orderId: '',
          status: 'budget_exceeded',
          total: total,
          estimated_delivery: ''
        },
        context: {
          session_id: sessionId,
          agent_id: request.agent_context?.agentId || 'unknown',
          processing_time_ms: Date.now() - startTime
        },
        recommendations: {
          cost_optimization: [
            `Order total $${total} exceeds budget $${userContext.budget}`,
            'Consider removing items or choosing base models'
          ]
        },
        metadata: {
          can_fulfill_percentage: 100,
          estimated_satisfaction: 30,
          next_actions: ['Reduce cart total', 'Remove expensive items', 'Choose alternative products']
        }
      };
    }

    // Create order using existing order system
    const orderData = {
      user_id: userContext.userId || request.agent_context?.agentId || 'agent-order',
      total_amount: total,
      status: 'confirmed' as const,
      shipping_address: formatAddressForDB(request.shippingAddress),
      billing_address: formatAddressForDB(request.billingAddress || request.shippingAddress),
      items: cart.map(item => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        price: item.price,
        name: item.name
      })),
      shipping_method: request.shippingOption || 'standard',
      payment_method: request.paymentMethod || 'agent-processed',
      special_instructions: request.specialInstructions,
      // Agent-specific fields
      agent_id: request.agent_context?.agentId,
      agent_context: request.agent_context ? JSON.stringify(request.agent_context) : undefined
    };

    const order = await createOrder(orderData);
    
    // Calculate estimated delivery
    const estimatedDelivery = calculateEstimatedDelivery(
      request.shippingAddress,
      request.shippingOption || 'standard'
    );

    // Generate order confirmation
    const response: OrderResponse = {
      orderId: order.id!.toString(),
      status: order.status,
      total: order.total_amount,
      tracking_number: order.tracking_number || undefined,
      estimated_delivery: estimatedDelivery
    };

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: response,
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: {
        bundling_opportunities: generatePostOrderRecommendations(cart),
        cost_optimization: [`Order saved $${(userContext.budget || total) - total} vs budget`]
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 95,
        next_actions: ['Track order status', 'Save order confirmation', 'Plan future purchases']
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: {
        orderId: '',
        status: 'failed',
        total: 0,
        estimated_delivery: ''
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Check order details', 'Verify payment method', 'Retry order placement']
      }
    };
  }
}

export async function getOrderStatus(
  orderId: string,
  agentId: string
): Promise<MCPToolResponse<OrderResponse>> {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you'd fetch from orders table
    // For now, return a mock response
    const response: OrderResponse = {
      orderId,
      status: 'confirmed',
      total: 299.99,
      tracking_number: `VT${Date.now()}`,
      estimated_delivery: '3-5 business days'
    };

    return {
      success: true,
      data: response,
      context: {
        session_id: 'status-check',
        agent_id: agentId,
        processing_time_ms: Date.now() - startTime
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 90,
        next_actions: ['Track shipment', 'Contact customer service if needed']
      }
    };
  } catch (error) {
    return {
      success: false,
      data: {
        orderId: '',
        status: 'error',
        total: 0,
        estimated_delivery: ''
      },
      context: {
        session_id: 'status-check',
        agent_id: agentId,
        processing_time_ms: Date.now() - startTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Verify order ID', 'Contact support']
      }
    };
  }
}

function calculateShipping(address: Address, subtotal: number): number {
  // Free shipping over $100
  if (subtotal >= 100) return 0;
  
  // Alaska/Hawaii surcharge
  if (address.state === 'AK' || address.state === 'HI') {
    return 19.99;
  }
  
  // Standard shipping
  return 9.99;
}

function calculateTax(subtotal: number, address: Address): number {
  // Simple tax calculation - in production, use proper tax service
  const taxRates: Record<string, number> = {
    'CA': 0.0875, // California
    'NY': 0.08,   // New York
    'TX': 0.0625, // Texas
    'FL': 0.06    // Florida
  };
  
  const rate = taxRates[address.state] || 0.05; // Default 5%
  return subtotal * rate;
}

function calculateEstimatedDelivery(address: Address, shippingOption: string): string {
  if (shippingOption === 'expedited' || shippingOption === 'overnight') {
    return '1-2 business days';
  }
  
  if (address.state === 'AK' || address.state === 'HI') {
    return '5-7 business days';
  }
  
  return '3-5 business days';
}

function formatAddressForDB(address: Address): string {
  return JSON.stringify({
    street: address.street,
    street2: address.street2,
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country || 'US'
  });
}

function generatePostOrderRecommendations(cart: CartItem[]): string[] {
  const recommendations: string[] = [];
  
  const hasTent = cart.some(item => item.name.toLowerCase().includes('tent'));
  const hasBackpack = cart.some(item => item.name.toLowerCase().includes('pack'));
  
  if (hasTent) {
    recommendations.push('Consider tent footprint for ground protection');
    recommendations.push('Add camping furniture for comfort');
  }
  
  if (hasBackpack) {
    recommendations.push('Rain cover recommended for pack protection');
    recommendations.push('Hydration system for longer hikes');
  }
  
  return recommendations;
}