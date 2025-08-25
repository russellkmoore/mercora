/**
 * === Agent Drawer Component ===
 *
 * A sliding chat interface that provides users with AI-powered assistance from Volt,
 * the outdoor gear expert. Features intelligent product recommendations, conversation
 * history, and seamless user experience optimizations.
 *
 * === Key Features ===
 * - **AI Chat Interface**: Real-time conversations with Volt AI assistant
 * - **Product Recommendations**: Displays AI-recommended products with full details
 * - **Auto-scroll**: Automatically scrolls to show latest messages
 * - **Auto-focus**: Returns focus to input after AI responses
 * - **Safari Compatibility**: Prevents password manager interference
 * - **Responsive Design**: 800px width with smooth animations
 * - **Error Handling**: Graceful fallbacks for API failures
 *
 * === Technical Details ===
 * - **State Management**: Uses Zustand chat store for conversation persistence
 * - **Authentication**: Integrates with Clerk for user context
 * - **API Integration**: Calls /api/agent-chat for AI responses
 * - **Component Architecture**: Modular with ProductCard components
 * - **Performance**: Optimized scrolling and focus management
 *
 * === Usage ===
 * ```tsx
 * <AgentDrawer />
 * ```
 * 
 * The component is fully self-contained and handles all chat functionality.
 */

"use client";

import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Search, Send, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useChatStore } from "@/lib/stores/chat-store";
import { useUser } from "@clerk/nextjs";
import { useEnhancedUserContext, formatUserContextForAI } from "@/lib/hooks/useEnhancedUserContext";
import ProductCard from "./ProductCard";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Image from "next/image";

/**
 * Main AgentDrawer component providing AI chat interface
 * 
 * Manages conversation state, API calls, and user experience optimizations
 * including auto-scroll, auto-focus, and product recommendation display.
 */
