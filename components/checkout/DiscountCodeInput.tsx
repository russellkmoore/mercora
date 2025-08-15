"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore, type AppliedDiscount } from "@/lib/stores/cart-store";
import { Loader2, Tag, X } from "lucide-react";

// Type definitions for the API response
interface DiscountValidationResponse {
  valid: boolean;
  promotion?: {
    id: string;
    type: 'cart' | 'product' | 'shipping';
    displayName: string;
    description: string;
    discountAmount: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  };
  error?: string;
}

export default function DiscountCodeInput() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { 
    items, 
    appliedDiscounts, 
    applyDiscount, 
    removeDiscount,
    calculateTotals
  } = useCartStore();

  const handleApplyDiscount = async () => {
    if (!code.trim()) {
      setError("Please enter a discount code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate cart subtotal for validation
      const cartSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Prepare cart items for validation
      const cartItems = items.map(item => ({
        productId: item.productId,
        categories: [], // We'd need to fetch product details for this, skipping for now
        quantity: item.quantity,
        price: item.price * 100, // Convert to cents
      }));

      const response = await fetch("/api/validate-discount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim(),
          cartSubtotal: cartSubtotal * 100, // Convert to cents
          cartItems,
        }),
      });

      const result: DiscountValidationResponse = await response.json();

      if (result.valid && result.promotion) {
        let discountAmount = result.promotion.discountAmount / 100; // Convert back to dollars
        
        // Handle special case for free shipping (100% shipping discount)
        if (result.promotion.type === 'shipping' && result.promotion.discountValue === 100) {
          discountAmount = 0; // Will be calculated when shipping is selected
        }

        const discount: AppliedDiscount = {
          promotionId: result.promotion.id,
          code: code.trim().toUpperCase(),
          type: result.promotion.type,
          description: result.promotion.description,
          amount: discountAmount,
          displayName: result.promotion.displayName,
        };

        applyDiscount(discount);
        setCode("");
        setError(null);
      } else {
        setError(result.error || "Invalid discount code");
      }
    } catch (err) {
      console.error("Error applying discount:", err);
      setError("Failed to apply discount code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDiscount = (promotionId: string) => {
    removeDiscount(promotionId);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Tag className="h-4 w-4" />
        <span>Have a discount code?</span>
      </div>
      
      {/* Applied Discounts */}
      {appliedDiscounts.length > 0 && (
        <div className="space-y-2">
          {appliedDiscounts.map((discount) => (
            <div
              key={discount.promotionId}
              className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  {discount.code}
                </span>
                <span className="text-xs text-green-600">
                  ({discount.displayName})
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveDiscount(discount.promotionId)}
                className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Discount Code Input */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Enter discount code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleApplyDiscount();
            }
          }}
          disabled={isLoading}
          className="flex-1 text-sm"
        />
        <Button
          onClick={handleApplyDiscount}
          disabled={isLoading || !code.trim()}
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Demo Codes Hint */}
      {process.env.NODE_ENV === 'development' && appliedDiscounts.length === 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          <strong>Demo codes:</strong> SAVE20, FREESHIP, 10OFF, TOOLS30, VIP25, WELCOME15, HALFSHIP
        </div>
      )}
    </div>
  );
}