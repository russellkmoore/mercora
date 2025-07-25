import Image from "next/image";
import type { CartItem } from "@/lib/types/cartitem";

interface OrderItemCardProps {
  item: CartItem;
}

export default function OrderItemCard({ item }: OrderItemCardProps) {
  return (
    <div className="flex items-center gap-3 border rounded-lg p-1 bg-white">
      <div className="relative w-10 h-10 rounded overflow-hidden">
        {item.primaryImageUrl && (
          <Image
            src={item.primaryImageUrl}
            alt={item.name}
            fill
            className="object-cover"
          />
        )}
      </div>

      <div className="flex-1">
        <div className="font-medium text-sm leading-tight">{item.name}</div>
        <div className="text-xs text-gray-500">
          {item.quantity} × ${item.price.toFixed(2)}
        </div>
      </div>

      <div className="text-sm font-medium text-right min-w-[64px]">
        ${(item.price * item.quantity).toFixed(2)}
      </div>
    </div>
  );
}