import { Product } from '../types';
import { CartItem } from '../types/cartitem';
import { MACHAddress as Address } from '../types/mach/Address';

// Agent Context
export interface AgentContext {
  agentId: string;
  userId?: string;
  userPreferences?: {
    budget?: number;
    brands?: string[];
    activities?: string[];
    location?: string;
    experience_level?: string;
  };
  session_context?: string;
}

// MCP Session Management
export interface AgentSession {
  sessionId: string;
  agentId: string;
  userContext: AgentContext;
  cart: CartItem[];
  created_at: string;
  expires_at: string;
}

// Enhanced MCP Response Format
export interface MCPToolResponse<T> {
  success: boolean;
  data: T;
  context: {
    session_id: string;
    agent_id: string;
    processing_time_ms: number;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
    retryable?: boolean;
    suggestion?: string;
  };
  recommendations?: {
    alternative_sites?: string[];
    bundling_opportunities?: string[];
    cost_optimization?: string[];
  };
  metadata: {
    can_fulfill_percentage: number;
    estimated_satisfaction: number;
    next_actions?: string[];
  };
}

// Tool Request Types
export interface SearchRequest {
  query: string;
  options?: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    limit?: number;
    sortBy?: 'price' | 'rating' | 'popularity';
  };
  agent_context?: AgentContext;
}

export interface AssessRequest {
  requirements: {
    items: string[];
    budget: number;
    timeline: string;
    location: string;
  };
  agent_context?: AgentContext;
}

export interface RecommendRequest {
  context: {
    currentProduct?: number;
    userActivity?: string;
    budget?: number;
    useCase?: string;
  };
  agent_context?: AgentContext;
}

export interface CartRequest {
  productId: number;
  variantId: number;
  quantity?: number;
  agent_context?: AgentContext;
}

export interface OrderRequest {
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: string;
  shippingOption: string;
  specialInstructions?: string;
  agent_context?: AgentContext;
}

// Tool Response Types
export interface CapabilitiesResponse {
  categories: string[];
  price_ranges: Record<string, { min: number; max: number }>;
  shipping_regions: string[];
  specialties: string[];
}

export interface AssessResponse {
  can_fulfill: string[];
  cannot_fulfill: string[];
  recommendations: Product[];
  estimated_cost: number;
  estimated_delivery: string;
}

export interface CartResponse {
  cart: CartItem[];
  total_items: number;
  estimated_total: number;
}

export interface OrderResponse {
  orderId: string;
  status: string;
  total: number;
  tracking_number?: string;
  estimated_delivery: string;
}

// Authentication Types
export interface AgentAuthConfig {
  agentId: string;
  apiKey: string;
  permissions: string[];
  rateLimits: {
    requests_per_minute: number;
    orders_per_hour: number;
  };
}

// Error Response
export interface MCPError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  context: {
    session_id?: string;
    agent_id?: string;
    timestamp: string;
  };
}

// Chunked Response for large datasets
export interface ChunkedResponse<T> {
  chunk: number;
  total_chunks: number;
  data: T[];
  next_token?: string;
}