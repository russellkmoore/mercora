import { MCPToolResponse } from '../types';
import { CartItem } from '../../types/cartitem';

export interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'paypal' | 'bank_transfer' | 'agent_processed';
  name: string;
  description: string;
  processing_fee: number;
  available: boolean;
  requirements?: string[];
}

export interface PaymentValidationRequest {
  payment_method: string;
  billing_address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
  };
  cart: CartItem[];
  total_amount: number;
  agent_context?: any;
}

export interface PaymentValidationResponse {
  valid: boolean;
  payment_methods: PaymentMethod[];
  recommended_method: string;
  processing_fee: number;
  estimated_processing_time: string;
  requirements_met: boolean;
  missing_requirements?: string[];
}

export async function validatePayment(
  request: PaymentValidationRequest,
  sessionId: string
): Promise<MCPToolResponse<PaymentValidationResponse>> {
  const startTime = Date.now();
  
  try {
    const { payment_method, billing_address, cart, total_amount } = request;
    
    // Get available payment methods
    const paymentMethods = getAvailablePaymentMethods(total_amount, billing_address?.country || 'US');
    
    // Validate the specific payment method
    const selectedMethod = paymentMethods.find(method => method.id === payment_method);
    const isValid = selectedMethod ? selectedMethod.available : false;
    
    // Check requirements
    const requirementCheck = checkPaymentRequirements(payment_method, billing_address, total_amount);
    
    // Calculate processing fee
    const processingFee = selectedMethod ? selectedMethod.processing_fee : 0;
    
    // Determine recommended method
    const recommendedMethod = getRecommendedPaymentMethod(paymentMethods, total_amount, request.agent_context);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        valid: isValid && requirementCheck.met,
        payment_methods: paymentMethods,
        recommended_method: recommendedMethod.id,
        processing_fee: processingFee,
        estimated_processing_time: selectedMethod?.type === 'agent_processed' ? 'Instant' : '1-3 business days',
        requirements_met: requirementCheck.met,
        missing_requirements: requirementCheck.missing
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      recommendations: {
        cost_optimization: generatePaymentRecommendations(paymentMethods, total_amount, request.agent_context?.userPreferences?.budget),
        alternative_sites: !isValid ? ['Consider alternative payment processors', 'Check agent payment capabilities'] : []
      },
      metadata: {
        can_fulfill_percentage: isValid ? 100 : 60,
        estimated_satisfaction: calculatePaymentSatisfaction(isValid, paymentMethods, requirementCheck.met),
        next_actions: generatePaymentActions(isValid, requirementCheck.met, requirementCheck.missing)
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      data: {
        valid: false,
        payment_methods: [],
        recommended_method: 'agent_processed',
        processing_fee: 0,
        estimated_processing_time: 'Unknown',
        requirements_met: false,
        missing_requirements: ['Payment validation failed']
      },
      context: {
        session_id: sessionId,
        agent_id: request.agent_context?.agentId || 'unknown',
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Verify payment information', 'Contact support', 'Try alternative payment method']
      }
    };
  }
}

function getAvailablePaymentMethods(amount: number, country: string): PaymentMethod[] {
  const methods: PaymentMethod[] = [
    {
      id: 'agent_processed',
      type: 'agent_processed',
      name: 'Agent Processed Payment',
      description: 'Payment handled by your personal shopping agent',
      processing_fee: 0,
      available: true,
      requirements: ['Valid agent credentials', 'Pre-authorized payment method']
    }
  ];
  
  // Credit card processing (for direct payments)
  if (amount >= 5 && amount <= 5000) {
    methods.push({
      id: 'credit_card',
      type: 'credit_card',
      name: 'Credit/Debit Card',
      description: 'Direct card processing via Stripe',
      processing_fee: Math.max(0.30, amount * 0.029), // Stripe-like fees
      available: true,
      requirements: ['Valid billing address', 'Card verification']
    });
  }
  
  // PayPal (US only for now)
  if (country === 'US' && amount >= 1) {
    methods.push({
      id: 'paypal',
      type: 'paypal',
      name: 'PayPal',
      description: 'PayPal checkout integration',
      processing_fee: amount * 0.0349, // PayPal merchant fees
      available: true,
      requirements: ['PayPal account', 'Email verification']
    });
  }
  
  // Bank transfer for larger amounts
  if (amount >= 100) {
    methods.push({
      id: 'bank_transfer',
      type: 'bank_transfer',
      name: 'Bank Transfer (ACH)',
      description: 'Direct bank account transfer',
      processing_fee: 0.50,
      available: country === 'US',
      requirements: ['Valid bank account', 'Identity verification', '3-5 business days processing time']
    });
  }
  
  return methods;
}

