"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Search, Send } from "lucide-react";
import { useState } from "react";

export default function AgentDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="text-white hover:bg-white hover:text-orange-500"
        >
          <Search className="mr-2 h-4 w-4" />
          Help & Search
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-[#fdfdfb] text-black transition-all duration-300 ease-in-out w-[400px] px-3"
      >
        {/* Left fade */}
        <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-r from-black/20 to-transparent z-10 pointer-events-none" />


        <h2 className="text-lg font-semibold mb-3 mt-2">Ask Voltique AI</h2>
        <div className="border rounded-md p-3 h-48 overflow-y-auto text-sm space-y-3">
          <div className="flex justify-end">
            <div className="bg-blue-100 text-right text-blue-900 px-3 py-2 rounded-lg max-w-[75%]">
              <p>
                <strong>You:</strong> How can I track my order?
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <div className="h-6 w-6 flex items-center justify-center bg-orange-500 rounded-full text-white text-xs font-bold">
              V
            </div>
            <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg max-w-[75%]">
              <p>
                <strong>Voltique AI:</strong> You can track your order in the{" "}
                <em>Order History</em> page under your account dashboard.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 relative">
          <input
            type="text"
            placeholder="Type your question..."
            className="w-full border rounded pl-3 pr-10 py-2"
          />
          <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black">
            <Send className="w-5 h-5" />
          </button>
        </div>

        <hr className="my-4" />
        <div className="text-sm text-gray-600">
          Search results will appear here...
        </div>
      </SheetContent>
    </Sheet>
  );
}
