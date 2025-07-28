/**
 * === Chat Store ===
 *
 * Zustand store for managing conversation state with the Volt AI assistant.
 * Provides persistent storage for chat history, product recommendations,
 * and conversation context across browser sessions.
 *
 * === Features ===
 * - **Persistent Storage**: Chat history survives browser refreshes
 * - **Message Management**: Add, update, and clear conversation messages
 * - **Product Integration**: Track recommended products from AI responses
 * - **Type Safety**: Fully typed with TypeScript interfaces
 * - **Performance**: Efficient state updates with Zustand
 *
 * === Storage Strategy ===
 * Uses localStorage with 'chat-storage' key to persist conversations.
 * Automatically rehydrates state on app initialization.
 *
 * === Usage ===
 * ```tsx
 * const { messages, addMessage, products } = useChatStore();
 * ```
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types/product";

/**
 * Represents a single chat message in the conversation
 */
type ChatMessage = {
  role?: "user" | "assistant";
  content: string;
  created_at: string;
  productIds?: number[]; // Optional product IDs associated with this message
};

/**
 * Chat store state interface defining all available state and actions
 */
interface ChatState {
  // === State ===
  messages: ChatMessage[];        // Complete conversation history
  productIds: number[];          // Currently displayed product IDs
  products: Product[];           // Full product objects for recommendations
  
  // === Actions ===
  addMessage: (msg: ChatMessage) => void;              // Add new message to conversation
  setAssistantMessage: (msg: ChatMessage) => void;     // Update last assistant message
  setProductIds: (ids: number[]) => void;              // Update displayed product IDs
  setProducts: (products: Product[]) => void;          // Update product recommendations
  clearMessages: () => void;                           // Clear entire conversation
}

/**
 * Chat store with persistent storage
 * 
 * Automatically saves conversation state to localStorage and restores
 * it on page reload to maintain conversation continuity.
 */
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: [],
      productIds: [],
      products: [],
      
      // Add new message to conversation history
      addMessage: (msg) => set({ messages: [...get().messages, msg] }),
      
      // Update the last assistant message (for streaming updates)
      setAssistantMessage: (msg) =>
        set({
          messages: [...get().messages.slice(0, -1), msg],
        }),
      setProductIds: (ids) => set({ productIds: ids }),
      setProducts: (products) => set({ products }),
      clearMessages: () => set({ messages: [], productIds: [], products: [] }),
    }),
    {
      name: "chat-storage",
    }
  )
);

export const getMessages = () => {
  return useChatStore.getState().messages;
};

export const addMessage = (msg: ChatMessage) => {
  useChatStore.getState().addMessage(msg);
};

export const clearMessages = () => {
  useChatStore.getState().clearMessages();
};
