import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types/product";

type ChatMessage = {
  role?: "user" | "assistant";
  content: string;
  created_at: string;
  productIds?: number[];
};

interface ChatState {
  messages: ChatMessage[];
  productIds: number[];
  products: Product[];
  addMessage: (msg: ChatMessage) => void;
  setAssistantMessage: (msg: ChatMessage) => void;
  setProductIds: (ids: number[]) => void;
  setProducts: (products: Product[]) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      productIds: [],
      products: [],
      addMessage: (msg) => set({ messages: [...get().messages, msg] }),
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
