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
    <div className="flex gap-4 border p-3 rounded shadow-sm">
      {item.primaryImageUrl && (
        <Image
          src={item.primaryImageUrl}
          alt={item.name}
          width={64}
          height={64}
          sizes="64px"
          className="object-cover rounded"
        />
      )}
      <div className="flex-1">
        <p className="font-medium">{item.name}</p>
        <div className="flex items-center gap-2 mt-2">
          {!isCheckoutPage && (
            <Button
              size="sm"
              className="bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
            >
              -
            </Button>
          )}
          <span className="text-sm">{item.quantity}</span>
          {!isCheckoutPage && (
            <Button
              size="sm"
              className="bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200"
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
            >
              +
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          ${item.price.toFixed(2)} × {item.quantity} : $
          {(item.price * item.quantity).toFixed(2)}
        </p>
        {!isCheckoutPage && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 mt-2 border border-red-200 bg-red-50 hover:bg-orange-500 hover:text-white"
            onClick={() => removeItem(item.productId)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
