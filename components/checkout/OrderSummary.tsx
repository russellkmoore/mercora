import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";
import OrderItemCard from "./OrderItemCard";
import DiscountCodeInput from "./DiscountCodeInput";
import { useCartStore } from "@/lib/stores/cart-store";
import { Money, cartSubtotal } from "@/lib/money";

interface Props {
  items: CartItem[];
  shippingOption?: ShippingOption;
  taxAmount?: { amount: number; currency: string };
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
  const subtotal = cartSubtotal(items);
  const shippingCost = shippingOption ? Money.fromStored(shippingOption.cost) : Money.zero(subtotal.currency);
  
  // Calculate discounts
  const cartDiscounts = appliedDiscounts.filter(d => d.type === 'cart');
  const shippingDiscounts = appliedDiscounts.filter(d => d.type === 'shipping');
  
  const cartDiscountAmount = cartDiscounts.reduce((sum, d) => sum.add(Money.fromStored(d.amount)), Money.zero(subtotal.currency));
  const shippingDiscountAmount = shippingDiscounts.reduce((sum, d) => sum.add(Money.fromStored(d.amount)), Money.zero(subtotal.currency));
  
  const discountedSubtotal = subtotal.lte(cartDiscountAmount) ? Money.zero(subtotal.currency) : subtotal.subtract(cartDiscountAmount);
  const discountedShipping = shippingCost.lte(shippingDiscountAmount) ? Money.zero(subtotal.currency) : shippingCost.subtract(shippingDiscountAmount);
  const tax = taxAmount ? Money.fromStored(taxAmount, subtotal.currency) : Money.zero(subtotal.currency);
  const total = discountedSubtotal.add(discountedShipping).add(tax);

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
        <span>{subtotal.format()}</span>
      </div>
      
      {/* Cart Discounts */}
      {cartDiscounts.map((discount) => (
        <div key={discount.promotionId} className="flex justify-between text-sm text-green-600">
          <span>{discount.displayName}</span>
          <span>-{Money.fromStored(discount.amount).format()}</span>
        </div>
      ))}
      
      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span>{shippingCost.format()}</span>
      </div>
      
      {/* Shipping Discounts */}
      {shippingDiscounts.map((discount) => (
        <div key={discount.promotionId} className="flex justify-between text-sm text-green-600">
          <span>{discount.displayName}</span>
          <span>-{Money.fromStored(discount.amount).format()}</span>
        </div>
      ))}
      
      <div className="flex justify-between text-sm">
        <span>Tax</span>
        <span>{tax.format()}</span>
      </div>

      <hr className="my-2" />

      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{total.format()}</span>
      </div>
    </div>
  );
}
