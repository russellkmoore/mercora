"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore, type AppliedDiscount } from "@/lib/stores/cart-store";
import { Loader2, Tag, X } from "lucide-react";
import { Money, cartSubtotal } from "@/lib/money";

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
      const subtotal = cartSubtotal(items);
      
      // Prepare cart items for validation
      const cartItems = items.map(item => ({
        productId: item.productId,
        categories: [], // We'd need to fetch product details for this, skipping for now
        quantity: item.quantity,
        price: Money.fromStored(item.price).toMinorUnits(),
      }));

      const response = await fetch("/api/validate-discount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim(),
          cartSubtotal: subtotal.toMinorUnits(),
          cartItems,
        }),
      });

      const result: DiscountValidationResponse = await response.json();

      if (result.valid && result.promotion) {
        let discountAmount = Money.fromMinor(result.promotion.discountAmount).toJSON();
        
        // Handle special case for free shipping (100% shipping discount)
        if (result.promotion.type === 'shipping' && result.promotion.discountValue === 100) {
          discountAmount = Money.zero().toJSON(); // Will be calculated when shipping is selected
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
    } catch (err: unknown) {
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Tag className="h-4 w-4" />
        <span>Have a discount code?</span>
      </div>

      {/* Applied Discounts */}
      {appliedDiscounts.length > 0 && (
        <div className="space-y-2">
          {appliedDiscounts.map((discount) => (
            <div
              key={discount.promotionId}
              className="flex items-center justify-between bg-success/10 border border-success rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">
                  {discount.code}
                </span>
                <span className="text-xs text-success">
                  ({discount.displayName})
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveDiscount(discount.promotionId)}
                className="h-6 w-6 p-0 text-success hover:text-success/90 hover:bg-success/10"
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
          className="bg-primary hover:bg-primary/80 text-on-primary"
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
        <div className="text-sm text-danger bg-danger/10 border border-danger rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Demo Codes Hint */}
      {process.env.NODE_ENV === 'development' && appliedDiscounts.length === 0 && (
        <div className="text-xs text-muted-foreground bg-surface-elevated border border-border rounded-md px-3 py-2">
          <strong>Demo codes:</strong> SAVE20, FREESHIP, 10OFF, TOOLS30, VIP25, WELCOME15, HALFSHIP
        </div>
      )}
    </div>
  );
}
