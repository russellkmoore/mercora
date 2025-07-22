"use client";

import Image from "next/image";
import { CartItem, useCartStore } from "@/lib/stores/cart-store";
import { Button } from "@/components/ui/button";

interface CartItemCardProps {
  item: CartItem;
}

export default function CartItemCard({ item }: CartItemCardProps) {
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  return (
    <div className="flex gap-4 border p-3 rounded shadow-sm">
      {item.primaryImageUrl && (
        <Image
          src={item.primaryImageUrl}
          alt={item.name}
          width={64}
          height={64}
          className="object-cover rounded"
        />
      )}
      <div className="flex-1">
        <p className="font-medium">{item.name}</p>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" className="bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
            <span className="text-sm">{item.quantity}</span>
          <Button size="sm" className="bg-neutral-100 text-black border border-gray-300 hover:bg-neutral-200" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>         
        </div>
       <p className="text-sm text-gray-500">
        ${(item.price).toFixed(2)} × {item.quantity} : ${(item.price * item.quantity).toFixed(2)}
       </p>
        <Button variant="outline" size="sm" className="text-red-600 mt-2 border border-red-200 bg-red-50 hover:bg-orange-500 hover:text-white" onClick={() => removeItem(item.id)}>
          Remove
        </Button>
      </div>
    </div>
  );
}
