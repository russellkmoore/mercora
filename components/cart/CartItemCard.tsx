"use client";

import Image from "next/image";
import { useCartStore } from "@/lib/stores/cart-store";
import type { StableCartItem } from "@/lib/types/cartitem";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { cartItemTotal, Money } from "@/lib/money";

interface CartItemCardProps {
  item: StableCartItem;
}

export default function CartItemCard({ item }: CartItemCardProps) {
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const pathname = usePathname();
  const isCheckoutPage = pathname.startsWith("/checkout");

  return (
    <div className="flex gap-3 sm:gap-4 border p-3 rounded shadow-sm">
      {item.primaryImageUrl && (
        <Image
          src={item.primaryImageUrl}
          alt={item.name}
          width={56}
          height={56}
          sizes="56px"
          className="object-cover rounded shrink-0 sm:w-16 sm:h-16"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm sm:text-base truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-2">
          {!isCheckoutPage && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 text-base touch-manipulation bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200"
              onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
            >
              -
            </Button>
          )}
          <span className="text-sm min-w-[20px] text-center">{item.quantity}</span>
          {!isCheckoutPage && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 p-0 text-base touch-manipulation bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200"
              onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
            >
              +
            </Button>
          )}
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          {Money.fromStored(item.price).format()} × {item.quantity} : {cartItemTotal(item).format()}
        </p>
        {item.giftCardCustomization && (
          <p className="mt-1 text-xs text-gray-600">
            For {item.giftCardCustomization.recipientName || item.giftCardCustomization.recipientEmail}
            {item.giftCardCustomization.deliveryDate
              ? ` · Delivery ${item.giftCardCustomization.deliveryDate}`
              : ''}
          </p>
        )}
        {!isCheckoutPage && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 mt-2 border border-red-200 bg-red-50 hover:bg-orange-500 hover:text-white text-sm h-12 touch-manipulation"
            onClick={() => removeItem(item.lineId)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
