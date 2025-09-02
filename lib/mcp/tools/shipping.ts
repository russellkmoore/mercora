import { MCPToolResponse } from '../types';
import { CartItem } from '../../types/core';

export interface ShippingOption {
  id: string;
  name: string;
  description: string;
  estimated_days: string;
  price: number;
  carrier: string;
}

export interface ShippingRequest {
  address: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
  };
  cart?: CartItem[];
  agent_context?: any;
}

export interface ShippingResponse {
  shipping_options: ShippingOption[];
  default_option: string;
  total_weight?: number;
  restrictions?: string[];
}

export async function getShippingOptions(
  request: ShippingRequest,
  sessionId: string
): Promise<MCPToolResponse<ShippingResponse>> {
  const startTime = Date.now();
  
  try {
    const { address, cart = [] } = request;
    
    // Calculate total weight and shipping cost factors
    const totalWeight = cart.reduce((sum, item) => sum + (item.quantity * 2), 0); // Assume 2lbs per item average
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Determine shipping zone based on state
    const zone = getShippingZone(address.state, address.country || 'US');
    
    // Generate shipping options based on zone and cart
    const shippingOptions: ShippingOption[] = [];
    
    // Standard shipping
    const standardCost = calculateStandardShipping(zone, totalWeight, cartTotal);
    shippingOptions.push({
      id: 'standard',
      name: 'Standard Shipping',
      description: 'USPS Ground - 5-7 business days',
      estimated_days: '5-7 business days',
      price: standardCost,
      carrier: 'USPS'
    });
    
    // Expedited shipping
    const expeditedCost = calculateExpeditedShipping(zone, totalWeight);
    shippingOptions.push({
      id: 'expedited',
      name: 'Expedited Shipping',
      description: 'UPS 2-Day - 2-3 business days',
      estimated_days: '2-3 business days', 
      price: expeditedCost,
      carrier: 'UPS'
    });
    
    // Overnight shipping (only for continental US)
    if (zone === 'continental') {
      const overnightCost = calculateOvernightShipping(totalWeight);
      shippingOptions.push({
        id: 'overnight',
        name: 'Overnight Shipping',
        description: 'FedEx Next Day - 1 business day',
        estimated_days: '1 business day',
        price: overnightCost,
        carrier: 'FedEx'
      });
    }
    
    // Check for shipping restrictions
    const restrictions = checkShippingRestrictions(address, cart);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        shipping_options: shippingOptions,
        default_option: 'standard',
        total_weight: totalWeight,
        restrictions
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: {
        cost_optimization: generateShippingRecommendations(shippingOptions, cartTotal, request.agent_context?.userPreferences?.budget),
        bundling_opportunities: cart.length > 0 ? ['Consider bulk orders to reduce per-item shipping cost'] : []
      },
      metadata: {
        can_fulfill_percentage: restrictions.length === 0 ? 100 : 75,
        estimated_satisfaction: calculateShippingSatisfaction(shippingOptions, restrictions),
        next_actions: restrictions.length > 0 ? 
          ['Review shipping restrictions', 'Consider alternative items'] :
          ['Select shipping option', 'Proceed to checkout']
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: {
        shipping_options: [],
        default_option: 'standard',
        restrictions: ['Unable to calculate shipping options']
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Verify shipping address', 'Check cart contents', 'Contact support']
      }
    };
  }
}

function getShippingZone(state: string, country: string): string {
  if (country !== 'US') {
    return 'international';
  }
  
  if (['AK', 'HI'].includes(state.toUpperCase())) {
    return 'extended';
  }
  
  return 'continental';
}

function calculateStandardShipping(zone: string, weight: number, cartTotal: number): number {
  // Free shipping over $75
  if (cartTotal >= 75) {
    return 0;
  }
  
  let baseCost = 0;
  switch (zone) {
    case 'continental':
      baseCost = 8.99;
      break;
    case 'extended':
      baseCost = 19.99;
      break;
    case 'international':
      baseCost = 29.99;
      break;
  }
  
  // Add weight-based surcharge for heavy orders
  if (weight > 10) {
    baseCost += Math.ceil((weight - 10) / 5) * 5;
  }
  
  return Math.round(baseCost * 100) / 100;
}

function calculateExpeditedShipping(zone: string, weight: number): number {
  let baseCost = 0;
  switch (zone) {
    case 'continental':
      baseCost = 19.99;
      break;
    case 'extended':
      baseCost = 39.99;
      break;
    case 'international':
      baseCost = 59.99;
      break;
  }
  
  // Weight surcharge
  if (weight > 5) {
    baseCost += Math.ceil((weight - 5) / 3) * 8;
  }
  
  return Math.round(baseCost * 100) / 100;
}

function calculateOvernightShipping(weight: number): number {
  let baseCost = 39.99;
  
  // Higher weight surcharge for overnight
  if (weight > 3) {
    baseCost += Math.ceil((weight - 3) / 2) * 12;
  }
  
  return Math.round(baseCost * 100) / 100;
}

function checkShippingRestrictions(address: any, cart: CartItem[]): string[] {
  const restrictions: string[] = [];
  
  // Check for hazardous materials (fuel canisters, etc.)
  const hasHazmat = cart.some(item => 
    item.name.toLowerCase().includes('fuel') || 
    item.name.toLowerCase().includes('canister') ||
    item.name.toLowerCase().includes('stove fuel')
  );
  
  if (hasHazmat) {
    restrictions.push('Fuel canisters require ground shipping only - expedited/overnight not available');
  }
  
  // International shipping restrictions
  if (address.country && address.country !== 'US') {
    restrictions.push('International shipping may require additional customs documentation');
    
    // Specific restricted items for international
    const hasElectronics = cart.some(item => 
      item.name.toLowerCase().includes('headlamp') ||
      item.name.toLowerCase().includes('lantern') ||
      item.name.toLowerCase().includes('gps')
    );
    
    if (hasElectronics) {
      restrictions.push('Electronics may require additional customs declarations');
    }
  }
  
  return restrictions;
}

function generateShippingRecommendations(options: ShippingOption[], cartTotal: number, budget?: number): string[] {
  const recommendations: string[] = [];
  
  // Free shipping threshold
  if (cartTotal < 75 && cartTotal >= 60) {
    recommendations.push(`Add $${75 - cartTotal} to cart for free standard shipping`);
  }
  
  // Budget-based recommendations
  if (budget) {
    const affordableOptions = options.filter(opt => opt.price <= budget * 0.1); // 10% of budget for shipping
    if (affordableOptions.length > 0) {
      const fastest = affordableOptions.reduce((prev, curr) => 
        parseInt(prev.estimated_days) < parseInt(curr.estimated_days) ? prev : curr
      );
      recommendations.push(`Within shipping budget: ${fastest.name} recommended`);
    } else {
      recommendations.push('Consider standard shipping to stay within budget');
    }
  }
  
  return recommendations;
}

function calculateShippingSatisfaction(options: ShippingOption[], restrictions: string[]): number {
  let satisfaction = 80; // Base satisfaction for having shipping options
  
  if (restrictions.length > 0) {
    satisfaction -= restrictions.length * 10;
  }
  
  if (options.length >= 3) {
    satisfaction += 10; // Bonus for having multiple options
  }
  
  if (options.some(opt => opt.price === 0)) {
    satisfaction += 10; // Bonus for free shipping
  }
  
  return Math.max(0, Math.min(100, satisfaction));
}