export default function AgentDrawer({ 
  variant = "desktop", 
  onOpen 
}: { 
  variant?: "desktop" | "mobile"; 
  onOpen?: () => void; 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const userContext = useEnhancedUserContext();
  const {
    messages,
    addMessage,
    setAssistantMessage,
    setProductIds,
    products,
    setProducts,
    clearMessages,
  } = useChatStore();

  /**
   * Scrolls chat container to bottom to show latest messages
   * Uses multiple approaches for maximum browser compatibility
   */
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      // Try multiple scroll approaches
      container.scrollTop = container.scrollHeight;
      
      // Also try scrollIntoView on the bottom anchor
      const bottomElement = container.querySelector('#chat-bottom');
      if (bottomElement) {
        bottomElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  };

  // Auto-scroll when messages or loading state changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages, isLoading]);

  // Handle drawer open state - scroll to bottom and focus input
  useEffect(() => {
    if (isOpen) {
      // Multiple scroll attempts with different delays to ensure it works across browsers
      setTimeout(() => scrollToBottom(), 50);
      setTimeout(() => scrollToBottom(), 100);
      setTimeout(() => scrollToBottom(), 200);
      
      // Focus input when drawer opens for immediate typing
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300);
    }
  }, [isOpen]);

  /**
   * Handles form submission and API communication with Volt AI
   * 
   * - Validates input
   * - Updates chat state
   * - Calls agent-chat API
   * - Handles responses and errors
   * - Manages focus and scroll behavior
   */
  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = {
      role: "user" as const,
      content: input.trim(),
      created_at: new Date().toISOString(),
    };
    addMessage(userMessage);
    setInput("");
    setIsLoading(true);
    
    // Force scroll after adding user message
    setTimeout(() => scrollToBottom(), 50);

    try {
      const res = await fetch("/api/agent-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          question: userMessage.content,
          userName: user?.firstName || user?.fullName || "Guest",
          userContext: formatUserContextForAI(userContext),
          orders: userContext.orders,
          history: messages 
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = (await res.json()) as { 
        answer: string; 
        productIds?: string[];
        products?: any[];
        history?: any[];
      };

      addMessage({
        role: "assistant",
        content: data.answer,
        created_at: new Date().toISOString(),
      });
      
      // Force scroll after adding assistant message
      setTimeout(() => scrollToBottom(), 50);
      
      // Return focus to input after response
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      
      
      setProductIds(data.productIds || []);
      setProducts(data.products || []);
    } catch (error) {
      addMessage({
        role: "assistant",
        content: "Sorry, I'm having trouble connecting right now. Please try again!",
        created_at: new Date().toISOString(),
      });
      
      // Force scroll after adding error message
      setTimeout(() => scrollToBottom(), 50);
      
      // Return focus to input even after error
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open && onOpen) {
        onOpen();
      }
    }}>
      <SheetTrigger asChild>
        {variant === "mobile" ? (
          <button 
            className="flex items-center space-x-3 text-white hover:text-orange-500 py-3 px-4 rounded-lg hover:bg-neutral-800 cursor-pointer w-full text-left bg-transparent border-none"
            type="button"
          >
            <Search className="h-5 w-5" />
            <span>Help & Search</span>
          </button>
        ) : (
          <Button
            variant="ghost"
            className="text-white hover:bg-white hover:text-orange-500"
            data-testid="agent-drawer-trigger"
          >
            <Search className="mr-2 h-4 w-4" />
            Help & Search
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-[#fdfdfb] text-black transition-all ease-in-out px-3 w-full sm:w-[400px] lg:!w-[800px] !max-w-[800px] !duration-[600ms] data-[state=closed]:!duration-[600ms] data-[state=open]:!duration-[600ms] flex flex-col h-full"
      >
        {/* Accessibility components */}
        <VisuallyHidden>
          <SheetTitle>AI Assistant Chat</SheetTitle>
          <SheetDescription>
            Chat with Volt, your AI outdoor gear expert, to get product recommendations and adventure advice.
          </SheetDescription>
        </VisuallyHidden>

        {/* Custom Close Button */}
        <div className="absolute top-4 right-4 z-20">
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full bg-gray-100 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close chat</span>
            </Button>
          </SheetClose>
        </div>

        {/* Left fade */}
        <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-r from-black/20 to-transparent z-10 pointer-events-none" />

        {/* Header - fixed */}
        <div className="flex-shrink-0">
          <h2 className="text-lg font-semibold mb-3 mt-2 flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Ask Volt
          </h2>
        </div>

        {/* Chat container - fixed height */}
        <div className="flex-shrink-0">
          <div 
            ref={chatContainerRef}
            className="border rounded-md p-3 h-60 sm:h-80 overflow-y-auto text-sm space-y-3 bg-gray-100"
          >
            {messages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-3">
                <div className="h-12 w-12 flex items-center justify-center">
                  <Image
                    src="/volt.svg"        // use PNG for crisp CF-resized avatars
                    alt="Volt mascot"
                    width={40}                    // a bit of padding inside the circle
                    height={40}
                    priority
                  />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-gray-700">Hi! I'm Volt, your gear expert.</p>
                  <p className="text-xs leading-relaxed max-w-xs">
                    Ask me about outdoor gear, product recommendations, or anything adventure-related. 
                    I'm here to help you find the perfect equipment!
                  </p>
                  <p className="text-xs text-gray-600 italic">
                    Try: "what do I use to start a fire? or "Tell me your secret s'mores recipe"
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="bg-blue-500 text-right text-white px-3 py-2 rounded-lg max-w-[75%]">
                      <p>
                        <strong>You:</strong> {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start space-x-2">
                    <div className="h-6 w-6 flex items-center justify-center">
                      <Image
                        src="/volt.svg"
                        alt="Volt mascot"
                        width={20}
                        height={20}
                      />
                    </div>
                    <div className="bg-white text-gray-800 px-3 py-2 rounded-lg max-w-[75%] shadow-sm border">
                      <p>
                        <strong>Voltique AI:</strong> {msg.content}
                      </p>
                    </div>
                  </div>
                )
              )
            )}
            {isLoading && (
              <div className="flex items-start space-x-2">
                <div className="h-6 w-6 flex items-center justify-center bg-orange-500 rounded-full text-white text-xs font-bold">
                  V
                </div>
                <div className="bg-white text-gray-800 px-3 py-2 rounded-lg shadow-sm border">
                  <p className="text-gray-500">
                    <strong>Voltique AI:</strong> Thinking...
                  </p>
                </div>
              </div>
            )}
            {/* Invisible scroll anchor */}
            <div id="chat-bottom" />
          </div>
        </div>

        {/* Input area - fixed */}
        <div className="flex-shrink-0 mt-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              placeholder={isLoading ? "Waiting for response..." : "Type your question..."}
              className="w-full border rounded pl-3 pr-10 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={input}
              disabled={isLoading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) handleSubmit();
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              name="chat-input"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-400 hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-4 flex-shrink-0" />

        {/* Products area - scrollable */}
        <div className="flex-1 overflow-y-auto text-sm text-gray-600">
          {products.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-semibold text-base text-black sticky top-0 bg-[#fdfdfb] pb-2">
                Recommended Products ({products.length})
              </h3>
              <div className="space-y-2 pb-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="space-y-2">
                <div className="text-2xl">🎒</div>
                <p className="font-medium text-gray-700">Product recommendations will appear here</p>
                <p className="text-xs">Ask Volt about specific gear and I'll show you the best options!</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