function checkPaymentRequirements(
  paymentMethod: string,
  billingAddress?: any,
  amount?: number
): { met: boolean; missing: string[] } {
  const missing: string[] = [];
  
  switch (paymentMethod) {
    case 'credit_card':
      if (!billingAddress) {
        missing.push('Billing address required for credit card payments');
      }
      if (amount && amount < 5) {
        missing.push('Minimum $5.00 required for credit card payments');
      }
      if (amount && amount > 5000) {
        missing.push('Credit card payments limited to $5,000 per transaction');
      }
      break;
      
    case 'paypal':
      if (!billingAddress?.country || billingAddress.country !== 'US') {
        missing.push('PayPal currently only available for US customers');
      }
      break;
      
    case 'bank_transfer':
      if (amount && amount < 100) {
        missing.push('Minimum $100.00 required for bank transfer');
      }
      if (!billingAddress?.country || billingAddress.country !== 'US') {
        missing.push('ACH transfers only available for US bank accounts');
      }
      break;
      
    case 'agent_processed':
      // Agent processed payments have minimal requirements
      break;
      
    default:
      missing.push(`Unknown payment method: ${paymentMethod}`);
  }
  
  return {
    met: missing.length === 0,
    missing
  };
}

function getRecommendedPaymentMethod(
  methods: PaymentMethod[],
  amount: number,
  agentContext?: any
): PaymentMethod {
  // Always prefer agent processed for seamless agent experience
  const agentProcessed = methods.find(m => m.id === 'agent_processed');
  if (agentProcessed?.available) {
    return agentProcessed;
  }
  
  // For small amounts, prefer credit card
  if (amount < 50) {
    const creditCard = methods.find(m => m.id === 'credit_card' && m.available);
    if (creditCard) return creditCard;
  }
  
  // For larger amounts, consider bank transfer to save on fees
  if (amount > 200) {
    const bankTransfer = methods.find(m => m.id === 'bank_transfer' && m.available);
    if (bankTransfer) return bankTransfer;
  }
  
  // Default to first available method
  return methods.find(m => m.available) || methods[0];
}

function generatePaymentRecommendations(methods: PaymentMethod[], amount: number, budget?: number): string[] {
  const recommendations: string[] = [];
  
  // Fee optimization
  const lowestFeeMethod = methods
    .filter(m => m.available)
    .reduce((prev, curr) => prev.processing_fee < curr.processing_fee ? prev : curr);
    
  if (lowestFeeMethod.processing_fee > 0) {
    recommendations.push(`Save on fees: ${lowestFeeMethod.name} has lowest processing cost ($${lowestFeeMethod.processing_fee.toFixed(2)})`);
  }
  
  // Budget considerations
  if (budget) {
    const totalWithFee = amount + lowestFeeMethod.processing_fee;
    if (totalWithFee > budget) {
      recommendations.push(`Payment fees will exceed budget by $${(totalWithFee - budget).toFixed(2)}`);
    }
  }
  
  // Speed recommendations
  const agentMethod = methods.find(m => m.id === 'agent_processed' && m.available);
  if (agentMethod) {
    recommendations.push('For fastest processing, use agent-handled payment');
  }
  
  return recommendations;
}

function calculatePaymentSatisfaction(isValid: boolean, methods: PaymentMethod[], requirementsMet: boolean): number {
  let satisfaction = 60; // Base satisfaction
  
  if (isValid && requirementsMet) {
    satisfaction += 30;
  }
  
  // Bonus for having multiple payment options
  const availableMethods = methods.filter(m => m.available).length;
  satisfaction += Math.min(10, availableMethods * 2);
  
  // Bonus for agent processed availability
  if (methods.some(m => m.id === 'agent_processed' && m.available)) {
    satisfaction += 10;
  }
  
  return Math.min(100, satisfaction);
}

function generatePaymentActions(isValid: boolean, requirementsMet: boolean, missingRequirements?: string[]): string[] {
  const actions: string[] = [];
  
  if (!isValid) {
    actions.push('Select valid payment method');
    actions.push('Check available payment options');
  }
  
  if (!requirementsMet && missingRequirements) {
    actions.push('Complete missing payment requirements');
    missingRequirements.forEach(req => {
      actions.push(`Address: ${req}`);
    });
  }
  
  if (isValid && requirementsMet) {
    actions.push('Proceed with payment processing');
    actions.push('Review order total and fees');
  }
  
  return actions;
}