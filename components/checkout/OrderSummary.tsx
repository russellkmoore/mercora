import type { ShippingOption } from "@/lib/types/shipping";
import type { CartItem } from "@/lib/types/cartitem";
import OrderItemCard from "./OrderItemCard";

interface Props {
  items: CartItem[];
  shippingOption?: ShippingOption;
  taxAmount: number;
}

export default function OrderSummary({ items, shippingOption, taxAmount }: Props) {
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingCost = shippingOption?.cost || 0;
  const total = subtotal + shippingCost + taxAmount;

  return (
    <div className="bg-white text-black p-6 rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

      <div className="space-y-1">
        {items.map((item, idx) => (
          <OrderItemCard key={idx} item={item} />
        ))}
      </div>

      <hr className="my-2" />

      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>${subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Shipping</span>
        <span>${shippingCost.toFixed(2)}</span>
      </div>
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
