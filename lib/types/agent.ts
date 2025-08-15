import { Product, CartItem, UserProfile } from '.';
export interface AgentResponse {
  answer?: string;
  content?: string;
  productIds?: string[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    productRecommendations?: Product[];
    orderReference?: string;
    searchQuery?: string;
  };
}

export interface AgentSession {
  id: string;
  userId?: string;
  messages: AgentMessage[];
  context: {
    currentProducts?: Product[];
    cartItems?: CartItem[];
    userProfile?: UserProfile;
  };
  createdAt: string;
  updatedAt: string;
}

