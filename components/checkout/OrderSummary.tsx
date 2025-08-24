import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";
import OrderItemCard from "./OrderItemCard";
import DiscountCodeInput from "./DiscountCodeInput";
import { useCartStore } from "@/lib/stores/cart-store";

interface Props {
  items: CartItem[];
  shippingOption?: ShippingOption;
  taxAmount: number;
  showDiscountInput?: boolean;
}

export default function OrderSummary({
  items,
  shippingOption,
  taxAmount,
  showDiscountInput = false,
}: Props) {
  const { appliedDiscounts } = useCartStore();
  
  // Calculate totals from cart store if discounts are applied, otherwise use simple calculation
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingCost = shippingOption?.cost || 0;
  
  // Calculate discounts
  const cartDiscounts = appliedDiscounts.filter(d => d.type === 'cart');
  const shippingDiscounts = appliedDiscounts.filter(d => d.type === 'shipping');
  
  const cartDiscountAmount = cartDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const shippingDiscountAmount = shippingDiscounts.reduce((sum, d) => sum + d.amount, 0);
  
  const discountedSubtotal = Math.max(0, subtotal - cartDiscountAmount);
  const discountedShipping = Math.max(0, shippingCost - shippingDiscountAmount);
  const total = discountedSubtotal + discountedShipping + taxAmount;

  return (
    <div className="bg-white text-black p-6 rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

      <div className="space-y-1">
        {items.map((item, idx) => (
          <OrderItemCard key={idx} item={item} />
        ))}
      </div>

      {showDiscountInput && (
        <>
          <hr className="my-4" />
          <DiscountCodeInput />
        </>
      )}

      <hr className="my-2" />

      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      
      {/* Cart Discounts */}
      {cartDiscounts.map((discount) => (
        <div key={discount.promotionId} className="flex justify-between text-sm text-green-600">
          <span>{discount.displayName}</span>
          <span>-${discount.amount.toFixed(2)}</span>
        </div>
      ))}
      
      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span>${shippingCost.toFixed(2)}</span>
      </div>
      
      {/* Shipping Discounts */}
      {shippingDiscounts.map((discount) => (
        <div key={discount.promotionId} className="flex justify-between text-sm text-green-600">
          <span>{discount.displayName}</span>
          <span>-${discount.amount.toFixed(2)}</span>
        </div>
      ))}
      
      <div className="flex justify-between text-sm">
        <span>Tax</span>
        <span>${taxAmount.toFixed(2)}</span>
      </div>

      <hr className="my-2" />

      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
