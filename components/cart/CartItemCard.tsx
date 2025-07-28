"use client";

import Image from "next/image";
import { useCartStore } from "@/lib/stores/cart-store";
import type { CartItem } from "@/lib/types/cartitem";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

interface CartItemCardProps {
  item: CartItem;
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
          className="object-cover rounded flex-shrink-0 sm:w-16 sm:h-16"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm sm:text-base truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-2">
          {!isCheckoutPage && (
            <Button
              size="sm"
              className="bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200 h-7 w-7 p-0 text-sm"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
            >
              -
            </Button>
          )}
          <span className="text-sm min-w-[20px] text-center">{item.quantity}</span>
          {!isCheckoutPage && (
            <Button
              size="sm"
              className="bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200 h-7 w-7 p-0 text-sm"
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
            >
              +
            </Button>
          )}
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          ${item.price.toFixed(2)} × {item.quantity} : $
          {(item.price * item.quantity).toFixed(2)}
        </p>
        {!isCheckoutPage && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 mt-2 border border-red-200 bg-red-50 hover:bg-orange-500 hover:text-white text-xs h-7"
            onClick={() => removeItem(item.productId)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
