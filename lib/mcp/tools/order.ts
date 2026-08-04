import { createOrder } from '../../models/mach/orders';
import { getSessionCart } from '../session';
import { OrderRequest, OrderResponse, MCPToolResponse } from '../types';
import { enhanceUserContext } from '../context';
import { MACHAddress as Address } from '../../types/mach/Address';
import { CartItem } from '../../types/cartitem';
import { Money, cartSubtotal } from '../../money';

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
    const userContext = enhanceUserContext(request.agent_context || null);
    
    // Calculate order totals
    const subtotal = cartSubtotal(cart);
    const shipping = calculateShipping(request.shippingAddress, subtotal);
    const tax = calculateTax(subtotal, request.shippingAddress);
    const total = subtotal.add(shipping).add(tax);

    // Validate order limits if agent has budget constraints
    if (userContext.budget && total.gt(Money.fromMajor(userContext.budget, total.currency))) {
      return {
        success: false,
        data: {
          orderId: '',
          status: 'budget_exceeded',
          total: total.toMach().amount,
          estimated_delivery: ''
        },
        context: {
          session_id: sessionId,
          agent_id: request.agent_context?.agentId || 'unknown',
          processing_time_ms: Date.now() - startTime
        },
        recommendations: {
          cost_optimization: [
            `Order total ${total.format()} exceeds budget $${userContext.budget}`,
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
      total_amount: total.toJSON(),
      status: 'confirmed' as const,
      shipping_address: request.shippingAddress,
      billing_address: request.billingAddress || request.shippingAddress,
      items: cart.map(item => ({
        product_id: item.productId,
        variant_id: item.variantId,
        sku: item.variantId || `${item.productId}-default`,
        quantity: item.quantity,
        unit_price: Money.fromStored(item.price).toJSON(),
        total_price: Money.fromStored(item.price).times(item.quantity).toJSON(),
        product_name: item.name
      })),
      shipping_method: request.shippingOption || 'standard',
      payment_method: request.paymentMethod || 'agent-processed',
      special_instructions: request.specialInstructions,
      // Agent-specific fields
      agent_id: request.agent_context?.agentId,
      agent_context: request.agent_context ? JSON.stringify(request.agent_context) : undefined,
      currency_code: 'USD'
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
      total: Money.fromStored(order.total_amount).toMach().amount,
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
        cost_optimization: [`Order saved ${Money.fromMajor(userContext.budget || total.toMach().amount).subtract(total).format()} vs budget`]
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

function calculateShipping(address: Address, subtotal: Money): Money {
  // Free shipping over $100
  if (subtotal.gte(Money.fromMajor(100, subtotal.currency))) return Money.zero(subtotal.currency);
  
  // Alaska/Hawaii surcharge
  if (address.region === 'AK' || address.region === 'HI') {
    return Money.fromMajor(19.99, subtotal.currency);
  }
  
  // Standard shipping
  return Money.fromMajor(9.99, subtotal.currency);
}

function calculateTax(subtotal: Money, address: Address): Money {
  // Simple tax calculation - in production, use proper tax service
  const taxRates: Record<string, number> = {
    'CA': 0.0875, // California
    'NY': 0.08,   // New York
    'TX': 0.0625, // Texas
    'FL': 0.06    // Florida
  };
  
  const rate = taxRates[address.region || ''] || 0.05; // Default 5%
  return subtotal.applyRate(rate);
}

function calculateEstimatedDelivery(address: Address, shippingOption: string): string {
  if (shippingOption === 'expedited' || shippingOption === 'overnight') {
    return '1-2 business days';
  }
  
  if (address.region === 'AK' || address.region === 'HI') {
    return '5-7 business days';
  }
  
  return '3-5 business days';
}

function formatAddressForDB(address: Address): string {
  return JSON.stringify({
    street: address.line1,
    street2: address.line2,
    city: address.city,
    state: address.region,
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
